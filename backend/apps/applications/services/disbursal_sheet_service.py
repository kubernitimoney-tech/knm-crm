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
        # Cheque numbers are not unique. Collection managers often reuse 000000
        # when a physical cheque number is not available.
        del cheque_no, application_id
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
