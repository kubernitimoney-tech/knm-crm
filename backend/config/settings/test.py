import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from .base import *  # noqa: F403
from .base import _named_from_email

DEBUG = False
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# Local backend/.env must not leak Docker paths or SMTP into pytest.
MEDIA_ROOT = BASE_DIR / "media-test"
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
EMAIL_HOST = ""
DEFAULT_FROM_EMAIL = _named_from_email("noreply@test.local", BRAND_NAME)

DIGIO_ENV = "sandbox"
DIGIO_CLIENT_ID = "test-digio-client"
DIGIO_CLIENT_SECRET = "test-digio-secret"
DIGIO_WEBHOOK_SECRET = "test-digio-webhook"
DIGIO_KYC_TEMPLATE_NAME = "lms-video-kyc"
DIGIO_ESIGN_SIGN_TYPE = "aadhaar"
DIGIO_WEBHOOK_ALLOW_UNSIGNED = False
CASHFREE_CLIENT_SECRET = ""
CASHFREE_WEBHOOK_SECRET = "test-cashfree-webhook"
DIGIO_BASE_URL = "https://ext-api.digio.in"
DIGIO_GATEWAY_BASE_URL = "https://ext.digio.in"
FRONTEND_BASE_URL = "http://localhost:3000"
SMS_PROVIDER = "console"
SMS_API_KEY = ""
