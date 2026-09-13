from django.utils.text import slugify
from rest_framework import serializers

from apps.accounts.models import Permission, Role, RoleStatus
from apps.accounts.services.role_helpers import SUPER_ADMIN_SLUG


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "module", "action", "code", "description", "status"]


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Role
        fields = [
            "id",
            "name",
            "display_name",
            "slug",
            "description",
            "is_active",
            "status",
            "permissions",
            "created_at",
        ]
        read_only_fields = ["id", "is_active", "permissions", "created_at"]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
            "display_name": {"required": False, "allow_blank": True},
            "description": {"required": False, "allow_blank": True},
            "status": {"required": False},
        }

    def get_permissions(self, obj):
        perms = [rp.permission for rp in obj.role_permissions.select_related("permission").all()]
        return PermissionSerializer(perms, many=True).data

    def validate_slug(self, value: str) -> str:
        slug = slugify((value or "").strip())
        if not slug:
            return slug
        if slug == SUPER_ADMIN_SLUG:
            raise serializers.ValidationError("Cannot create or use the Super Admin role slug.")
        return slug

    def validate_name(self, value: str) -> str:
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("Role name is required.")
        return name

    def validate(self, attrs):
        attrs = super().validate(attrs)
        name = attrs.get("name")
        if name is None and self.instance is not None:
            name = self.instance.name
        elif name is not None:
            name = name.strip()
            attrs["name"] = name

        slug = attrs.get("slug")
        if slug is None and self.instance is not None:
            slug = self.instance.slug
        else:
            raw = (slug or "").strip() if slug is not None else ""
            if not raw and name:
                raw = name
            slug = slugify(raw)
            attrs["slug"] = slug

        if not attrs.get("slug") and not (self.instance and self.instance.slug):
            raise serializers.ValidationError(
                {"slug": "Could not generate a valid slug from the role name."}
            )

        qs = Role.objects.all()
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)

        check_slug = attrs.get("slug") or (self.instance.slug if self.instance else "")
        if check_slug and qs.filter(slug=check_slug).exists():
            raise serializers.ValidationError(
                {"slug": f"A role with slug '{check_slug}' already exists."}
            )

        check_name = attrs.get("name") or (self.instance.name if self.instance else "")
        if check_name and qs.filter(name__iexact=check_name).exists():
            raise serializers.ValidationError(
                {"name": f"A role named '{check_name}' already exists."}
            )

        status = attrs.get("status")
        if status is not None and status not in RoleStatus.values:
            raise serializers.ValidationError({"status": "Invalid status."})

        return attrs

    def create(self, validated_data):
        validated_data.setdefault("status", RoleStatus.ACTIVE)
        validated_data.setdefault("is_active", True)
        if not validated_data.get("display_name"):
            validated_data["display_name"] = validated_data.get("name", "")[:50]
        return super().create(validated_data)
