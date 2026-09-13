import json

from django.utils.deprecation import MiddlewareMixin


class ResponseWrapperMiddleware(MiddlewareMixin):
    """
    Wraps non-enveloped JSON responses from DRF into the global format.
    Views using success_response/error_response are already wrapped.
    ViewSets returning raw DRF Response get normalized here.
    """

    def process_response(self, request, response):
        if not request.path.startswith("/api/"):
            return response
        content_type = response.get("Content-Type", "")
        if "application/json" not in content_type:
            return response
        try:
            body = json.loads(response.content.decode())
        except (json.JSONDecodeError, UnicodeDecodeError):
            return response
        if isinstance(body, dict) and "success" in body:
            return response
        if response.status_code >= 400:
            wrapped = {
                "success": False,
                "message": body.get("detail", "Request failed."),
                "errors": body if not isinstance(body.get("detail"), str) else {"detail": body},
            }
        else:
            wrapped = {
                "success": True,
                "message": "",
                "data": body,
            }
        response.content = json.dumps(wrapped).encode()
        response["Content-Length"] = len(response.content)
        return response
