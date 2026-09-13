from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.core.responses import error_response, success_response
from apps.loans.selectors.loan_selectors import STAGE_LOAN_STATUS_MAP, loans_for_pipeline_stage
from apps.loans.serializers.loan_pipeline_serializers import LoanPipelineRowSerializer


class LoanPipelineAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permissions = ["loan.view", "collection.view"]

    def get(self, request):
        stage = (request.query_params.get("stage") or "").strip()
        if stage not in STAGE_LOAN_STATUS_MAP:
            return error_response(
                message="Invalid pipeline stage.",
                status_code=400,
            )
        rows = loans_for_pipeline_stage(user=request.user, stage=stage)
        serializer = LoanPipelineRowSerializer(rows, many=True)
        return success_response(data=serializer.data)
