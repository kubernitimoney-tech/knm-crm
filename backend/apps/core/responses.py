"""
Global API response envelope.

All successful and error payloads share shape so frontends and
integrators parse one contract. DRF renderers are bypassed for
final shape via ResponseWrapperMiddleware + custom exception handler.
"""

from typing import Any

from rest_framework import status
from rest_framework.response import Response


def success_response(
    data: Any = None,
    message: str = "",
    status_code: int = status.HTTP_200_OK,
    headers: dict | None = None,
) -> Response:
    payload = {
        "success": True,
        "message": message,
        "data": data if data is not None else {},
    }
    return Response(payload, status=status_code, headers=headers)


def error_response(
    message: str = "",
    errors: dict | list | None = None,
    status_code: int = status.HTTP_400_BAD_REQUEST,
) -> Response:
    payload = {
        "success": False,
        "message": message,
        "errors": errors if errors is not None else {},
    }
    return Response(payload, status=status_code)
