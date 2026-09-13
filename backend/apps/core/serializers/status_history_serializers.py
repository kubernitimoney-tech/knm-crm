from rest_framework import serializers


def _status_label(value: str, choices) -> str:
    if not value:
        return "—"
    return dict(choices.choices).get(value, value.replace("_", " ").title())


class BaseStatusHistorySerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    from_status = serializers.CharField(read_only=True)
    from_status_display = serializers.SerializerMethodField()
    to_status = serializers.CharField(read_only=True)
    to_status_display = serializers.SerializerMethodField()
    changed_by_name = serializers.SerializerMethodField()
    remarks = serializers.CharField(read_only=True)
    changed_at = serializers.DateTimeField(read_only=True)

    status_choices = None

    def get_from_status_display(self, obj):
        return _status_label(obj.from_status, self.status_choices)

    def get_to_status_display(self, obj):
        return _status_label(obj.to_status, self.status_choices)

    def get_changed_by_name(self, obj):
        user = getattr(obj, "changed_by", None)
        if not user:
            return "System"
        return user.get_full_name().strip() or user.email or "System"


def lead_status_history_serializer():
    from apps.leads.models import LeadStatus

    class LeadStatusHistorySerializer(BaseStatusHistorySerializer):
        status_choices = LeadStatus

    return LeadStatusHistorySerializer


def application_status_history_serializer():
    from apps.applications.models import ApplicationStatus

    class ApplicationStatusHistorySerializer(BaseStatusHistorySerializer):
        status_choices = ApplicationStatus

    return ApplicationStatusHistorySerializer


def loan_status_history_serializer():
    from apps.loans.models import LoanStatus

    class LoanStatusHistorySerializer(BaseStatusHistorySerializer):
        status_choices = LoanStatus

    return LoanStatusHistorySerializer
