from .base import *  # noqa: F403

DEBUG = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Origins allowed for CSRF-protected POSTs (e.g. Django admin login) when
# running behind an HTTPS-terminating proxy. Comma-separated, full scheme+host.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])  # noqa: F405

# Container health checks call Django directly at 127.0.0.1:8000 (deploy script
# and docker-compose healthcheck). Public traffic only reaches Django through
# Caddy, which routes by real hostname, so these never match outside requests.
for _internal_host in ("localhost", "127.0.0.1"):
    if _internal_host not in ALLOWED_HOSTS:  # noqa: F405
        ALLOWED_HOSTS.append(_internal_host)  # noqa: F405
# The health check is plain HTTP inside the container; don't redirect it to HTTPS.
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$"]

# Caddy is the single proxy in front of Django and rewrites X-Forwarded-For
# with the real client address, so trust exactly one hop.
REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    "NUM_PROXIES": env.int("NUM_PROXIES", default=1),  # noqa: F405
}

# Never seed the README demo passwords on a deployed server.
ALLOW_DEMO_PASSWORDS = False

# PAN/Aadhaar/account numbers must use a dedicated key, not one derived from
# SECRET_KEY. See README → "Field encryption key" before the first deploy.
if not FIELD_ENCRYPTION_KEY:  # noqa: F405
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured(
        "FIELD_ENCRYPTION_KEY must be set on deployed servers. To keep existing "
        "encrypted data readable, set it to the key currently derived from "
        "SECRET_KEY (see README, 'Field encryption key')."
    )
