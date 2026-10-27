from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import RoleStatus, UserApproval, UserProfile
from apps.core.validators.attachments import validate_approval_attachment
from apps.core.validators.drf_fields import BusinessEmailField, IndianMobileField
from apps.organization.models import Branch, BranchStatus

User = get_user_model()

REQUEST_REMARKS_MAX_LENGTH = 2000


def _user_label(user) -> str | None:
    if user is None:
        return None
    return user.get_full_name() or user.email


class UserRoleSummarySerializer(serializers.Serializer):
    slug = serializers.CharField()
    name = serializers.CharField()
    display_name = serializers.CharField()
    assigned_at = serializers.DateTimeField()


class UserApprovalSerializer(serializers.ModelSerializer):
    """Approval details. The attachment link is only included on request."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = UserApproval
        fields = [
            "status",
            "status_display",
            "request_remarks",
            "attachment_name",
            "attachment_url",
            "created_by",
            "created_by_name",
            "created_at",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "approver_remarks",
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        return _user_label(obj.created_by)

    def get_approved_by_name(self, obj):
        return _user_label(obj.approved_by)

    def get_attachment_url(self, obj):
        if not self.context.get("include_attachment_url") or not obj.attachment:
            return None
        # Signed, expiring link (apps.core.media.SignedMediaStorage).
        request = self.context.get("request")
        url = obj.attachment.url
        return request.build_absolute_uri(url) if request else url


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    mobile_number = serializers.SerializerMethodField()
    branch = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    approval = serializers.SerializerMethodField()
    joined_at = serializers.DateTimeField(source="created_at", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "middle_name",
            "last_name",
            "full_name",
            "display_name",
            "mobile_number",
            "branch",
            "address",
            "employee_code",
            "is_active",
            "is_staff",
            "is_verified",
            "must_change_password",
            "last_login",
            "joined_at",
            "created_at",
            "updated_at",
            "created_by_name",
            "updated_by_name",
            "roles",
            "approval",
        ]
        read_only_fields = fields

    @staticmethod
    def _profile(obj):
        return getattr(obj, "profile", None)

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email

    def get_mobile_number(self, obj):
        profile = self._profile(obj)
        return profile.mobile_number if profile else ""

    def get_branch(self, obj):
        profile = self._profile(obj)
        branch = profile.branch if profile else None
        if branch is None:
            return None
        return {"id": str(branch.id), "code": branch.branch_code, "name": branch.branch_name}

    def get_address(self, obj):
        profile = self._profile(obj)
        return profile.address if profile else ""

    def get_approval(self, obj):
        approval = getattr(obj, "approval", None)
        if approval is None:
            return None
        return UserApprovalSerializer(approval, context=self.context).data

    def get_created_by_name(self, obj):
        return _user_label(obj.created_by)

    def get_updated_by_name(self, obj):
        return _user_label(obj.updated_by)

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


def _clean_name(value: str) -> str:
    return " ".join((value or "").split())


class _ProfileFieldsMixin(serializers.Serializer):
    def validate_branch(self, branch):
        if branch is not None and branch.status != BranchStatus.ACTIVE:
            raise serializers.ValidationError("Select an active branch.")
        return branch

    def _validate_unique_mobile(self, mobile: str, *, exclude_user=None) -> None:
        if not mobile:
            return
        duplicates = UserProfile.objects.filter(mobile_number=mobile)
        if exclude_user is not None:
            duplicates = duplicates.exclude(user=exclude_user)
        if duplicates.exists():
            raise serializers.ValidationError(
                {"mobile_number": "Another user already has this mobile number."}
            )


class UserCreateSerializer(_ProfileFieldsMixin):
    """Multipart payload for the Add CRM User form (all four steps at once)."""

    # Step 1: identity
    email = BusinessEmailField(field_label="Email")
    first_name = serializers.CharField(max_length=150)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    display_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(
        required=False, allow_blank=True, write_only=True, trim_whitespace=False, max_length=128
    )
    # Step 2: profile
    mobile_number = IndianMobileField()
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all())
    address = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    # Step 3: role
    role_slug = serializers.SlugField(max_length=100, required=False, allow_blank=True)
    # Step 4: approval evidence
    attachment = serializers.FileField(validators=[validate_approval_attachment])
    request_remarks = serializers.CharField(max_length=REQUEST_REMARKS_MAX_LENGTH)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_first_name(self, value):
        value = _clean_name(value)
        if not value:
            raise serializers.ValidationError("First name is required.")
        return value

    def validate_middle_name(self, value):
        return _clean_name(value)

    def validate_last_name(self, value):
        return _clean_name(value)

    def validate_display_name(self, value):
        return _clean_name(value)

    def validate_request_remarks(self, value):
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError(
                "Please describe the request (at least 10 characters)."
            )
        return value

    def validate(self, attrs):
        self._validate_unique_mobile(attrs.get("mobile_number", ""))
        password = attrs.get("password") or ""
        if password:
            candidate = User(
                email=attrs["email"],
                first_name=attrs["first_name"],
                last_name=attrs.get("last_name", ""),
            )
            try:
                validate_password(password, user=candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs


class UserUpdateSerializer(_ProfileFieldsMixin):
    """Fields an admin may edit after creation. Email, username and status are fixed."""

    first_name = serializers.CharField(max_length=150, required=False)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    display_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    mobile_number = IndianMobileField(required=False)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False)
    address = serializers.CharField(max_length=1000, required=False, allow_blank=True)

    USER_FIELDS = ("first_name", "middle_name", "last_name", "display_name")
    PROFILE_FIELDS = ("mobile_number", "branch", "address")

    def validate_first_name(self, value):
        value = _clean_name(value)
        if not value:
            raise serializers.ValidationError("First name is required.")
        return value

    def validate_middle_name(self, value):
        return _clean_name(value)

    def validate_last_name(self, value):
        return _clean_name(value)

    def validate_display_name(self, value):
        return _clean_name(value)

    def validate(self, attrs):
        if "mobile_number" in attrs:
            self._validate_unique_mobile(attrs["mobile_number"], exclude_user=self.instance)
        return attrs

    def update(self, instance, validated_data):
        actor = self.context["request"].user
        user_changes = {f: validated_data[f] for f in self.USER_FIELDS if f in validated_data}
        profile_changes = {f: validated_data[f] for f in self.PROFILE_FIELDS if f in validated_data}
        for field, value in user_changes.items():
            setattr(instance, field, value)
        instance.updated_by = actor
        instance.save(update_fields=[*user_changes, "updated_by", "updated_at"])
        if profile_changes:
            UserProfile.objects.update_or_create(user=instance, defaults=profile_changes)
        return instance


class ApprovalDecisionSerializer(serializers.Serializer):
    remarks = serializers.CharField(
        max_length=REQUEST_REMARKS_MAX_LENGTH, required=False, allow_blank=True
    )


class ApprovalResubmitSerializer(serializers.Serializer):
    attachment = serializers.FileField(validators=[validate_approval_attachment])
    request_remarks = serializers.CharField(max_length=REQUEST_REMARKS_MAX_LENGTH)

    def validate_request_remarks(self, value):
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError(
                "Please describe the request (at least 10 characters)."
            )
        return value


class MeUpdateSerializer(serializers.ModelSerializer):
    """Fields a user may change on their own profile."""

    class Meta:
        model = User
        fields = ["display_name"]

    def validate_display_name(self, value):
        return value.strip()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)


class ResetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(required=False, min_length=10, write_only=True)
    confirm = serializers.BooleanField(default=False)
