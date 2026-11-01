import csv

from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission

from apps.accounts.models import User
from apps.accounts.permissions import (
    HasRBACPermission,
    RBACActionPermissionMixin,
    rbac_any_permission,
    rbac_permission,
)
from apps.accounts.services.role_helpers import (
    IT_SUPPORT_SLUG,
    get_active_users_with_role_slug,
    is_admin_or_super_admin,
)
from apps.core.responses import error_response, success_response
from apps.helpdesk.models import TicketAttachment, TicketCategory, TicketStatus
from apps.helpdesk.selectors import filter_tickets, visible_tickets_for
from apps.helpdesk.serializers import (
    AssignSerializer,
    AttachmentUploadSerializer,
    CommentCreateSerializer,
    RemarkSerializer,
    ResolveSerializer,
    TicketAttachmentSerializer,
    TicketCategorySerializer,
    TicketCommentSerializer,
    TicketCreateSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
)
from apps.helpdesk.services.ticket_service import TicketError, TicketService, is_support_agent

EXPORT_MAX_ROWS = 5000


class IsAdminOrSuperAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated) and is_admin_or_super_admin(
            request.user
        )


class TicketCategoryViewSet(viewsets.ModelViewSet):
    """Everyone with ticket.view lists categories; Admin / Super Admin maintain them."""

    serializer_class = TicketCategorySerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "partial_update"):
            return [IsAdminOrSuperAdmin()]
        self.required_permission = "ticket.view"
        return [HasRBACPermission()]

    def get_queryset(self):
        qs = TicketCategory.objects.all()
        include_inactive = self.request.query_params.get("include_inactive") in ("1", "true")
        if not (include_inactive and is_admin_or_super_admin(self.request.user)):
            qs = qs.filter(is_active=True)
        department = self.request.query_params.get("department")
        if department:
            qs = qs.filter(department=department)
        return qs

    def list(self, request, *args, **kwargs):
        return success_response(data=self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return success_response(data=self.get_serializer(self.get_object()).data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return success_response(
            data=response.data, message="Category created", status_code=status.HTTP_201_CREATED
        )

    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        return success_response(data=response.data, message="Category updated")


class TicketViewSet(RBACActionPermissionMixin, viewsets.GenericViewSet):
    """
    Help desk tickets. Lifecycle rules (who may resolve / close / reopen) live
    in TicketService; RBAC here only gates which endpoints a role can reach.
    """

    permission_classes = [HasRBACPermission]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    rbac_crud_permissions = {
        "list": "ticket.view",
        "retrieve": "ticket.view",
        "create": "ticket.create",
    }

    def get_queryset(self):
        return visible_tickets_for(self.request.user)

    def _detail(self, ticket_pk, *, message="", status_code=status.HTTP_200_OK):
        ticket = (
            self.get_queryset()
            .select_related("related_ticket")
            .prefetch_related("events__actor", "attachments__uploaded_by")
            .get(pk=ticket_pk)
        )
        return success_response(
            data=TicketDetailSerializer(ticket, context={"request": self.request}).data,
            message=message,
            status_code=status_code,
        )

    def _run(self, fn, *, message: str):
        try:
            ticket = fn()
        except TicketError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        return self._detail(ticket.pk, message=message)

    # -------------------------------------------------------------- read / raise

    def list(self, request):
        qs = filter_tickets(self.get_queryset(), request.query_params, user=request.user)
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(TicketListSerializer(page, many=True).data)

    def retrieve(self, request, pk=None):
        return self._detail(self.get_object().pk)

    def create(self, request):
        serializer = TicketCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            ticket = TicketService.raise_ticket(
                user=request.user,
                category=data["category"],
                subject=data["subject"],
                description=data["description"],
                priority=data.get("priority"),
                linked_type=data.get("linked_type"),
                linked_id=data.get("linked_id"),
                reference_text=data.get("reference_text", ""),
                related_ticket=data.get("related_ticket"),
            )
        except TicketError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        return self._detail(
            ticket.pk,
            message=f"Ticket {ticket.ticket_no} raised",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_permission("ticket.view")
    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = self.get_queryset()
        if request.query_params.get("mine") in ("1", "true"):
            qs = qs.filter(raised_by=request.user)
        by_status = {row["status"]: row["n"] for row in qs.values("status").annotate(n=Count("id"))}
        data = {
            "by_status": {value: by_status.get(value, 0) for value in TicketStatus.values},
            "by_department": list(
                qs.exclude(status__in=[TicketStatus.CLOSED, TicketStatus.CANCELLED])
                .values("department")
                .annotate(n=Count("id"))
                .order_by("department")
            ),
            "awaiting_my_confirmation": qs.filter(
                raised_by=request.user, status=TicketStatus.RESOLVED
            ).count(),
        }
        if is_support_agent(request.user):
            data["assigned_to_me_open"] = qs.filter(
                assigned_to=request.user,
                status__in=[
                    TicketStatus.OPEN,
                    TicketStatus.IN_PROGRESS,
                    TicketStatus.ON_HOLD,
                    TicketStatus.REOPENED,
                ],
            ).count()
            data["unassigned"] = qs.filter(
                assigned_to__isnull=True, status=TicketStatus.OPEN
            ).count()
        return success_response(data=data)

    @rbac_any_permission("ticket.assign", "ticket.resolve")
    @action(detail=False, methods=["get"], url_path="assignees")
    def assignees(self, request):
        users = get_active_users_with_role_slug(IT_SUPPORT_SLUG)
        return success_response(
            data=[
                {"id": str(u.id), "name": u.get_full_name() or u.email, "email": u.email}
                for u in users
            ]
        )

    @rbac_permission("ticket.export")
    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        qs = filter_tickets(self.get_queryset(), request.query_params, user=request.user)
        response = HttpResponse(content_type="text/csv")
        stamp = timezone.localtime().strftime("%Y%m%d-%H%M")
        response["Content-Disposition"] = f'attachment; filename="helpdesk-tickets-{stamp}.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "Ticket No",
                "Department",
                "Category",
                "Subject",
                "Priority",
                "Status",
                "Raised By",
                "Assigned To",
                "Linked Record",
                "Reference",
                "Raised At",
                "Resolved At",
                "Closed At",
                "Close Type",
                "Reopen Count",
                "Resolution Remark",
            ]
        )

        def fmt(dt):
            return timezone.localtime(dt).strftime("%d-%m-%Y %H:%M") if dt else ""

        for t in qs[:EXPORT_MAX_ROWS]:
            writer.writerow(
                [
                    t.ticket_no,
                    t.get_department_display(),
                    t.category.name,
                    _csv_safe(t.subject),
                    t.get_priority_display(),
                    t.get_status_display(),
                    t.raised_by.get_full_name() or t.raised_by.email,
                    (t.assigned_to.get_full_name() or t.assigned_to.email) if t.assigned_to else "",
                    _csv_safe(t.linked_label),
                    _csv_safe(t.reference_text),
                    fmt(t.created_at),
                    fmt(t.resolved_at),
                    fmt(t.closed_at),
                    t.get_close_type_display() if t.close_type else "",
                    t.reopen_count,
                    _csv_safe(t.resolution_remark),
                ]
            )
        return response

    # ----------------------------------------------------------------- lifecycle

    @rbac_any_permission("ticket.assign", "ticket.resolve")
    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        ticket = self.get_object()
        serializer = AssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignee = User.objects.filter(pk=serializer.validated_data["assignee"], is_active=True)
        assignee = assignee.first()
        if assignee is None:
            return error_response(message="Assignee not found.", status_code=400)
        return self._run(
            lambda: TicketService.assign(ticket, actor=request.user, assignee=assignee),
            message="Ticket assigned",
        )

    @rbac_permission("ticket.resolve")
    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        ticket = self.get_object()
        return self._run(
            lambda: TicketService.start(ticket, actor=request.user), message="Work started"
        )

    @rbac_permission("ticket.resolve")
    @action(detail=True, methods=["post"], url_path="hold")
    def hold(self, request, pk=None):
        ticket = self.get_object()
        remark = self._remark(request)
        return self._run(
            lambda: TicketService.hold(ticket, actor=request.user, remark=remark),
            message="Ticket on hold",
        )

    @rbac_permission("ticket.resolve")
    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        serializer = ResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return self._run(
            lambda: TicketService.resolve(
                ticket,
                actor=request.user,
                remark=data["remark"],
                corrections=data.get("corrections") or None,
            ),
            message="Ticket resolved",
        )

    @rbac_permission("ticket.view")
    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        ticket = self.get_object()
        remark = self._remark(request)
        return self._run(
            lambda: TicketService.close(ticket, actor=request.user, remark=remark),
            message="Ticket closed",
        )

    @rbac_permission("ticket.view")
    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, pk=None):
        ticket = self.get_object()
        remark = self._remark(request)
        return self._run(
            lambda: TicketService.reopen(ticket, actor=request.user, remark=remark),
            message="Ticket reopened",
        )

    @rbac_permission("ticket.view")
    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        ticket = self.get_object()
        remark = self._remark(request)
        return self._run(
            lambda: TicketService.cancel(ticket, actor=request.user, remark=remark),
            message="Ticket cancelled",
        )

    # ------------------------------------------------------ comments / attachments

    @rbac_permission("ticket.view")
    @action(detail=True, methods=["post"], url_path="comments")
    def comments(self, request, pk=None):
        ticket = self.get_object()
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            comment = TicketService.add_comment(
                ticket,
                author=request.user,
                body=serializer.validated_data["body"],
                is_internal=serializer.validated_data["is_internal"],
            )
        except TicketError as exc:
            return error_response(message=str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        return success_response(
            data=TicketCommentSerializer(comment).data,
            message="Comment added",
            status_code=status.HTTP_201_CREATED,
        )

    @rbac_permission("ticket.view")
    @action(detail=True, methods=["post"], url_path="attachments")
    def attachments(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status in (TicketStatus.CLOSED, TicketStatus.CANCELLED):
            return error_response(
                message="This ticket is closed. Raise a new ticket to follow up.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AttachmentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data["file"]
        attachment = TicketAttachment.objects.create(
            ticket=ticket,
            uploaded_by=request.user,
            file=upload,
            file_name=upload.display_name,
            file_size=upload.size,
        )
        return success_response(
            data=TicketAttachmentSerializer(attachment, context={"request": request}).data,
            message="Attachment uploaded",
            status_code=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _remark(request) -> str:
        serializer = RemarkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data["remark"]


def _csv_safe(value: str) -> str:
    """Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell)."""
    value = value or ""
    return f"'{value}" if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value
