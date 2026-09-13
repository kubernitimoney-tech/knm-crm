from django.contrib.contenttypes.models import ContentType
from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.applications.models import LoanApplication
from apps.core.responses import success_response
from apps.customers.models import Customer
from apps.leads.models import Lead
from apps.loans.models import Loan


class ActivityTimelineAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "audit.view"

    def get(self, request):
        model_name = request.query_params.get("model")
        object_id = request.query_params.get("object_id")
        if not model_name or not object_id:
            return success_response(data=[])

        model_map = {
            "customer": Customer,
            "lead": Lead,
            "loan_application": LoanApplication,
            "loan": Loan,
        }
        model = model_map.get(model_name)
        if model is None:
            return success_response(data=[])

        from apps.activities.models import Activity

        ct = ContentType.objects.get_for_model(model)
        activities = Activity.objects.filter(content_type=ct, object_id=object_id).select_related(
            "actor"
        )[:50]
        data = [
            {
                "id": str(a.id),
                "verb": a.verb,
                "description": a.description,
                "actor": a.actor.email if a.actor else None,
                "created_at": a.created_at,
            }
            for a in activities
        ]
        return success_response(data=data)
