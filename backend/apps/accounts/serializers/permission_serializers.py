from rest_framework import serializers

from apps.accounts.models import (
    PermissionAction,
    PermissionModule,
    PermissionStatus,
    UserPermission,
)


class CreatePermissionSerializer(serializers.Serializer):
    module = serializers.ChoiceField(choices=PermissionModule.choices)
    action = serializers.ChoiceField(choices=PermissionAction.choices)
    status = serializers.ChoiceField(
        choices=PermissionStatus.choices,
        default=PermissionStatus.ACTIVE,
        required=False,
    )


class UpdatePermissionSerializer(serializers.Serializer):
    module = serializers.ChoiceField(choices=PermissionModule.choices, required=False)
    action = serializers.ChoiceField(choices=PermissionAction.choices, required=False)
    status = serializers.ChoiceField(choices=PermissionStatus.choices, required=False)


class GrantPermissionSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    permission_code = serializers.CharField(max_length=100)
    confirm = serializers.BooleanField(default=False)
    approval_email = serializers.FileField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("confirm") and not attrs.get("approval_email"):
            raise serializers.ValidationError(
                {"approval_email": "Approval email is required before confirming."}
            )
        return attrs


class RevokePermissionSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    permission_code = serializers.CharField(max_length=100)
    confirm = serializers.BooleanField(default=False)
    approval_email = serializers.FileField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("confirm") and not attrs.get("approval_email"):
            raise serializers.ValidationError(
                {"approval_email": "Approval email is required before confirming."}
            )
        return attrs


class UserPermissionSerializer(serializers.ModelSerializer):
    permission_code = serializers.CharField(source="permission.code", read_only=True)

    class Meta:
        model = UserPermission
        fields = [
            "id",
            "permission_code",
            "granted_at",
            "is_active",
        ]
