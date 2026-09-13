from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.accounts.models import RolePermission, UserPermission, UserRole
from apps.accounts.services.permission_cache import (
    invalidate_role_users,
    invalidate_user_permissions,
)


@receiver(post_save, sender=UserRole)
@receiver(post_delete, sender=UserRole)
def invalidate_on_user_role_change(sender, instance, **kwargs):
    invalidate_user_permissions(instance.user_id)


@receiver(post_save, sender=RolePermission)
@receiver(post_delete, sender=RolePermission)
def invalidate_on_role_permission_change(sender, instance, **kwargs):
    invalidate_role_users(instance.role_id)


@receiver(post_save, sender=UserPermission)
@receiver(post_delete, sender=UserPermission)
def invalidate_on_user_permission_change(sender, instance, **kwargs):
    invalidate_user_permissions(instance.user_id)
