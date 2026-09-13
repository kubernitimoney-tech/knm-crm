from rest_framework.views import exception_handler

from apps.core.responses import error_response


def custom_exception_handler(exc, context):
    """
    Maps DRF exceptions to the global error envelope.
    """
    response = exception_handler(exc, context)
    if response is None:
        return None

    errors = response.data
    message = "Validation error."
    if isinstance(errors, dict):
        if "detail" in errors:
            detail = errors["detail"]
            message = str(detail) if not isinstance(detail, list) else str(detail[0])
        elif "non_field_errors" in errors:
            message = str(errors["non_field_errors"][0])
        else:
            field_messages = []
            for field, value in errors.items():
                if isinstance(value, list) and value:
                    field_messages.append(f"{field}: {value[0]}")
                elif value:
                    field_messages.append(f"{field}: {value}")
            if field_messages:
                message = field_messages[0]

    return error_response(
        message=message,
        errors=errors if isinstance(errors, dict) else {"detail": errors},
        status_code=response.status_code,
    )
