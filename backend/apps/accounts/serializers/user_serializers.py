from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import RoleStatus
from apps.core.validators.drf_fields import BusinessEmailField, IndianMobileField

User = get_user_model()


class UserRoleSummarySerializer(serializers.Serializer):
    slug = serializers.CharField()
    name = serializers.CharField()
    display_name = serializers.CharField()
    assigned_at = serializers.DateTimeField()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "mobile_number",
            "employee_code",
            "is_active",
            "is_staff",
            "is_verified",
            "last_login",
            "created_at",
            "updated_at",
            "roles",
        ]
        read_only_fields = [
            "id",
            "employee_code",
            "last_login",
            "created_at",
            "updated_at",
            "roles",
            "full_name",
        ]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email

    def get_roles(self, obj):
        user_roles = obj.user_roles.select_related("role").filter(
            role__is_active=True, role__status=RoleStatus.ACTIVE
        )
        return [
            {
                "slug": ur.role.slug,
                "name": ur.role.name,
                "display_name": ur.role.get_display_name(),
                "assigned_at": ur.assigned_at,
            }
            for ur in user_roles
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    email = BusinessEmailField(field_label="Work email")
    password = serializers.CharField(write_only=True, min_length=8)
    mobile_number = IndianMobileField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "first_name",
            "last_name",
            "mobile_number",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(**validated_data, password=password)


class ResetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(required=False, min_length=8, write_only=True)
    confirm = serializers.BooleanField(default=False)
