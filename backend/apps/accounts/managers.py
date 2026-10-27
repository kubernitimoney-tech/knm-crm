from django.contrib.auth.base_user import BaseUserManager

# Accepted by create_user for convenience but stored on UserProfile.
PROFILE_FIELDS = ("mobile_number", "branch", "address")


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        profile_fields = {
            field: extra_fields.pop(field) for field in PROFILE_FIELDS if field in extra_fields
        }
        email = self.normalize_email(email).strip().lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        if profile_fields:
            from apps.accounts.models import UserProfile

            UserProfile.objects.using(self._db).update_or_create(user=user, defaults=profile_fields)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_verified", True)
        return self.create_user(email, password, **extra_fields)
