import logging

from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.core.responses import error_response, success_response
from apps.loans.selectors.loan_selectors import STAGE_LOAN_STATUS_MAP, loans_for_pipeline_stage
from apps.loans.serializers.loan_pipeline_serializers import LoanPipelineRowSerializer

logger = logging.getLogger(__name__)


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
        # Serialize row by row: one loan with bad data must not blank the whole
        # list. Failures are logged with the loan number so they can be fixed.
        data, failed = [], []
        for loan in rows:
            try:
                data.append(LoanPipelineRowSerializer(loan).data)
            except Exception:
                failed.append(loan.loan_account_number)
                logger.exception(
                    "Loan pipeline (%s): could not build row for loan %s",
                    stage,
                    loan.loan_account_number,
                )
        message = ""
        if failed:
            message = f"{len(failed)} loan(s) could not be shown: {', '.join(failed[:10])}"
        return success_response(data=data, message=message)
