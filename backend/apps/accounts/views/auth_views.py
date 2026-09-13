from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError

from apps.accounts.serializers import LoginSerializer, RefreshTokenSerializer
from apps.accounts.services.auth_context import build_auth_context
from apps.accounts.services.auth_service import AuthService
from apps.accounts.services.token_service import TokenService
from apps.audit_logs.models import UserActivityAction
from apps.audit_logs.services.user_activity_service import UserActivityService
from apps.core.responses import error_response, success_response


class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = AuthService.login(
                serializer.validated_data["email"],
                serializer.validated_data["password"],
            )
        except ValueError as exc:
            return error_response(message=str(exc), status_code=401)
        except RuntimeError as exc:
            return error_response(message=str(exc), status_code=500)
        return success_response(data=result, message="Login successful")


class RefreshTokenAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            tokens = TokenService.rotate_refresh(serializer.validated_data["refresh"])
        except Exception:
            return error_response(message="Invalid refresh token", status_code=401)
        return success_response(data={"tokens": tokens}, message="Token rotated")


class LogoutAPIView(APIView):
    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            try:
                TokenService.blacklist_refresh(refresh)
            except TokenError:
                pass
        if request.user and request.user.is_authenticated:
            UserActivityService.log(
                user=request.user,
                action=UserActivityAction.LOGOUT,
                description="User signed out",
            )
        return success_response(message="Logged out successfully")


class MeAPIView(APIView):
    def get(self, request):
        return success_response(data=build_auth_context(request.user), message="Profile loaded")
