"""User account operations (password reset, etc.)."""

from __future__ import annotations

import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.accounts.services.role_helpers import is_super_admin
from apps.accounts.services.token_service import TokenService


class UserServiceError(Exception):
    def __init__(self, message: str, *, requires_confirmation: bool = False):
        super().__init__(message)
        self.requires_confirmation = requires_confirmation


class UserService:
    CONFIRMATION_MESSAGE = "Are you sure you want to reset this user's password?"

    @staticmethod
    def generate_temporary_password(*, length: int = 12) -> str:
        alphabet = string.ascii_letters + string.digits
        while True:
            password = "".join(secrets.choice(alphabet) for _ in range(length))
            if (
                any(char.islower() for char in password)
                and any(char.isupper() for char in password)
                and any(char.isdigit() for char in password)
            ):
                return f"{password}!"

    @classmethod
    def reset_password(
        cls,
        *,
        actor,
        target_user,
        password: str | None = None,
        confirm: bool = False,
    ) -> str:
        if not is_super_admin(actor):
            raise UserServiceError("Only Super Admin can reset user passwords.")
        if not confirm:
            raise UserServiceError(cls.CONFIRMATION_MESSAGE, requires_confirmation=True)
        if target_user.id == actor.id:
            raise UserServiceError("You cannot reset your own password from this screen.")
        if not target_user.is_active:
            raise UserServiceError("Cannot reset password for an inactive account.")

        new_password = (password or "").strip() or cls.generate_temporary_password()
        try:
            validate_password(new_password, user=target_user)
        except ValidationError as exc:
            raise UserServiceError("; ".join(exc.messages)) from exc

        with transaction.atomic():
            target_user.set_password(new_password)
            # An admin-issued password is temporary: the user must replace it at
            # the next sign-in, and it stops working if left unused.
            target_user.must_change_password = True
            target_user.password_expires_at = timezone.now() + timedelta(
                hours=settings.TEMPORARY_PASSWORD_TTL_HOURS
            )
            target_user.updated_by = actor
            target_user.save(
                update_fields=[
                    "password",
                    "must_change_password",
                    "password_expires_at",
                    "updated_by",
                    "updated_at",
                ]
            )
            TokenService.invalidate_existing_sessions(target_user)

        return new_password
