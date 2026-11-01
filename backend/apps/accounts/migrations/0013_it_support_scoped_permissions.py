from django.db import migrations

# Mirrors seed_permissions.IT_SUPPORT (kept literal: migrations must not import live code).
# View everything except user/role/permission admin, correct record details, never move money.
IT_SUPPORT_EXTRA_CODES = (
    "ticket.create",
    "ticket.assign",
    "ticket.resolve",
    "ticket.export",
    "call_log.update",
    "lead.update",
    "customer.update",
    "address.update",
    "company.update",
    "reference.update",
    "document.download",
    "lead.export",
    "sanction.export",
    "disbursal.export",
    "collection.export",
    "report.export",
)
IT_SUPPORT_EXCLUDED_VIEWS = ("user.view", "role.view", "permission.view")
# Admin tiers receive every non-delete code from seed_permissions, so call_log.update too.
CALL_LOG_UPDATE_SLUGS = ("super-admin", "admin", "production-manager")


def scope_it_support(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    RolePermission = apps.get_model("accounts", "RolePermission")
    UserRole = apps.get_model("accounts", "UserRole")

    call_log_update, _ = Permission.objects.get_or_create(
        module="call_log", action="update", defaults={"code": "call_log.update"}
    )
    for role in Role.objects.filter(slug__in=CALL_LOG_UPDATE_SLUGS):
        RolePermission.objects.get_or_create(role=role, permission=call_log_update)

    role = Role.objects.filter(slug="it-support").first()
    if role is not None:
        allowed = set(
            Permission.objects.filter(action="view")
            .exclude(code__in=IT_SUPPORT_EXCLUDED_VIEWS)
            .values_list("id", flat=True)
        )
        allowed |= set(
            Permission.objects.filter(code__in=IT_SUPPORT_EXTRA_CODES).values_list("id", flat=True)
        )
        RolePermission.objects.filter(role=role).exclude(permission_id__in=allowed).delete()
        for permission_id in allowed:
            RolePermission.objects.get_or_create(role=role, permission_id=permission_id)

    from apps.accounts.services.permission_cache import invalidate_user_permissions

    for user_id in UserRole.objects.values_list("user_id", flat=True).distinct():
        invalidate_user_permissions(user_id)


def remove_call_log_update(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Permission.objects.filter(code="call_log.update").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0012_ticket_permissions"),
    ]

    operations = [
        migrations.RunPython(scope_it_support, remove_call_log_update),
    ]
