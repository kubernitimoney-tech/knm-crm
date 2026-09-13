from rest_framework import serializers

from apps.accounts.models import RoleChangeRecord, UserRole


class AssignRoleSerializer(serializers.Serializer):
    role_slug = serializers.SlugField(max_length=100)
    confirm = serializers.BooleanField(default=False)
    replace_existing = serializers.BooleanField(default=True)
    approval_email = serializers.FileField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("confirm") and not attrs.get("approval_email"):
            raise serializers.ValidationError(
                {"approval_email": "Approval email attachment is required before confirming."}
            )
        return attrs


class RevokeRoleSerializer(serializers.Serializer):
    role_slug = serializers.SlugField(max_length=100)
    confirm = serializers.BooleanField(default=False)
    approval_email = serializers.FileField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("confirm") and not attrs.get("approval_email"):
            raise serializers.ValidationError(
                {"approval_email": "Approval email attachment is required before confirming."}
            )
        return attrs


class UserRoleSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(source="role.slug", read_only=True)
    name = serializers.CharField(source="role.name", read_only=True)
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = UserRole
        fields = ["slug", "name", "assigned_at", "assigned_by_name"]

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by:
            return None
        return obj.assigned_by.get_full_name() or obj.assigned_by.email


class RoleChangeRecordSerializer(serializers.ModelSerializer):
    role_slug = serializers.CharField(source="role.slug", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RoleChangeRecord
        fields = [
            "id",
            "role_slug",
            "role_name",
            "action",
            "performed_by_name",
            "created_at",
        ]

    def get_performed_by_name(self, obj):
        if not obj.performed_by:
            return None
        return obj.performed_by.get_full_name() or obj.performed_by.email
