"""Role and permission helpers for access-control rules."""

from apps.accounts.models import RoleStatus, UserRole

SUPER_ADMIN_SLUG = "super-admin"
ADMIN_SLUG = "admin"
PRODUCTION_MANAGER_SLUG = "production-manager"
ADMIN_LEVEL_SLUGS = frozenset({ADMIN_SLUG, PRODUCTION_MANAGER_SLUG})

RELATIONSHIP_MANAGER_SLUGS = frozenset({"relationship-manager", "senior-relationship-manager"})
CREDIT_MANAGER_SLUGS = frozenset({"credit-manager", "senior-credit-manager"})
FIELD_INVESTIGATOR_SLUG = "field-investigator"
FIELD_INVESTIGATOR_SLUGS = frozenset({FIELD_INVESTIGATOR_SLUG})
SENIOR_RELATIONSHIP_MANAGER_SLUG = "senior-relationship-manager"
SENIOR_CREDIT_MANAGER_SLUG = "senior-credit-manager"
RELATIONSHIP_MANAGER_SLUG = "relationship-manager"
CREDIT_MANAGER_SLUG = "credit-manager"
ACCOUNT_FINANCE_SLUG = "account-finance"
COLLECTION_OFFICER_SLUG = "collection-manager"
COLLECTION_OFFICER_SLUGS = frozenset({COLLECTION_OFFICER_SLUG})

DELETE_ACTION_SUFFIX = ".delete"


def is_delete_permission_code(code: str | None) -> bool:
    """True for any matrix code with the delete action (e.g. lead.delete, audit.delete)."""
    return bool(code) and str(code).endswith(DELETE_ACTION_SUFFIX)


def can_modify_delete_permissions(user) -> bool:
    """Only Super Admin may grant or revoke delete permissions on roles or users."""
    return is_super_admin(user)


# Roles that Admin may assign (Admin cannot assign Super Admin).
ADMIN_ASSIGNABLE_ROLE_SLUGS = frozenset(
    {
        ADMIN_SLUG,
        PRODUCTION_MANAGER_SLUG,
        "relationship-manager",
        "senior-relationship-manager",
        "credit-manager",
        "senior-credit-manager",
        "field-investigator",
        "account-finance",
        "collection-manager",
        "auditor",
    }
)

ALL_ROLE_SLUGS = frozenset({SUPER_ADMIN_SLUG, *ADMIN_ASSIGNABLE_ROLE_SLUGS})


def user_has_role_slug(user, slug: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    return UserRole.objects.filter(
        user_id=user.id,
        role__slug=slug,
        role__is_active=True,
        role__status=RoleStatus.ACTIVE,
    ).exists()


def get_active_users_with_role_slug(slug: str):
    from apps.accounts.models import User

    user_ids = UserRole.objects.filter(
        role__slug=slug,
        role__is_active=True,
        role__status=RoleStatus.ACTIVE,
    ).values_list("user_id", flat=True)
    return User.objects.filter(id__in=user_ids, is_active=True).order_by(
        "first_name",
        "last_name",
        "email",
    )


def is_super_admin(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user_has_role_slug(user, SUPER_ADMIN_SLUG))
    )


def is_admin_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    return UserRole.objects.filter(
        user_id=user.id,
        role__slug__in=ADMIN_LEVEL_SLUGS,
        role__is_active=True,
        role__status=RoleStatus.ACTIVE,
    ).exists()


def is_admin_or_super_admin(user) -> bool:
    return is_super_admin(user) or is_admin_user(user)


def is_production_manager(user) -> bool:
    return user_has_role_slug(user, PRODUCTION_MANAGER_SLUG)


def can_change_sanction_product(user) -> bool:
    """Loan product on the sanction form is locked except Super Admin and Production Manager."""
    return is_super_admin(user) or is_production_manager(user)


def is_senior_relationship_manager(user) -> bool:
    return user_has_role_slug(user, SENIOR_RELATIONSHIP_MANAGER_SLUG)


def is_senior_credit_manager(user) -> bool:
    return user_has_role_slug(user, SENIOR_CREDIT_MANAGER_SLUG)


def is_relationship_manager(user) -> bool:
    return user_has_role_slug(user, RELATIONSHIP_MANAGER_SLUG)


def is_credit_manager(user) -> bool:
    return user_has_role_slug(user, CREDIT_MANAGER_SLUG)


def is_account_finance(user) -> bool:
    return user_has_role_slug(user, ACCOUNT_FINANCE_SLUG)


def is_collection_officer(user) -> bool:
    return user_has_role_slug(user, COLLECTION_OFFICER_SLUG)


def can_view_all_collection_pipeline_loans(user) -> bool:
    """Collection officers and account & finance see every disbursed loan in collection stages."""
    return (
        is_super_admin(user)
        or is_admin_user(user)
        or is_collection_officer(user)
        or is_account_finance(user)
    )


def user_has_permission(user, code: str) -> bool:
    """True when the user holds a permission code (super-admin bypass included)."""
    if is_super_admin(user):
        return True
    from apps.accounts.services.permission_cache import resolve_user_permissions

    return code in resolve_user_permissions(user)


def can_manage_permissions(user) -> bool:
    """Super Admin and Admin may grant/revoke permissions."""
    if is_super_admin(user):
        return True
    from apps.accounts.services.permission_cache import resolve_user_permissions

    perms = resolve_user_permissions(user)
    return "permission.grant" in perms and "permission.revoke" in perms


def can_delete_data(user) -> bool:
    """
    True when the user holds any `*.delete` permission (or is Super Admin).

    Prefer checking a concrete code (e.g. lead.delete) at call sites.
    Kept for coarse UI flags and legacy callers.
    """
    if is_super_admin(user):
        return True
    from apps.accounts.services.permission_cache import resolve_user_permissions

    return any(code.endswith(".delete") for code in resolve_user_permissions(user))


def can_create_users(user) -> bool:
    """Only Super Admin and Admin may create users."""
    if is_super_admin(user):
        return True
    from apps.accounts.services.permission_cache import resolve_user_permissions

    return "user.create" in resolve_user_permissions(user)


def can_assign_roles(user) -> bool:
    """Only Super Admin and Admin may assign roles to other users."""
    return is_super_admin(user) or is_admin_user(user)


def get_assignable_role_slugs(actor) -> set[str]:
    if is_super_admin(actor):
        return set(ALL_ROLE_SLUGS)
    if is_admin_user(actor):
        return set(ADMIN_ASSIGNABLE_ROLE_SLUGS)
    return set()


def actor_can_assign_role_slug(actor, role_slug: str) -> bool:
    return role_slug in get_assignable_role_slugs(actor)
