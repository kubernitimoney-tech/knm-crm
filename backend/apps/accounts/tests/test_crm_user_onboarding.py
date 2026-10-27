from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers, status
from tests.factories import UserFactory

from apps.accounts.models import (
    Role,
    RoleChangeRecord,
    User,
    UserApproval,
    UserApprovalStatus,
    UserRole,
)
from apps.accounts.services.token_service import TokenService
from apps.accounts.usernames import generate_unique_username, username_base_from_email
from apps.core.validators.attachments import (
    APPROVAL_ATTACHMENT_MAX_BYTES,
    validate_approval_attachment,
)
from apps.organization.models import Branch

PDF_BYTES = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"
EML_BYTES = (
    b"From: head@kubernitimoney.com\r\nTo: hr@kubernitimoney.com\r\n"
    b"Subject: Approve CRM access\r\n\r\nApproved.\r\n"
)
REMARKS = "User created for CRM with role RM as per the attached approval mail."
STRONG_PASSWORD = "Str0ng!Passw0rd"


def _pdf(name="approval.pdf", content=PDF_BYTES):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


def _assign_role(user, slug: str) -> None:
    UserRole.objects.create(user=user, role=Role.objects.get(slug=slug))


def _client_for(api_client, user):
    tokens = TokenService.issue_tokens(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return api_client


@pytest.fixture
def branch(db):
    return Branch.objects.create(
        branch_code="MUM01",
        branch_name="Mumbai",
        bank_name="Kuberniti",
        address_line1="1 Main Road",
        city="Mumbai",
        state="Maharashtra",
        mobile_no="9876500000",
    )


@pytest.fixture
def maker(db):
    user = UserFactory(email="maker@kubernitimoney.com")
    _assign_role(user, "admin")
    return user


@pytest.fixture
def checker(db):
    user = UserFactory(email="checker@kubernitimoney.com")
    _assign_role(user, "admin")
    return user


def _payload(branch, /, **overrides):
    data = {
        "email": "Pankaj@KubernitiMoney.com",
        "first_name": "Pankaj",
        "last_name": "Yadav",
        "mobile_number": "9123400001",
        "branch": str(branch.pk),
        "address": "Andheri, Mumbai",
        "role_slug": "relationship-manager",
        "attachment": _pdf(),
        "request_remarks": REMARKS,
    }
    data.update(overrides)
    return data


def _create(api_client, maker, branch, /, **overrides):
    _client_for(api_client, maker)
    return api_client.post(reverse("user-list"), _payload(branch, **overrides), format="multipart")


class TestUsernames:
    def test_base_comes_from_email_local_part(self):
        assert username_base_from_email("Pankaj.Yadav@kubernitimoney.com") == "pankaj.yadav"
        assert username_base_from_email("a+b..c__d@x.com") == "ab.c.d"
        assert username_base_from_email("__@x.com") == "user"

    @pytest.mark.django_db
    def test_taken_username_gets_numeric_suffix(self):
        UserFactory(email="pankaj@one.com")
        assert generate_unique_username("pankaj@two.com") == "pankaj1"
        UserFactory(email="pankaj@two.com")
        assert generate_unique_username("pankaj@three.com") == "pankaj2"


class TestApprovalAttachmentValidation:
    def test_accepts_real_pdf_and_email(self):
        validate_approval_attachment(_pdf())
        validate_approval_attachment(SimpleUploadedFile("approval.eml", EML_BYTES))

    @pytest.mark.parametrize(
        ("name", "content"),
        [
            ("approval.pdf", b"<html><script>alert(1)</script></html>"),
            ("approval.png", PDF_BYTES),
            ("approval.eml", b"<html><body>From: a\nTo: b</body></html>"),
            ("approval.exe", PDF_BYTES),
            ("approval.pdf", b""),
        ],
    )
    def test_rejects_mismatched_or_unsupported_files(self, name, content):
        with pytest.raises(serializers.ValidationError):
            validate_approval_attachment(SimpleUploadedFile(name, content))

    def test_rejects_files_over_5_mb(self):
        big = _pdf(content=PDF_BYTES + b"0" * APPROVAL_ATTACHMENT_MAX_BYTES)
        with pytest.raises(serializers.ValidationError, match="5 MB"):
            validate_approval_attachment(big)


@pytest.mark.django_db
class TestCreateCrmUser:
    def test_creates_inactive_user_with_pending_approval(self, api_client, maker, branch):
        response = _create(api_client, maker, branch)

        assert response.status_code == status.HTTP_201_CREATED, response.data
        data = response.data["data"]
        assert data["username"] == "pankaj"
        assert data["email"] == "pankaj@kubernitimoney.com"
        assert data["approval"]["status"] == UserApprovalStatus.PENDING
        temporary_password = data["temporary_password"]
        assert temporary_password

        user = User.objects.get(email="pankaj@kubernitimoney.com")
        assert not user.is_active
        assert not user.is_verified
        assert user.must_change_password
        assert user.password_expires_at is None
        assert user.created_by == maker
        assert user.check_password(temporary_password)
        assert user.profile.mobile_number == "9123400001"
        assert user.profile.branch == branch

        approval = user.approval
        assert approval.created_by == maker
        assert approval.attachment_name == "approval.pdf"
        # Stored under a random name, never the uploaded one.
        assert "approval.pdf" not in approval.attachment.name

        assert UserRole.objects.filter(user=user, role__slug="relationship-manager").exists()
        role_record = RoleChangeRecord.objects.get(user=user)
        assert role_record.approval_email.name == approval.attachment.name

    def test_typed_password_is_not_echoed_back(self, api_client, maker, branch):
        response = _create(api_client, maker, branch, password=STRONG_PASSWORD)

        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data["data"]["temporary_password"] is None
        user = User.objects.get(email="pankaj@kubernitimoney.com")
        assert user.check_password(STRONG_PASSWORD)
        assert user.must_change_password

    def test_weak_password_is_rejected(self, api_client, maker, branch):
        response = _create(api_client, maker, branch, password="welcome@123")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data["errors"]
        assert not User.objects.filter(email="pankaj@kubernitimoney.com").exists()

    def test_username_suffix_when_taken(self, api_client, maker, branch):
        UserFactory(email="pankaj@other.com")
        response = _create(api_client, maker, branch)
        assert response.data["data"]["username"] == "pankaj1"

    @pytest.mark.parametrize(
        "overrides",
        [
            {"attachment": ""},
            {"attachment": _pdf(content=b"not a pdf")},
            {"request_remarks": ""},
            {"mobile_number": ""},
            {"branch": ""},
            {"first_name": ""},
        ],
    )
    def test_required_fields(self, api_client, maker, branch, overrides):
        response = _create(api_client, maker, branch, **overrides)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not User.objects.filter(email="pankaj@kubernitimoney.com").exists()

    def test_duplicate_email_ignoring_case_and_duplicate_mobile(self, api_client, maker, branch):
        UserFactory(email="pankaj@kubernitimoney.com")
        response = _create(api_client, maker, branch, email="PANKAJ@kubernitimoney.com")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data["errors"]

        other = UserFactory(email="someone@kubernitimoney.com")
        other.profile.mobile_number = "9123400099"
        other.profile.save()
        response = _create(
            api_client, maker, branch, email="new@kubernitimoney.com", mobile_number="9123400099"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "mobile_number" in response.data["errors"]

    def test_role_is_required_for_role_assigners(self, api_client, maker, branch):
        response = _create(api_client, maker, branch, role_slug="")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not User.objects.filter(email="pankaj@kubernitimoney.com").exists()

    def test_username_suggestion(self, api_client, maker):
        UserFactory(email="pankaj@other.com")
        _client_for(api_client, maker)
        response = api_client.get(
            reverse("user-username-suggestion"), {"email": "pankaj@kubernitimoney.com"}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"]["username"] == "pankaj1"


@pytest.mark.django_db
class TestApprovalDecisions:
    @pytest.fixture
    def pending_user(self, api_client, maker, branch):
        response = _create(api_client, maker, branch)
        api_client.credentials()
        return User.objects.get(pk=response.data["data"]["id"])

    def test_creator_cannot_approve_own_request(self, api_client, maker, pending_user):
        _client_for(api_client, maker)
        response = api_client.post(reverse("user-approve", kwargs={"pk": pending_user.pk}))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "another approver" in response.data["message"]
        pending_user.refresh_from_db()
        assert not pending_user.is_active

    def test_user_without_approve_permission_is_forbidden(self, api_client, pending_user):
        viewer = UserFactory()
        _assign_role(viewer, "relationship-manager")
        _client_for(api_client, viewer)
        response = api_client.post(reverse("user-approve", kwargs={"pk": pending_user.pk}))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_checker_approves_and_activates(self, api_client, checker, pending_user):
        _client_for(api_client, checker)
        response = api_client.post(
            reverse("user-approve", kwargs={"pk": pending_user.pk}),
            {"remarks": "Verified with HR"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        pending_user.refresh_from_db()
        assert pending_user.is_active
        assert pending_user.is_verified
        assert pending_user.password_expires_at > timezone.now()
        approval = pending_user.approval
        assert approval.status == UserApprovalStatus.APPROVED
        assert approval.approved_by == checker
        assert approval.approver_remarks == "Verified with HR"
        assert response.data["data"]["approval"]["attachment_url"]

        again = api_client.post(reverse("user-approve", kwargs={"pk": pending_user.pk}))
        assert again.status_code == status.HTTP_400_BAD_REQUEST

    def test_reject_requires_remarks_then_resubmit(self, api_client, maker, checker, pending_user):
        _client_for(api_client, checker)
        url = reverse("user-reject", kwargs={"pk": pending_user.pk})
        assert api_client.post(url, {}, format="json").status_code == 400

        response = api_client.post(url, {"remarks": "Mail not signed"}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        pending_user.refresh_from_db()
        assert not pending_user.is_active
        assert pending_user.approval.status == UserApprovalStatus.REJECTED

        _client_for(api_client, maker)
        response = api_client.post(
            reverse("user-resubmit-approval", kwargs={"pk": pending_user.pk}),
            {"attachment": _pdf("signed.pdf"), "request_remarks": REMARKS},
            format="multipart",
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        approval = UserApproval.objects.get(user=pending_user)
        assert approval.status == UserApprovalStatus.PENDING
        assert approval.approved_by is None
        assert approval.approver_remarks == ""
        assert approval.attachment_name == "signed.pdf"


@pytest.mark.django_db
class TestLoginAndForcedPasswordChange:
    def _login(self, api_client, email, password):
        api_client.credentials()
        return api_client.post(
            reverse("auth-login"), {"email": email, "password": password}, format="json"
        )

    def _onboard(self, api_client, maker, checker, branch, *, approve=True):
        response = _create(api_client, maker, branch)
        user = User.objects.get(pk=response.data["data"]["id"])
        password = response.data["data"]["temporary_password"]
        if approve:
            _client_for(api_client, checker)
            api_client.post(reverse("user-approve", kwargs={"pk": user.pk}))
        return user, password

    def test_pending_and_rejected_users_get_clear_messages(
        self, api_client, maker, checker, branch
    ):
        user, password = self._onboard(api_client, maker, checker, branch, approve=False)

        response = self._login(api_client, user.email, password)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "awaiting approval" in response.data["message"]

        _client_for(api_client, checker)
        api_client.post(
            reverse("user-reject", kwargs={"pk": user.pk}), {"remarks": "No"}, format="json"
        )
        response = self._login(api_client, user.email, password)
        assert "not approved" in response.data["message"]

    def test_wrong_password_does_not_reveal_account_state(self, api_client, maker, checker, branch):
        user, _ = self._onboard(api_client, maker, checker, branch, approve=False)
        response = self._login(api_client, user.email, "Wrong!Passw0rd")
        assert response.data["message"] == "Invalid credentials"

    def test_forced_change_blocks_api_until_password_changed(
        self, api_client, maker, checker, branch
    ):
        user, password = self._onboard(api_client, maker, checker, branch)

        response = self._login(api_client, "PANKAJ@kubernitimoney.com", password)
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["data"]["user"]["must_change_password"] is True
        access = response.data["data"]["tokens"]["access"]
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        blocked = api_client.get(reverse("user-list"))
        assert blocked.status_code == status.HTTP_403_FORBIDDEN
        assert blocked.data["errors"]["code"] == "password_change_required"
        assert api_client.get(reverse("auth-me")).status_code == status.HTTP_200_OK

        change_url = reverse("auth-change-password")
        wrong = api_client.post(
            change_url,
            {"current_password": "nope", "new_password": STRONG_PASSWORD},
            format="json",
        )
        assert wrong.status_code == status.HTTP_400_BAD_REQUEST
        weak = api_client.post(
            change_url,
            {"current_password": password, "new_password": "password"},
            format="json",
        )
        assert weak.status_code == status.HTTP_400_BAD_REQUEST

        changed = api_client.post(
            change_url,
            {"current_password": password, "new_password": STRONG_PASSWORD},
            format="json",
        )
        assert changed.status_code == status.HTTP_200_OK, changed.data
        assert changed.data["data"]["user"]["must_change_password"] is False
        user.refresh_from_db()
        assert not user.must_change_password
        assert user.password_changed_at is not None

        # The old token belonged to the previous session and no longer works.
        assert api_client.get(reverse("auth-me")).status_code == status.HTTP_401_UNAUTHORIZED
        new_access = changed.data["data"]["tokens"]["access"]
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {new_access}")
        assert api_client.get(reverse("auth-me")).status_code == status.HTTP_200_OK

    def test_expired_temporary_password_cannot_sign_in(self, api_client, maker, checker, branch):
        user, password = self._onboard(api_client, maker, checker, branch)
        User.objects.filter(pk=user.pk).update(
            password_expires_at=timezone.now() - timedelta(minutes=1)
        )
        response = self._login(api_client, user.email, password)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "expired" in response.data["message"]


@pytest.mark.django_db
class TestUserUpdate:
    def test_admin_can_edit_names_and_profile_but_not_status(self, api_client, maker, branch):
        target = UserFactory(email="target@kubernitimoney.com")
        _client_for(api_client, maker)
        response = api_client.patch(
            reverse("user-detail", kwargs={"pk": target.pk}),
            {
                "middle_name": "  Kumar ",
                "mobile_number": "9123400055",
                "branch": str(branch.pk),
                "is_active": False,
                "is_staff": True,
                "is_verified": False,
                "email": "hijack@kubernitimoney.com",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK, response.data
        target.refresh_from_db()
        assert target.middle_name == "Kumar"
        assert target.profile.mobile_number == "9123400055"
        assert target.profile.branch == branch
        assert target.is_active
        assert not target.is_staff
        assert target.email == "target@kubernitimoney.com"
        assert target.updated_by == maker

    def test_cannot_deactivate_self(self, api_client):
        super_admin = UserFactory()
        _assign_role(super_admin, "super-admin")
        _client_for(api_client, super_admin)
        response = api_client.delete(reverse("user-detail", kwargs={"pk": super_admin.pk}))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
