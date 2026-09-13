class DigioError(Exception):
    """Base error for Digio adapter failures."""


class DigioConfigurationError(DigioError):
    """Raised when Digio credentials or required template settings are missing."""


class DigioAPIError(DigioError):
    """Raised when Digio returns a non-success HTTP response."""

    def __init__(self, message: str, *, status_code: int | None = None, body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class DigioValidationError(DigioError):
    """Raised when LMS data is insufficient to create a Digio request."""
