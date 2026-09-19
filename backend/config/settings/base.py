"""
Base settings shared across all environments.

Design: split settings by environment (local/staging/production) so secrets
and infrastructure bindings never leak into code. django-environ reads .env
files and process env vars with a single typed API.
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    JWT_ACCESS_TOKEN_LIFETIME_MINUTES=(int, 30),
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=(int, 7),
)

# overwrite=True: a mounted .env wins over stale empty EMAIL_* vars baked into
# the container when Compose first created it from a blank env_file.
environ.Env.read_env(BASE_DIR / ".env", overwrite=True)

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

# Field-level encryption for PII (PAN/Aadhaar). Falls back to a key derived
# from SECRET_KEY when unset so local/dev works without extra configuration.
FIELD_ENCRYPTION_KEY = env("FIELD_ENCRYPTION_KEY", default="")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "django_celery_beat",
    # LMS apps
    "apps.core.apps.CoreConfig",
    "apps.accounts",
    "apps.organization",
    "apps.customers",
    "apps.products",
    "apps.leads",
    "apps.applications",
    "apps.underwriting",
    "apps.loans",
    "apps.ledger",
    "apps.repayments",
    "apps.collections",
    "apps.documents",
    "apps.workflow",
    "apps.activities",
    "apps.notifications",
    "apps.audit_logs",
    "apps.dashboard",
    "apps.reports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit_logs.middleware.AuditContextMiddleware",
    "apps.audit_logs.middleware.UserActivityLoggingMiddleware",
    "apps.core.middleware.ResponseWrapperMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

AUTH_USER_MODEL = "accounts.User"

DATABASES = {
    "default": env.db(
        "DATABASE_URL", default="postgres://lms_user:lms_password@localhost:5432/lms"
    ),
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-in"
TIME_ZONE = env("TIME_ZONE", default="Asia/Kolkata")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
MEDIA_URL = env("MEDIA_URL", default="/media/")
MEDIA_ROOT = env.path("MEDIA_ROOT", default=BASE_DIR / "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Redis
REDIS_URL = env("REDIS_URL", default="redis://127.0.0.1:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
        "KEY_PREFIX": "lms",
    }
}

# Celery
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://127.0.0.1:6379/1")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://127.0.0.1:6379/2")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.jwt_authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
}

# JWT (SimpleJWT config used by our custom auth layer)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_TOKEN_LIFETIME_MINUTES")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_TOKEN_LIFETIME_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# RBAC cache key pattern
RBAC_PERMISSION_CACHE_PREFIX = "user"
RBAC_PERMISSION_CACHE_TTL = 3600  # 1 hour

# CORS
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# Loan workflow default slug
DEFAULT_LOAN_WORKFLOW_SLUG = "loan-lifecycle"


def _env_str(name, default=""):
    """Blank env values (common in Docker env_file) should not win over defaults."""
    value = (env(name, default=default) or "").strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1].strip()
    return value


def _named_from_email(value: str, brand: str) -> str:
    """Ensure From is ``Name <addr>`` so clients show the brand, not a bare address."""
    from email.utils import formataddr, parseaddr

    name, addr = parseaddr((value or "").strip())
    if not addr:
        return (value or "").strip()
    return formataddr((name or brand, addr))


# Email (SMTP). Set EMAIL_HOST to enable outbound mail; leave empty for console backend.
EMAIL_HOST = _env_str("EMAIL_HOST")
if EMAIL_HOST:
    EMAIL_BACKEND = env(
        "EMAIL_BACKEND",
        default="django.core.mail.backends.smtp.EmailBackend",
    )
    EMAIL_PORT = env.int("EMAIL_PORT", default=587)
    EMAIL_HOST_USER = _env_str("EMAIL_HOST_USER")
    EMAIL_HOST_PASSWORD = _env_str("EMAIL_HOST_PASSWORD")
    EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
    EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
    EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=30)
    DEFAULT_FROM_EMAIL = _env_str("DEFAULT_FROM_EMAIL") or EMAIL_HOST_USER or "noreply@localhost"
    SERVER_EMAIL = _env_str("SERVER_EMAIL") or DEFAULT_FROM_EMAIL
else:
    EMAIL_BACKEND = env(
        "EMAIL_BACKEND",
        default="django.core.mail.backends.console.EmailBackend",
    )
    DEFAULT_FROM_EMAIL = _env_str("DEFAULT_FROM_EMAIL") or "noreply@localhost"
    SERVER_EMAIL = _env_str("SERVER_EMAIL") or DEFAULT_FROM_EMAIL

# Branding used in transactional emails.
BRAND_NAME = env("BRAND_NAME", default="Kuberniti Money")
SUPPORT_EMAIL = env("SUPPORT_EMAIL", default="support@kubernitimoney.com")
# Matches CRM portal --color-primary-deep / --color-secondary-dark.
BRAND_PRIMARY_COLOR = env("BRAND_PRIMARY_COLOR", default="#2A2D4F")
BRAND_SECONDARY_COLOR = env("BRAND_SECONDARY_COLOR", default="#424665")
BRAND_BG_COLOR = env("BRAND_BG_COLOR", default="#F4F6F9")
EMAIL_LOGO_PATH = env("EMAIL_LOGO_PATH", default=str(BASE_DIR / "static" / "emails" / "logo.png"))
SANCTION_MAILBOX_EMAIL = _env_str("SANCTION_MAILBOX_EMAIL") or "sanction@kubernitimoney.com"
DISBURSAL_MAILBOX_EMAIL = _env_str("DISBURSAL_MAILBOX_EMAIL") or "disbursal@kubernitimoney.com"
CONFIRMATION_MAILBOX_EMAIL = (
    _env_str("CONFIRMATION_MAILBOX_EMAIL") or "confirmation@kubernitimoney.com"
)
DEFAULT_FROM_EMAIL = _named_from_email(DEFAULT_FROM_EMAIL, BRAND_NAME)
SERVER_EMAIL = _named_from_email(SERVER_EMAIL, BRAND_NAME)
SANCTION_FROM_EMAIL = _named_from_email(
    _env_str("SANCTION_FROM_EMAIL") or SANCTION_MAILBOX_EMAIL,
    BRAND_NAME,
)
DISBURSAL_FROM_EMAIL = _named_from_email(
    _env_str("DISBURSAL_FROM_EMAIL") or DISBURSAL_MAILBOX_EMAIL,
    BRAND_NAME,
)

# Optional SMS for Video KYC invitation links (customer mobile).
# Fast2SMS: SMS_PROVIDER=fast2sms and SMS_API_KEY=<authorization key>
# MSG91: SMS_PROVIDER=msg91, SMS_API_KEY=<authkey>, SMS_SENDER_ID=KNMCRM
# Leave SMS_PROVIDER empty or "console" to log SMS instead of sending.
SMS_PROVIDER = _env_str("SMS_PROVIDER")
SMS_API_KEY = _env_str("SMS_API_KEY")
SMS_TEMPLATE_ID = _env_str("SMS_TEMPLATE_ID")
SMS_SENDER_ID = _env_str("SMS_SENDER_ID") or "KNMCRM"

# Document virus scan hook (plug in ClamAV etc.)
DOCUMENT_VIRUS_SCAN_ENABLED = env.bool("DOCUMENT_VIRUS_SCAN_ENABLED", default=False)

# Digio e-sign + video KYC. Sandbox API: https://ext-api.digio.in  Production API: https://api.digio.in
DIGIO_ENV = env("DIGIO_ENV", default="sandbox").strip().lower()
DIGIO_CLIENT_ID = env("DIGIO_CLIENT_ID", default="")
DIGIO_CLIENT_SECRET = env("DIGIO_CLIENT_SECRET", default="")
DIGIO_WEBHOOK_SECRET = env("DIGIO_WEBHOOK_SECRET", default="")
DIGIO_KYC_TEMPLATE_NAME = _env_str("DIGIO_KYC_TEMPLATE_NAME")
DIGIO_ESIGN_SIGN_TYPE = env("DIGIO_ESIGN_SIGN_TYPE", default="aadhaar")
FRONTEND_BASE_URL = _env_str("FRONTEND_BASE_URL") or "http://localhost:3000"
DIGIO_WEBHOOK_ALLOW_UNSIGNED = env.bool("DIGIO_WEBHOOK_ALLOW_UNSIGNED", default=False)
_DIGIO_PRODUCTION = DIGIO_ENV in {"production", "prod", "live"}
DIGIO_BASE_URL = env(
    "DIGIO_BASE_URL",
    default="https://api.digio.in" if _DIGIO_PRODUCTION else "https://ext-api.digio.in",
)
DIGIO_GATEWAY_BASE_URL = env(
    "DIGIO_GATEWAY_BASE_URL",
    default="https://app.digio.in" if _DIGIO_PRODUCTION else "https://ext.digio.in",
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}
