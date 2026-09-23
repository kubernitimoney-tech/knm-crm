import pytest
from tests.factories import UserFactory, application_factory

from apps.applications.models import ApplicationStatus
from apps.applications.services.application_service import (
    ApplicationService,
    ApplicationServiceError,
)
from apps.applications.services.disbursal_sheet_service import DisbursalSheetService


@pytest.mark.django_db
class TestDisbursalSheetService:
    def test_rejects_blank_cheque_number_for_uniqueness_check(self):
        assert DisbursalSheetService.is_cheque_number_taken("") is False
        assert DisbursalSheetService.is_cheque_number_taken(None) is False

    def test_rejects_duplicate_cheque_number(self):
        existing = application_factory()
        existing.disbursal_sheet_details = {"cheque_no": "123456"}
        existing.save(update_fields=["disbursal_sheet_details"])

        assert DisbursalSheetService.is_cheque_number_taken("123456") is True

    def test_allows_same_application_to_keep_cheque_number(self):
        application = application_factory()
        application.disbursal_sheet_details = {"cheque_no": "999999"}
        application.save(update_fields=["disbursal_sheet_details"])

        assert (
            DisbursalSheetService.is_cheque_number_taken(
                "999999",
                application_id=application.id,
            )
            is False
        )


@pytest.mark.django_db
class TestSubmitDisbursalSheetChequeUniqueness:
    def test_submit_rejects_duplicate_cheque_number(self):
        from unittest.mock import patch

        user = UserFactory()
        existing = application_factory()
        existing.status = ApplicationStatus.APPROVED
        existing.disbursal_sheet_details = {"cheque_no": "543210"}
        existing.save(update_fields=["status", "disbursal_sheet_details"])

        pending = application_factory(
            email="pending-cheque@test.com",
            mobile_number="9222222222",
        )
        pending.status = ApplicationStatus.APPROVED
        pending.save(update_fields=["status"])

        with patch(
            "apps.applications.services.application_service.apply_ifsc_bank_details",
            side_effect=lambda details: details,
        ):
            with pytest.raises(ApplicationServiceError, match="cheque number"):
                ApplicationService.submit_disbursal_sheet(
                    user=user,
                    application=pending,
                    disbursal_details={
                        "account_number": "1111111111",
                        "ifsc_code": "HDFC0001234",
                        "cheque_no": "543210",
                    },
                )
