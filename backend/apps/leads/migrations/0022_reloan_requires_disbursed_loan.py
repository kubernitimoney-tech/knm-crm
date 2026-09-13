from django.db import migrations


def forwards(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    Loan = apps.get_model("loans", "Loan")

    disbursed_customer_ids = set(
        Loan.objects.filter(is_deleted=False, disbursed_at__isnull=False).values_list(
            "customer_id",
            flat=True,
        )
    )

    misclassified = Lead.objects.filter(category="reloan", is_deleted=False).exclude(
        customer_id__in=disbursed_customer_ids
    )
    misclassified.filter(status="reloan").update(category="fresh", status="fresh")
    misclassified.exclude(status="reloan").update(category="fresh")


def backwards(apps, schema_editor):
    # Cannot reliably restore prior category assignments.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("leads", "0021_documents_pending_status"),
        ("loans", "0004_loan_product_snapshot"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
