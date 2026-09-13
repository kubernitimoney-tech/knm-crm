from apps.collections.models import CollectionActivity, CollectionActivityType
from apps.collections.services.collection_case_service import CollectionCaseService
from apps.loans.models import Loan


class CollectionActivityService:
    @staticmethod
    def log(
        *,
        loan: Loan,
        user,
        activity_type: str = CollectionActivityType.CALL,
        outcome: str = "",
        notes: str = "",
        next_follow_up=None,
    ) -> CollectionActivity | None:
        case = CollectionCaseService.ensure_case_for_loan(loan=loan, user=user)
        if case is None:
            return None
        return CollectionActivity.objects.create(
            case=case,
            activity_type=activity_type,
            outcome=outcome,
            notes=notes,
            next_follow_up=next_follow_up,
            performed_by=user,
            created_by=user,
            updated_by=user,
        )

    @staticmethod
    def log_for_lead(
        *,
        lead,
        user,
        activity_type: str = CollectionActivityType.CALL,
        outcome: str = "",
        notes: str = "",
        next_follow_up=None,
    ) -> CollectionActivity | None:
        loan = CollectionCaseService.resolve_loan_for_lead(lead)
        if loan is None:
            return None
        return CollectionActivityService.log(
            loan=loan,
            user=user,
            activity_type=activity_type,
            outcome=outcome,
            notes=notes,
            next_follow_up=next_follow_up,
        )

    @staticmethod
    def log_repayment(
        *,
        loan: Loan,
        user,
        amount,
        payment_mode: str,
        remarks: str = "",
    ) -> CollectionActivity | None:
        note_parts = [f"Payment recorded: {amount} via {payment_mode}"]
        if remarks:
            note_parts.append(remarks)
        return CollectionActivityService.log(
            loan=loan,
            user=user,
            activity_type=CollectionActivityType.CALL,
            outcome="payment_recorded",
            notes=" — ".join(note_parts),
        )
