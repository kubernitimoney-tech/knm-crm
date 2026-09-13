from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.applications.selectors.application_selectors import (
    STAGE_STATUS_MAP,
    applications_for_pipeline_stage,
)
from apps.applications.serializers.application_pipeline_serializers import (
    ApplicationPipelineRowSerializer,
)
from apps.core.responses import error_response, success_response


class ApplicationPipelineAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "application.view"

    # Account & finance holds disbursal.view (not application.view) but must load these queues.
    DISBURSAL_FINANCE_STAGES = frozenset({"disbursal-sheet", "disbursed", "enach"})

    def get_permissions(self):
        stage = (self.request.query_params.get("stage") or "").strip()
        if stage in self.DISBURSAL_FINANCE_STAGES:
            self.required_permissions = ["application.view", "disbursal.view"]
        else:
            self.required_permissions = None
        return super().get_permissions()

    def get(self, request):
        stage = (request.query_params.get("stage") or "").strip()
        if stage not in STAGE_STATUS_MAP:
            return error_response(
                message="Invalid pipeline stage.",
                status_code=400,
            )
        rows = applications_for_pipeline_stage(user=request.user, stage=stage)
        serializer = ApplicationPipelineRowSerializer(rows, many=True)
        return success_response(data=serializer.data)
