from django.urls import path
from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.core.responses import success_response
from apps.workflow.models import Workflow


class WorkflowListAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "workflow.view"

    def get(self, request):
        data = list(
            Workflow.objects.filter(is_active=True)
            .prefetch_related("states", "transitions")
            .values("id", "name", "slug")
        )
        return success_response(data=data)


urlpatterns = [
    path("", WorkflowListAPIView.as_view(), name="workflow-list"),
]
