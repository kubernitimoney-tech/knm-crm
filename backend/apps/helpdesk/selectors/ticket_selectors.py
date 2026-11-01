import uuid

from django.db.models import Q
from django.utils.dateparse import parse_date

from apps.helpdesk.models import Ticket
from apps.helpdesk.services.ticket_service import can_view_all_tickets


def visible_tickets_for(user):
    """IT Support, ticket assigners and admins see every ticket; others see their own."""
    qs = Ticket.objects.select_related(
        "category",
        "raised_by",
        "assigned_to",
        "resolved_by",
        "closed_by",
        "branch",
        "linked_content_type",
    )
    if can_view_all_tickets(user):
        return qs
    return qs.filter(Q(raised_by=user) | Q(assigned_to=user))


def filter_tickets(qs, params, *, user):
    status = params.get("status")
    if status:
        qs = qs.filter(status__in=[s for s in status.split(",") if s])
    for field in ("department", "priority"):
        value = params.get(field)
        if value:
            qs = qs.filter(**{field: value})
    category = params.get("category")
    if category:
        qs = qs.filter(category_id=_uuid(category))
    assignee = params.get("assigned_to")
    if assignee == "me":
        qs = qs.filter(assigned_to=user)
    elif assignee == "none":
        qs = qs.filter(assigned_to__isnull=True)
    elif assignee:
        qs = qs.filter(assigned_to_id=_uuid(assignee))
    if params.get("mine") in ("1", "true"):
        qs = qs.filter(raised_by=user)
    date_from = _parse_date(params.get("date_from"))
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    date_to = _parse_date(params.get("date_to"))
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    search = (params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(ticket_no__icontains=search)
            | Q(subject__icontains=search)
            | Q(reference_text__icontains=search)
            | Q(linked_label__icontains=search)
        )
    return qs


def _parse_date(value):
    try:
        return parse_date(value) if value else None
    except ValueError:
        return None


def _uuid(value):
    # An unparseable id matches nothing rather than raising.
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return uuid.UUID(int=0)
