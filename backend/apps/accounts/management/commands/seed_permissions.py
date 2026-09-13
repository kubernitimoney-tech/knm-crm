"""

Seeds all module × action permission combinations and default roles.

Run: python manage.py seed_permissions

By default this command is non-destructive for direct user grants (UserPermission).
Use --reset to wipe all UserPermission rows and rebuild RolePermission from scratch.

Notes:
- lead.assign is seeded for roster/transfer tooling; lead transfer API remains Admin-only
  (see LeadViewSet.transfer) — RM auto-assignment on intake does not require lead.assign.
- production-manager uses the admin template minus user create/update and permission
  view/grant/revoke (user directory management stays admin/super-admin).
- Sr. RM / Sr. CM org-wide visibility (see visible_applications_for / visible_loans_for)
  is intentional for multi-branch ops; branch-scoped tightening is a future epic.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import (
    Permission,
    PermissionAction,
    PermissionModule,
    Role,
    RolePermission,
    UserPermission,
    UserRole,
)
from apps.accounts.services.permission_cache import invalidate_user_permissions

# Valid module-action matrix (not every action applies to every module)

PERMISSION_MATRIX = {
    PermissionModule.LEAD: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
        PermissionAction.ASSIGN,
        PermissionAction.CONVERT,
        PermissionAction.EXPORT,
    ],
    PermissionModule.APPLICATION: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
        PermissionAction.SUBMIT,
        PermissionAction.APPROVE,
        PermissionAction.REJECT,
        PermissionAction.SANCTION,
    ],
    # Status-wise sanction lists (approved / pending / rejected / eNACH, etc.)
    PermissionModule.SANCTION: [
        PermissionAction.VIEW,
        PermissionAction.EXPORT,
    ],
    PermissionModule.DISBURSAL: [
        PermissionAction.VIEW,
        PermissionAction.SEND,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
        PermissionAction.EXPORT,
    ],
    PermissionModule.LOAN: [
        PermissionAction.VIEW,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
    ],
    PermissionModule.CALL_LOG: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
    ],
    PermissionModule.DOCUMENT: [
        PermissionAction.VIEW,
        PermissionAction.UPLOAD,
        PermissionAction.REUPLOAD,
        PermissionAction.DOWNLOAD,
        PermissionAction.DELETE,
    ],
    PermissionModule.ADDRESS: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
    ],
    PermissionModule.COMPANY: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
    ],
    PermissionModule.REFERENCE: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
    ],
    PermissionModule.CUSTOMER: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
    ],
    PermissionModule.WORKFLOW: [
        PermissionAction.VIEW,
        PermissionAction.UPDATE,
    ],
    PermissionModule.FIELD_INVESTIGATION: [
        PermissionAction.VIEW,
        PermissionAction.VERIFY,
        PermissionAction.UPDATE,
    ],
    PermissionModule.COLLECTION: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
        PermissionAction.EXPORT,
    ],
    PermissionModule.REDFLAG: [
        PermissionAction.VIEW,
        PermissionAction.EXPORT,
    ],
    PermissionModule.DASHBOARD: [PermissionAction.VIEW, PermissionAction.EXPORT],
    PermissionModule.REPORT: [PermissionAction.VIEW, PermissionAction.EXPORT],
    PermissionModule.USER: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
    ],
    PermissionModule.ROLE: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.DELETE,
    ],
    PermissionModule.PERMISSION: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
        PermissionAction.GRANT,
        PermissionAction.REVOKE,
        PermissionAction.DELETE,
    ],
    PermissionModule.AUDIT: [PermissionAction.VIEW, PermissionAction.DELETE],
}


VIEW_ONLY_PERMISSIONS = [
    f"{module.value}.{PermissionAction.VIEW.value}"
    for module in PermissionModule
    if PermissionAction.VIEW in PERMISSION_MATRIX.get(module, [])
]


BASE = ["dashboard.view"]


RM = BASE + [
    "lead.view",
    "call_log.view",
    "call_log.create",
]


SR_RM = RM + [
    "lead.convert",
    "application.view",
    "application.submit",
    "document.view",
    "document.upload",
    "document.reupload",
    "document.download",
    "address.view",
    "address.create",
    "company.view",
    "company.create",
    "reference.view",
    "reference.create",
]


CM = SR_RM + [
    "application.approve",
    "application.reject",
    "application.sanction",
    "sanction.view",
    "disbursal.view",
    "disbursal.send",
    "loan.view",
    "redflag.view",
    "redflag.export",
    "report.view",
    "address.update",
    "company.update",
    "reference.update",
]


ACCOUNT_FINANCE = BASE + [
    "disbursal.view",
    "disbursal.create",
    "loan.view",
    "document.view",
    "document.download",
    "collection.view",
    "collection.create",
    "collection.update",
    "collection.delete",
    "sanction.view",
    "sanction.export",
    "report.view",
]


COLLECTION_OFFICER = BASE + [
    "collection.view",
    "collection.create",
    "collection.update",
    "collection.delete",
    "loan.view",
]


FIELD_INVESTIGATOR = BASE + [
    "lead.view",
    "application.view",
    "field_investigation.view",
    "field_investigation.verify",
    "document.view",
]


ADMIN_EXCLUDED_CODES = frozenset(
    {
        "application.delete",
        "loan.update",
        "loan.delete",
        "collection.update",
        "collection.delete",
        "disbursal.update",
        "disbursal.delete",
    }
)

# Production Manager: full ops like Admin, but no user provisioning or RBAC admin.
PRODUCTION_MANAGER_EXCLUDED_CODES = frozenset(
    {
        "user.create",
        "user.update",
        "permission.view",
        "permission.create",
        "permission.update",
        "permission.grant",
        "permission.revoke",
    }
)


DEFAULT_ROLES = {
    "super-admin": {
        "name": "Super Admin",
        "display_name": "Super Admin",
        "permissions": "__all__",
    },
    "admin": {
        "name": "Admin",
        "display_name": "Administrator",
        "permissions": "__admin__",
    },
    "production-manager": {
        "name": "Production Manager",
        "display_name": "Prod. Manager",
        "permissions": "__production_manager__",
    },
    "relationship-manager": {
        "name": "Relationship Manager",
        "display_name": "RM",
        "permissions": RM,
    },
    "senior-relationship-manager": {
        "name": "Senior Relationship Manager",
        "display_name": "Sr. RM",
        "permissions": SR_RM,
    },
    "credit-manager": {
        "name": "Credit Manager",
        "display_name": "CM",
        "permissions": CM,
    },
    "senior-credit-manager": {
        "name": "Senior Credit Manager",
        "display_name": "Sr. CM",
        "permissions": CM,
    },
    "field-investigator": {
        "name": "Field Investigator",
        "display_name": "FI",
        "permissions": FIELD_INVESTIGATOR,
    },
    "account-finance": {
        "name": "Account & Finance",
        "display_name": "Finance",
        "permissions": ACCOUNT_FINANCE,
    },
    "collection-officer": {
        "name": "Collection Officer",
        "display_name": "Collection",
        "permissions": COLLECTION_OFFICER,
    },
    "auditor": {
        "name": "Auditor",
        "display_name": "Auditor",
        "permissions": VIEW_ONLY_PERMISSIONS,
    },
}


def _resolve_role_permissions(codes, all_perms: dict[str, Permission]) -> list[str]:
    if codes == "__all__":
        return list(all_perms.keys())

    if codes == "__admin__":
        resolved = [
            code
            for code in all_perms
            if not code.endswith(".delete") and code not in ADMIN_EXCLUDED_CODES
        ]
        if "audit.delete" in all_perms:
            resolved.append("audit.delete")
        return resolved

    if codes == "__production_manager__":
        admin_codes = _resolve_role_permissions("__admin__", all_perms)
        return [code for code in admin_codes if code not in PRODUCTION_MANAGER_EXCLUDED_CODES]

    return codes


class Command(BaseCommand):
    help = (
        "Seed RBAC permissions and default roles. "
        "Preserves UserPermission grants unless --reset is passed."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help=(
                "Destructive: delete all UserPermission grants and all RolePermission "
                "rows before re-seeding default role templates."
            ),
        )

    @transaction.atomic
    def handle(self, *args, **options):
        reset = options["reset"]
        valid_codes = {
            f"{module.value}.{action.value}"
            for module, actions in PERMISSION_MATRIX.items()
            for action in actions
        }

        if reset:
            RolePermission.objects.all().delete()
            UserPermission.objects.all().delete()
            self.stdout.write(
                self.style.WARNING("--reset: cleared all RolePermission and UserPermission rows.")
            )

        deleted, _ = Permission.objects.exclude(code__in=valid_codes).delete()

        if deleted:
            self.stdout.write(self.style.WARNING(f"Removed {deleted} obsolete permission row(s)."))

        created_count = 0

        for module, actions in PERMISSION_MATRIX.items():
            for action in actions:
                perm, created = Permission.objects.get_or_create(
                    module=module,
                    action=action,
                )

                if created:
                    created_count += 1

                perm.save()

        self.stdout.write(self.style.SUCCESS(f"Permissions synced. New: {created_count}"))

        all_perms = {p.code: p for p in Permission.objects.all()}

        for slug, config in DEFAULT_ROLES.items():
            role, _ = Role.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": config["name"],
                    "display_name": config["display_name"],
                },
            )

            update_fields = []
            if role.name != config["name"]:
                role.name = config["name"]
                update_fields.append("name")
            if role.display_name != config["display_name"]:
                role.display_name = config["display_name"]
                update_fields.append("display_name")
            if update_fields:
                role.save(update_fields=update_fields)

            RolePermission.objects.filter(role=role).delete()

            codes = list(dict.fromkeys(_resolve_role_permissions(config["permissions"], all_perms)))

            assigned = 0

            for code in codes:
                if code not in all_perms:
                    self.stdout.write(self.style.WARNING(f"Missing permission: {code}"))

                    continue

                RolePermission.objects.create(role=role, permission=all_perms[code])

                assigned += 1

            self.stdout.write(f"Role configured: {role.name} ({assigned} permissions)")

        for user_id in UserRole.objects.values_list("user_id", flat=True).distinct():
            invalidate_user_permissions(user_id)

        self.stdout.write(
            self.style.SUCCESS("Run completed. RBAC permission cache cleared for all role holders.")
        )
