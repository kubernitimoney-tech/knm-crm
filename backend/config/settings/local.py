from .base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    ".ngrok-free.dev",
    ".ngrok-free.app",
    ".ngrok.app",
    ".ngrok.io",
]

try:
    import debug_toolbar  # noqa: F401

    INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405
    MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")  # noqa: F405
except ImportError:
    pass

INTERNAL_IPS = ["127.0.0.1"]

CORS_ALLOWED_ORIGINS = [  # noqa: F405
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
CORS_ALLOW_CREDENTIALS = True  # noqa: F405
