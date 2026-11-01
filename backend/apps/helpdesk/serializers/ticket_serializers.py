from rest_framework import serializers

from apps.core.validators.attachments import (
    safe_attachment_display_name,
    validate_ticket_attachment,
)
from apps.helpdesk.models import (
    Ticket,
    TicketAttachment,
    TicketCategory,
    TicketComment,
    TicketEvent,
    TicketPriority,
    TicketStatus,
)
from apps.helpdesk.services.ticket_service import (
    LINKABLE_MODELS,
    WORKABLE_STATUSES,
    is_support_agent,
    linked_type_for,
)


def _user_brief(user):
    if user is None:
        return None
    return {"id": str(user.id), "name": user.get_full_name() or user.email, "email": user.email}


class TicketCategorySerializer(serializers.ModelSerializer):
    department_display = serializers.CharField(source="get_department_display", read_only=True)

    class Meta:
        model = TicketCategory
        fields = [
            "id",
            "department",
            "department_display",
            "name",
            "description",
            "default_priority",
            "sort_order",
            "is_active",
        ]


class TicketListSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    department_display = serializers.CharField(source="get_department_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    raised_by = serializers.SerializerMethodField()
    assigned_to = serializers.SerializerMethodField()
    linked_type = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            "id",
            "ticket_no",
            "subject",
            "category",
            "department",
            "department_display",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "raised_by",
            "assigned_to",
            "linked_type",
            "linked_object_id",
            "linked_label",
            "reference_text",
            "reopen_count",
            "resolved_at",
            "auto_close_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]

    def get_category(self, obj):
        return {"id": str(obj.category_id), "name": obj.category.name}

    def get_raised_by(self, obj):
        return _user_brief(obj.raised_by)

    def get_assigned_to(self, obj):
        return _user_brief(obj.assigned_to)

    def get_linked_type(self, obj):
        return linked_type_for(obj)


class TicketEventSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    actor = serializers.SerializerMethodField()

    class Meta:
        model = TicketEvent
        fields = [
            "id",
            "kind",
            "kind_display",
            "actor",
            "from_status",
            "to_status",
            "remark",
            "metadata",
            "created_at",
        ]

    def get_actor(self, obj):
        return _user_brief(obj.actor)


class TicketCommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = TicketComment
        fields = ["id", "author", "body", "is_internal", "created_at"]

    def get_author(self, obj):
        return _user_brief(obj.author)


class TicketAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = TicketAttachment
        fields = ["id", "file_name", "file_size", "url", "uploaded_by", "created_at"]

    def get_uploaded_by(self, obj):
        return _user_brief(obj.uploaded_by)

    def get_url(self, obj):
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url


class TicketDetailSerializer(TicketListSerializer):
    resolved_by = serializers.SerializerMethodField()
    closed_by = serializers.SerializerMethodField()
    related_ticket = serializers.SerializerMethodField()
    events = TicketEventSerializer(many=True, read_only=True)
    comments = serializers.SerializerMethodField()
    attachments = TicketAttachmentSerializer(many=True, read_only=True)
    allowed_actions = serializers.SerializerMethodField()

    class Meta(TicketListSerializer.Meta):
        fields = TicketListSerializer.Meta.fields + [
            "description",
            "resolution_remark",
            "resolved_by",
            "closed_by",
            "close_type",
            "related_ticket",
            "events",
            "comments",
            "attachments",
            "allowed_actions",
        ]

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_resolved_by(self, obj):
        return _user_brief(obj.resolved_by)

    def get_closed_by(self, obj):
        return _user_brief(obj.closed_by)

    def get_related_ticket(self, obj):
        if obj.related_ticket_id is None:
            return None
        return {"id": str(obj.related_ticket_id), "ticket_no": obj.related_ticket.ticket_no}

    def get_comments(self, obj):
        rows = obj.comments.select_related("author")
        if not is_support_agent(self._user()):
            rows = rows.filter(is_internal=False)
        return TicketCommentSerializer(rows, many=True).data

    def get_allowed_actions(self, obj):
        """What the current user may do now, so the UI shows only valid buttons."""
        user = self._user()
        if user is None:
            return []
        is_raiser = obj.raised_by_id == user.id
        actions = []
        if is_raiser:
            if obj.status == TicketStatus.RESOLVED:
                actions += ["close", "reopen"]
            if obj.status == TicketStatus.OPEN:
                actions.append("cancel")
        elif is_support_agent(user):
            if obj.status in WORKABLE_STATUSES:
                actions += ["assign", "resolve"]
            if obj.status in (TicketStatus.OPEN, TicketStatus.ON_HOLD, TicketStatus.REOPENED):
                actions.append("start")
            if obj.status == TicketStatus.IN_PROGRESS:
                actions.append("hold")
        if obj.status not in (TicketStatus.CLOSED, TicketStatus.CANCELLED):
            actions.append("comment")
        return actions


class TicketCreateSerializer(serializers.Serializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=TicketCategory.objects.filter(is_active=True)
    )
    subject = serializers.CharField(max_length=200)
    description = serializers.CharField()
    priority = serializers.ChoiceField(choices=TicketPriority.choices, required=False)
    linked_type = serializers.ChoiceField(
        choices=sorted(LINKABLE_MODELS), required=False, allow_null=True
    )
    linked_id = serializers.UUIDField(required=False, allow_null=True)
    reference_text = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    related_ticket = serializers.PrimaryKeyRelatedField(
        queryset=Ticket.objects.all(), required=False, allow_null=True
    )

    def validate_related_ticket(self, value):
        user = self.context["request"].user
        if value is not None and value.raised_by_id != user.id and not is_support_agent(user):
            raise serializers.ValidationError("You can only follow up on your own tickets.")
        return value


class RemarkSerializer(serializers.Serializer):
    remark = serializers.CharField(required=False, allow_blank=True, default="")


class AssignSerializer(serializers.Serializer):
    assignee = serializers.UUIDField()


class CorrectionSerializer(serializers.Serializer):
    """Before → after values the IT user changed while fixing the issue."""

    field = serializers.CharField(max_length=100)
    before = serializers.CharField(max_length=255, allow_blank=True)
    after = serializers.CharField(max_length=255, allow_blank=True)


class ResolveSerializer(serializers.Serializer):
    remark = serializers.CharField()
    corrections = CorrectionSerializer(many=True, required=False)


class CommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField()
    is_internal = serializers.BooleanField(required=False, default=False)


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(validators=[validate_ticket_attachment])

    def validate_file(self, value):
        value.display_name = safe_attachment_display_name(value.name)
        return value
