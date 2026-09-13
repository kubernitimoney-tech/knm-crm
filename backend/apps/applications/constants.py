from apps.applications.models import ApplicationStatus

# Approve → disbursal-sheet → disbursed (active finance / sanction pipeline).
FINANCE_PIPELINE_STATUSES = frozenset(
    {
        ApplicationStatus.APPROVED,
        ApplicationStatus.DISBURSAL_SHEET_SENT,
        ApplicationStatus.DISBURSED,
    }
)

# Account & Finance object access: active pipeline plus fully collected / closed files.
# Closing a loan sets application.status = closed (see repayment_service); without this
# finance can list collection "closed" rows but get 404 on lead detail.
FINANCE_VISIBLE_STATUSES = frozenset(
    {
        *FINANCE_PIPELINE_STATUSES,
        ApplicationStatus.CLOSED,
    }
)
