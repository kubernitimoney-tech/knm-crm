from rest_framework.views import APIView

from apps.accounts.permissions import HasRBACPermission
from apps.core.responses import success_response
from apps.leads.models import LeadStatus
from apps.leads.services.lead_service import TERMINAL_LEAD_STATUSES, LeadService


class LeadPipelineAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "lead.view"

    def get(self, request):
        qs = LeadService.visible_leads_for(request.user)
        buckets = {
            "fresh": qs.filter(status=LeadStatus.FRESH).count(),
            "reloan": qs.filter(status=LeadStatus.RELOAN).count(),
            "interested": qs.filter(status=LeadStatus.INTERESTED).count(),
            "documents_received": qs.filter(status=LeadStatus.DOCUMENTS_RECEIVED).count(),
            "not_interested": qs.filter(status=LeadStatus.NOT_INTERESTED).count(),
            "duplicate_lead": qs.filter(status=LeadStatus.DUPLICATE_LEAD).count(),
            "loan_running": qs.filter(status=LeadStatus.LOAN_RUNNING).count(),
            "part_payment": qs.filter(status=LeadStatus.PART_PAYMENT).count(),
            "payday_pre_close": qs.filter(status=LeadStatus.PAYDAY_PRE_CLOSE).count(),
            "closed": qs.filter(status=LeadStatus.CLOSED).count(),
            "settlement": qs.filter(status=LeadStatus.SETTLEMENT).count(),
            "in_progress": qs.exclude(status__in=TERMINAL_LEAD_STATUSES).count(),
        }
        return success_response(data={"buckets": buckets})


class AssignmentRosterAPIView(APIView):
    permission_classes = [HasRBACPermission]
    required_permission = "lead.view"

    def get(self, request):
        roster = []
        for manager in LeadService.get_relationship_managers():
            active_count = (
                manager.rm_leads.filter(is_deleted=False)
                .exclude(status__in=TERMINAL_LEAD_STATUSES)
                .count()
            )
            roster.append(
                {
                    "id": str(manager.id),
                    "email": manager.email,
                    "name": manager.get_full_name().strip() or manager.email,
                    "active_leads": active_count,
                }
            )
        return success_response(data=roster)
