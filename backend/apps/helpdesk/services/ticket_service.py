"""
Help desk ticket lifecycle.

    OPEN ─► IN_PROGRESS ─► RESOLVED ─► CLOSED (raiser confirms, or auto after 3 working days)
     │  ▲        │            └──► REOPENED ─► IN_PROGRESS ...
     │  └ ON_HOLD ◄┘
     └──► CANCELLED (raiser withdraws before work starts)

Rules:
- IT Support (ticket.resolve) works and resolves tickets; a resolution remark is required.
- Only the raiser may close (confirm) or reopen a resolved ticket. Closed is final:
  follow-ups are new tickets linked through ``related_ticket``.
- Nobody resolves a ticket they raised themselves.
"""

from __future__ import annotations

import logging

from django.apps import apps as django_apps
from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.services.role_helpers import (
    IT_SUPPORT_SLUG,
    get_active_users_with_role_slug,
    is_admin_or_super_admin,
    user_has_permission,
)
from apps.activities.services.activity_service import ActivityService
from apps.helpdesk.models import (
    Ticket,
    TicketCloseType,
    TicketComment,
    TicketEvent,
    TicketStatus,
)
from apps.helpdesk.services.working_days import add_working_days
from apps.notifications.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

AUTO_CLOSE_WORKING_DAYS = 3

# Records a ticket may point at: API slug -> (app_label, model_name).
LINKABLE_MODELS = {
    "lead": ("leads", "lead"),
    "call_log": ("leads", "calllog"),
    "customer": ("customers", "customer"),
    "application": ("applications", "loanapplication"),
    "loan": ("loans", "loan"),
}

WORKABLE_STATUSES = (
    TicketStatus.OPEN,
    TicketStatus.IN_PROGRESS,
    TicketStatus.ON_HOLD,
    TicketStatus.REOPENED,
)


class TicketError(Exception):
    """Business-rule violation; message is safe to show to the user."""


def is_support_agent(user) -> bool:
    return user_has_permission(user, "ticket.resolve")


def can_view_all_tickets(user) -> bool:
    return (
        is_admin_or_super_admin(user)
        or user_has_permission(user, "ticket.resolve")
        or user_has_permission(user, "ticket.assign")
    )


def linked_type_for(ticket: Ticket) -> str | None:
    ct = ticket.linked_content_type
    if ct is None:
        return None
    for slug, (app_label, model_name) in LINKABLE_MODELS.items():
        if ct.app_label == app_label and ct.model == model_name:
            return slug
    return None


class TicketService:
    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _next_ticket_no() -> str:
        prefix = f"HD-{timezone.localdate().year}-"
        last = (
            Ticket.objects.filter(ticket_no__startswith=prefix)
            .order_by("-ticket_no")
            .values_list("ticket_no", flat=True)
            .first()
        )
        seq = int(last.rsplit("-", 1)[1]) + 1 if last else 1
        return f"{prefix}{seq:06d}"

    @staticmethod
    def _resolve_linked(linked_type: str | None, linked_id):
        if not linked_type and not linked_id:
            return None
        if linked_type not in LINKABLE_MODELS or not linked_id:
            raise TicketError("Choose a valid linked record.")
        model = django_apps.get_model(*LINKABLE_MODELS[linked_type])
        obj = model.objects.filter(pk=linked_id).first()
        if obj is None:
            raise TicketError("The linked record was not found.")
        return obj

    @staticmethod
    def _lock(ticket: Ticket) -> Ticket:
        return Ticket.objects.select_for_update().get(pk=ticket.pk)

    @staticmethod
    def _record(ticket, *, kind, actor, from_status, remark="", metadata=None):
        TicketEvent.objects.create(
            ticket=ticket,
            kind=kind,
            actor=actor,
            from_status=from_status,
            to_status=ticket.status,
            remark=remark,
            metadata=metadata or {},
        )
        if ticket.linked_object_id:
            linked = ticket.linked_object
            if linked is not None:
                ActivityService.log(
                    actor=actor,
                    verb=f"ticket_{kind}",
                    description=f"Help desk ticket {ticket.ticket_no} {kind.replace('_', ' ')}",
                    target=linked,
                    metadata={"ticket_id": str(ticket.id), "ticket_no": ticket.ticket_no},
                )

    @staticmethod
    def _notify(users, ticket: Ticket, *, title: str, body: str, actor=None) -> None:
        recipients = {u.pk: u for u in users if u is not None and u != actor}
        NotificationService.notify_users(
            recipients.values(),
            title=title,
            body=body,
            metadata={
                "event": "helpdesk_ticket",
                "ticket_id": str(ticket.id),
                "ticket_no": ticket.ticket_no,
                "status": ticket.status,
            },
        )

    @staticmethod
    def _support_agents():
        # Queue alerts go to the IT Support team only, not every admin holding ticket.resolve.
        return list(get_active_users_with_role_slug(IT_SUPPORT_SLUG))

    @staticmethod
    def _require_status(ticket: Ticket, allowed, action: str) -> None:
        if ticket.status not in allowed:
            raise TicketError(
                f"Cannot {action} a ticket that is {ticket.get_status_display().lower()}."
            )

    @staticmethod
    def _require_agent(user) -> None:
        if not is_support_agent(user):
            raise TicketError("Only IT Support can work on tickets.")

    @staticmethod
    def _require_raiser(ticket: Ticket, user, action: str) -> None:
        if ticket.raised_by_id != user.id:
            raise TicketError(f"Only the person who raised the ticket can {action} it.")

    @staticmethod
    def _require_remark(remark: str, label: str) -> str:
        remark = (remark or "").strip()
        if not remark:
            raise TicketError(f"{label} is required.")
        return remark

    # ---------------------------------------------------------------- lifecycle

    @classmethod
    def raise_ticket(
        cls,
        *,
        user,
        category,
        subject: str,
        description: str,
        priority: str | None = None,
        linked_type: str | None = None,
        linked_id=None,
        reference_text: str = "",
        related_ticket: Ticket | None = None,
    ) -> Ticket:
        if not category.is_active:
            raise TicketError("This category is no longer available.")
        linked = cls._resolve_linked(linked_type, linked_id)
        profile = getattr(user, "profile", None)

        for attempt in range(3):
            try:
                with transaction.atomic():
                    ticket = Ticket.objects.create(
                        ticket_no=cls._next_ticket_no(),
                        category=category,
                        department=category.department,
                        subject=subject.strip(),
                        description=description.strip(),
                        priority=priority or category.default_priority,
                        raised_by=user,
                        branch=getattr(profile, "branch", None),
                        linked_content_type=(
                            ContentType.objects.get_for_model(linked) if linked else None
                        ),
                        linked_object_id=linked.pk if linked else None,
                        linked_label=str(linked)[:255] if linked else "",
                        reference_text=(reference_text or "").strip(),
                        related_ticket=related_ticket,
                        created_by=user,
                        updated_by=user,
                    )
                    cls._record(ticket, kind=TicketEvent.Kind.CREATED, actor=user, from_status="")
                break
            except IntegrityError:
                # Two tickets raced for the same number; retry with the next one.
                if attempt == 2:
                    raise

        cls._notify(
            cls._support_agents(),
            ticket,
            title=f"New ticket {ticket.ticket_no}",
            body=f"{ticket.category.name}: {ticket.subject}",
            actor=user,
        )
        return ticket

    @classmethod
    @transaction.atomic
    def assign(cls, ticket: Ticket, *, actor, assignee) -> Ticket:
        if not user_has_permission(actor, "ticket.assign") and assignee != actor:
            raise TicketError("You can only pick up tickets for yourself.")
        if not is_support_agent(assignee):
            raise TicketError("Tickets can only be assigned to IT Support users.")
        ticket = cls._lock(ticket)
        cls._require_status(ticket, WORKABLE_STATUSES, "assign")
        if ticket.raised_by_id == assignee.id:
            raise TicketError("A ticket cannot be assigned to the person who raised it.")
        previous = ticket.assigned_to
        ticket.assigned_to = assignee
        ticket.updated_by = actor
        ticket.save(update_fields=["assigned_to", "updated_by", "updated_at"])
        cls._record(
            ticket,
            kind=TicketEvent.Kind.ASSIGNED,
            actor=actor,
            from_status=ticket.status,
            metadata={
                "assigned_to": str(assignee.id),
                "previous_assignee": str(previous.id) if previous else None,
            },
        )
        cls._notify(
            [assignee],
            ticket,
            title=f"Ticket {ticket.ticket_no} assigned to you",
            body=ticket.subject,
            actor=actor,
        )
        return ticket

    @classmethod
    @transaction.atomic
    def start(cls, ticket: Ticket, *, actor) -> Ticket:
        cls._require_agent(actor)
        ticket = cls._lock(ticket)
        cls._require_status(
            ticket, (TicketStatus.OPEN, TicketStatus.ON_HOLD, TicketStatus.REOPENED), "start"
        )
        if ticket.raised_by_id == actor.id:
            raise TicketError("You cannot work on a ticket you raised.")
        from_status = ticket.status
        ticket.status = TicketStatus.IN_PROGRESS
        if ticket.assigned_to_id is None:
            ticket.assigned_to = actor
        ticket.updated_by = actor
        ticket.save(update_fields=["status", "assigned_to", "updated_by", "updated_at"])
        cls._record(ticket, kind=TicketEvent.Kind.STARTED, actor=actor, from_status=from_status)
        return ticket

    @classmethod
    @transaction.atomic
    def hold(cls, ticket: Ticket, *, actor, remark: str) -> Ticket:
        cls._require_agent(actor)
        remark = cls._require_remark(remark, "Hold reason")
        ticket = cls._lock(ticket)
        cls._require_status(ticket, (TicketStatus.IN_PROGRESS,), "put on hold")
        ticket.status = TicketStatus.ON_HOLD
        ticket.updated_by = actor
        ticket.save(update_fields=["status", "updated_by", "updated_at"])
        cls._record(
            ticket,
            kind=TicketEvent.Kind.ON_HOLD,
            actor=actor,
            from_status=TicketStatus.IN_PROGRESS,
            remark=remark,
        )
        cls._notify(
            [ticket.raised_by],
            ticket,
            title=f"Ticket {ticket.ticket_no} on hold",
            body=remark,
            actor=actor,
        )
        return ticket

    @classmethod
    @transaction.atomic
    def resolve(
        cls, ticket: Ticket, *, actor, remark: str, corrections: list | None = None
    ) -> Ticket:
        cls._require_agent(actor)
        remark = cls._require_remark(remark, "Resolution remark")
        ticket = cls._lock(ticket)
        cls._require_status(ticket, WORKABLE_STATUSES, "resolve")
        if ticket.raised_by_id == actor.id:
            raise TicketError("You cannot resolve a ticket you raised.")
        from_status = ticket.status
        now = timezone.now()
        ticket.status = TicketStatus.RESOLVED
        ticket.resolution_remark = remark
        ticket.resolved_at = now
        ticket.resolved_by = actor
        ticket.auto_close_at = add_working_days(now, AUTO_CLOSE_WORKING_DAYS)
        if ticket.assigned_to_id is None:
            ticket.assigned_to = actor
        ticket.updated_by = actor
        ticket.save(
            update_fields=[
                "status",
                "resolution_remark",
                "resolved_at",
                "resolved_by",
                "auto_close_at",
                "assigned_to",
                "updated_by",
                "updated_at",
            ]
        )
        cls._record(
            ticket,
            kind=TicketEvent.Kind.RESOLVED,
            actor=actor,
            from_status=from_status,
            remark=remark,
            metadata={"corrections": corrections} if corrections else None,
        )
        cls._notify(
            [ticket.raised_by],
            ticket,
            title=f"Ticket {ticket.ticket_no} resolved — please confirm",
            body=remark,
            actor=actor,
        )
        return ticket

    @classmethod
    @transaction.atomic
    def close(cls, ticket: Ticket, *, actor, remark: str = "") -> Ticket:
        ticket = cls._lock(ticket)
        cls._require_raiser(ticket, actor, "close")
        cls._require_status(ticket, (TicketStatus.RESOLVED,), "close")
        cls._mark_closed(ticket, actor=actor, close_type=TicketCloseType.CONFIRMED)
        cls._record(
            ticket,
            kind=TicketEvent.Kind.CLOSED,
            actor=actor,
            from_status=TicketStatus.RESOLVED,
            remark=(remark or "").strip(),
        )
        cls._notify(
            [ticket.assigned_to, ticket.resolved_by],
            ticket,
            title=f"Ticket {ticket.ticket_no} closed by raiser",
            body=ticket.subject,
            actor=actor,
        )
        return ticket

    @classmethod
    @transaction.atomic
    def reopen(cls, ticket: Ticket, *, actor, remark: str) -> Ticket:
        remark = cls._require_remark(remark, "Reopen reason")
        ticket = cls._lock(ticket)
        cls._require_raiser(ticket, actor, "reopen")
        cls._require_status(ticket, (TicketStatus.RESOLVED,), "reopen")
        ticket.status = TicketStatus.REOPENED
        ticket.auto_close_at = None
        ticket.reopen_count += 1
        ticket.updated_by = actor
        ticket.save(
            update_fields=["status", "auto_close_at", "reopen_count", "updated_by", "updated_at"]
        )
        cls._record(
            ticket,
            kind=TicketEvent.Kind.REOPENED,
            actor=actor,
            from_status=TicketStatus.RESOLVED,
            remark=remark,
        )
        recipients = [ticket.assigned_to] if ticket.assigned_to else cls._support_agents()
        cls._notify(
            recipients,
            ticket,
            title=f"Ticket {ticket.ticket_no} reopened",
            body=remark,
            actor=actor,
        )
        return ticket

    @classmethod
    @transaction.atomic
    def cancel(cls, ticket: Ticket, *, actor, remark: str = "") -> Ticket:
        ticket = cls._lock(ticket)
        cls._require_raiser(ticket, actor, "cancel")
        cls._require_status(ticket, (TicketStatus.OPEN,), "cancel")
        ticket.status = TicketStatus.CANCELLED
        ticket.closed_at = timezone.now()
        ticket.closed_by = actor
        ticket.updated_by = actor
        ticket.save(update_fields=["status", "closed_at", "closed_by", "updated_by", "updated_at"])
        cls._record(
            ticket,
            kind=TicketEvent.Kind.CANCELLED,
            actor=actor,
            from_status=TicketStatus.OPEN,
            remark=(remark or "").strip(),
        )
        return ticket

    @staticmethod
    def _mark_closed(ticket: Ticket, *, actor, close_type: str) -> None:
        ticket.status = TicketStatus.CLOSED
        ticket.closed_at = timezone.now()
        ticket.closed_by = actor
        ticket.close_type = close_type
        ticket.auto_close_at = None
        ticket.updated_by = actor
        ticket.save(
            update_fields=[
                "status",
                "closed_at",
                "closed_by",
                "close_type",
                "auto_close_at",
                "updated_by",
                "updated_at",
            ]
        )

    @classmethod
    def auto_close_due(cls, *, now=None) -> int:
        """Close resolved tickets the raiser did not confirm or reopen in time."""
        now = now or timezone.now()
        due_ids = list(
            Ticket.objects.filter(status=TicketStatus.RESOLVED, auto_close_at__lte=now).values_list(
                "id", flat=True
            )
        )
        closed = 0
        for ticket_id in due_ids:
            try:
                with transaction.atomic():
                    ticket = (
                        Ticket.objects.select_for_update(skip_locked=True)
                        .filter(pk=ticket_id, status=TicketStatus.RESOLVED, auto_close_at__lte=now)
                        .first()
                    )
                    if ticket is None:
                        continue
                    cls._mark_closed(ticket, actor=None, close_type=TicketCloseType.AUTO)
                    cls._record(
                        ticket,
                        kind=TicketEvent.Kind.AUTO_CLOSED,
                        actor=None,
                        from_status=TicketStatus.RESOLVED,
                        remark=(
                            f"Auto-closed: not confirmed within {AUTO_CLOSE_WORKING_DAYS} "
                            "working days of resolution."
                        ),
                    )
                    cls._notify(
                        [ticket.raised_by, ticket.assigned_to],
                        ticket,
                        title=f"Ticket {ticket.ticket_no} auto-closed",
                        body=ticket.subject,
                    )
                closed += 1
            except Exception:
                logger.exception("Auto-close failed for ticket %s", ticket_id)
        return closed

    # ----------------------------------------------------------------- comments

    @staticmethod
    def add_comment(ticket: Ticket, *, author, body: str, is_internal: bool = False):
        body = (body or "").strip()
        if not body:
            raise TicketError("Comment cannot be empty.")
        if is_internal and not is_support_agent(author):
            raise TicketError("Only IT Support can add internal notes.")
        if ticket.status in (TicketStatus.CLOSED, TicketStatus.CANCELLED):
            raise TicketError("This ticket is closed. Raise a new ticket to follow up.")
        comment = TicketComment.objects.create(
            ticket=ticket, author=author, body=body, is_internal=is_internal
        )
        if not is_internal:
            other = ticket.assigned_to if author.id == ticket.raised_by_id else ticket.raised_by
            TicketService._notify(
                [other],
                ticket,
                title=f"New comment on {ticket.ticket_no}",
                body=body[:200],
                actor=author,
            )
        return comment
