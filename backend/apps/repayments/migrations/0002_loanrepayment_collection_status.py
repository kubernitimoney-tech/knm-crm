from django.db import migrations, models

CLOSING_LEAD_STATUSES = {
    "closed": "close",
    "payday_pre_close": "payday_pre_close",
    "settlement": "settlement",
}


def mark_existing_closes(apps, schema_editor):
    """Keep already-closed loans closed: tag their last collection as the close."""
    Loan = apps.get_model("loans", "Loan")
    LoanRepayment = apps.get_model("repayments", "LoanRepayment")
    LoanSettlement = apps.get_model("loans", "LoanSettlement")
    for loan in Loan.objects.filter(status="closed").select_related("application__lead"):
        last = (
            LoanRepayment.objects.filter(loan=loan, status="confirmed", collection_status="")
            .order_by("-payment_date", "-created_at")
            .first()
        )
        if last is None:
            continue
        code = "close"
        if LoanSettlement.objects.filter(loan=loan).exists():
            code = "settlement"
        else:
            application = getattr(loan, "application", None)
            lead = getattr(application, "lead", None) if application else None
            if lead is not None:
                code = CLOSING_LEAD_STATUSES.get(lead.status, "close")
        last.collection_status = code
        last.save(update_fields=["collection_status"])


class Migration(migrations.Migration):
    dependencies = [
        ("repayments", "0001_initial"),
        ("loans", "0004_loan_product_snapshot"),
        ("leads", "0026_leadvideokycrequest_selfie_file"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanrepayment",
            name="collection_status",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.RunPython(mark_existing_closes, migrations.RunPython.noop),
    ]
