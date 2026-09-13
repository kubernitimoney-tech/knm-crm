from rest_framework import serializers

from apps.accounts.models import RolePermissionChangeRecord


class RolePermissionChangeSerializer(serializers.Serializer):
    permission_code = serializers.CharField(max_length=100)
    confirm = serializers.BooleanField(default=False)
    approval_email = serializers.FileField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("confirm") and not attrs.get("approval_email"):
            raise serializers.ValidationError(
                {"approval_email": "Approval email is required before confirming."}
            )
        return attrs


class RolePermissionChangeRecordSerializer(serializers.ModelSerializer):
    role_slug = serializers.CharField(source="role.slug", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    permission_code = serializers.CharField(source="permission.code", read_only=True)
    permission_name = serializers.SerializerMethodField()
    module_name = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()
    actor_role = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()
    approval_email_url = serializers.SerializerMethodField()

    class Meta:
        model = RolePermissionChangeRecord
        fields = [
            "id",
            "timestamp",
            "actor_name",
            "actor_role",
            "action_type",
            "permission_name",
            "permission_code",
            "module_name",
            "role_name",
            "role_slug",
            "file_name",
            "file_size",
            "approval_email_url",
            "created_at",
        ]

    def get_permission_name(self, obj):
        from apps.accounts.services.role_permission_service import RolePermissionService

        return RolePermissionService._permission_label(obj.permission)

    def get_module_name(self, obj):
        from apps.accounts.models import PermissionModule

        return dict(PermissionModule.choices).get(obj.permission.module, obj.permission.module)

    def get_actor_name(self, obj):
        if not obj.performed_by:
            return "System"
        return obj.performed_by.get_full_name() or obj.performed_by.email

    def get_actor_role(self, obj):
        if not obj.performed_by:
            return "System"
        from apps.accounts.services.role_helpers import is_super_admin

        if is_super_admin(obj.performed_by):
            return "Super Admin"
        role = obj.performed_by.user_roles.select_related("role").first()
        return role.role.name if role else "User"

    def get_file_name(self, obj):
        if not obj.approval_email:
            return ""
        return obj.approval_email.name.split("/")[-1]

    def get_file_size(self, obj):
        if not obj.approval_email:
            return ""
        try:
            size = obj.approval_email.size
        except (FileNotFoundError, OSError, ValueError):
            return ""
        if size > 1024 * 1024:
            return f"{size / (1024 * 1024):.1f} MB"
        return f"{size // 1024} KB"

    def get_approval_email_url(self, obj):
        if not obj.approval_email:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.approval_email.url)
        return obj.approval_email.url

    action_type = serializers.CharField(source="action", read_only=True)
    timestamp = serializers.DateTimeField(source="created_at", read_only=True)
