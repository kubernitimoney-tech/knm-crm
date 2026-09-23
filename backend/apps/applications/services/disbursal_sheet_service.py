from apps.applications.models import LoanApplication
from apps.core.validators.india import normalize_cheque_number


class DisbursalSheetServiceError(Exception):
    pass


class DisbursalSheetService:
    @classmethod
    def is_cheque_number_taken(
        cls,
        cheque_no: str | None,
        *,
        application_id=None,
    ) -> bool:
        normalized = normalize_cheque_number(cheque_no or "")
        if not normalized:
            return False

        app_qs = LoanApplication.objects.filter(is_deleted=False)
        if application_id is not None:
            app_qs = app_qs.exclude(id=application_id)

        for details in app_qs.values_list("disbursal_sheet_details", flat=True):
            existing = normalize_cheque_number((details or {}).get("cheque_no"))
            if existing == normalized:
                return True
        return False

    @classmethod
    def assert_cheque_number_available(
        cls,
        cheque_no: str | None,
        *,
        application_id=None,
    ) -> None:
        if cls.is_cheque_number_taken(cheque_no, application_id=application_id):
            raise DisbursalSheetServiceError("This cheque number is already in use.")
