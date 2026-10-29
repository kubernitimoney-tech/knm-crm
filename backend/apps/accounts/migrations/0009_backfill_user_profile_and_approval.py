"""
Carry existing users into the CRM user model.

Existing users are carried over unchanged in behaviour:
- email is lowercased (skipped if that would collide with another account),
- username is generated from the email (pankaj, pankaj1, ...),
- mobile_number moves to UserProfile,
- an approved "legacy" UserApproval is created and is_verified is set,
so nobody is locked out by the new approval check.
"""

import re

import django.utils.timezone
from django.conf import settings
from django.db import migrations

LEGACY_REMARKS = "Existing user, created before CRM user approval was introduced."
_DISALLOWED_CHARS = re.compile(r"[^a-z0-9._]+")
_REPEATED_SEPARATORS = re.compile(r"[._]{2,}")


def _username_base(email: str) -> str:
    # Frozen copy of apps.accounts.usernames.username_base_from_email.
    local_part = (email or "").strip().lower().split("@", 1)[0]
    base = _DISALLOWED_CHARS.sub("", local_part)
    base = _REPEATED_SEPARATORS.sub(".", base).strip("._")
    return base[:26].rstrip("._") or "user"


def forwards(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    UserProfile = apps.get_model("accounts", "UserProfile")
    UserApproval = apps.get_model("accounts", "UserApproval")
    now = django.utils.timezone.now()

    lowered_counts: dict[str, int] = {}
    for email in User.objects.values_list("email", flat=True):
        lowered_counts[email.lower()] = lowered_counts.get(email.lower(), 0) + 1

    used_usernames: set[str] = set()
    for user in User.objects.order_by("created_at", "id"):
        lowered = user.email.strip().lower()
        if lowered != user.email and lowered_counts.get(lowered, 0) == 1:
            user.email = lowered

        base = _username_base(user.email)
        candidate, suffix = base, 0
        while candidate in used_usernames:
            suffix += 1
            candidate = f"{base}{suffix}"
        used_usernames.add(candidate)
        user.username = candidate
        user.is_verified = True
        user.save(update_fields=["email", "username", "is_verified"])

        UserProfile.objects.create(user=user, mobile_number=user.mobile_number or "")
        UserApproval.objects.create(
            user=user,
            request_remarks=LEGACY_REMARKS,
            status="approved",
            created_at=user.created_at or now,
            approved_at=now,
        )


def backwards(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    UserProfile = apps.get_model("accounts", "UserProfile")
    for profile in UserProfile.objects.all():
        User.objects.filter(pk=profile.user_id).update(mobile_number=profile.mobile_number)


def grant_user_approve(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    RolePermission = apps.get_model("accounts", "RolePermission")
    UserRole = apps.get_model("accounts", "UserRole")

    permission, _ = Permission.objects.get_or_create(
        code="user.approve",
        defaults={
            "module": "user",
            "action": "approve",
            "description": "Approve or reject new CRM users",
        },
    )
    role_ids = []
    for role in Role.objects.filter(slug__in=["super-admin", "admin"]):
        RolePermission.objects.get_or_create(role=role, permission=permission)
        role_ids.append(role.pk)

    # Drop cached permission sets so the new code applies immediately.
    try:
        from django.core.cache import cache

        prefix = settings.RBAC_PERMISSION_CACHE_PREFIX
        for user_id in UserRole.objects.filter(role_id__in=role_ids).values_list(
            "user_id", flat=True
        ):
            cache.delete(f"{prefix}:{user_id}:permissions")
    except Exception:  # noqa: BLE001 - cache may be unavailable during migrate
        pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0008_user_profile_and_approval"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.RunPython(grant_user_approve, migrations.RunPython.noop),
    ]
