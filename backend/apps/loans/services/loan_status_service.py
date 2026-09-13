from django.db import transaction

from apps.loans.models import Loan, LoanStatusHistory


@transaction.atomic
def change_loan_status(
    *,
    loan: Loan,
    new_status: str,
    user,
    remarks: str = "",
    extra_update_fields: list[str] | None = None,
) -> Loan:
    new_status = str(new_status)
    if loan.status == new_status:
        return loan

    from_status = loan.status
    loan.status = new_status
    loan.updated_by = user

    update_fields = ["status", "updated_by", "updated_at"]
    if extra_update_fields:
        for field in extra_update_fields:
            if field not in update_fields:
                update_fields.append(field)

    loan.save(update_fields=update_fields)

    LoanStatusHistory.objects.create(
        loan=loan,
        from_status=from_status,
        to_status=new_status,
        changed_by=user,
        remarks=remarks,
    )
    return loan


def record_loan_status_created(
    *,
    loan: Loan,
    user,
    remarks: str = "Loan created",
) -> LoanStatusHistory:
    return LoanStatusHistory.objects.create(
        loan=loan,
        from_status="",
        to_status=loan.status,
        changed_by=user,
        remarks=remarks,
    )
