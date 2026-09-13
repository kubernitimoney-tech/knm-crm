from django.db import migrations, models


LEAD_STATUS_CHOICES = [
    ("fresh", "Fresh"),
    ("reloan", "Reloan"),
    ("busy", "Busy"),
    ("call_back", "Call Back"),
    ("interested", "Interested"),
    ("documents_pending", "Document Pending"),
    ("documents_received", "Documents Received"),
    ("not_interested", "Not Interested"),
    ("duplicate_lead", "Duplicate Lead"),
    ("invalid_number", "Invalid Number"),
    ("loan_running", "Loan Running"),
    ("part_payment", "Part Payment"),
    ("payday_pre_close", "Payday Pre-Close"),
    ("closed", "Closed"),
    ("settlement", "Settlement"),
]

CALL_DISPOSITION_CHOICES = [
    ("busy", "Busy"),
    ("call_back", "Call Back"),
    ("call_disconnected", "Call Disconnected"),
    ("duplicate_lead", "Duplicate Lead"),
    ("loan_running", "Loan Running"),
    ("interested", "Interested"),
    ("documents_pending", "Document Pending"),
    ("documents_received", "Documents Received"),
    ("invalid_number", "Invalid Number"),
    ("no_answer", "No Answer"),
    ("not_interested", "Not Interested"),
    ("switched_off", "Switched Off"),
    ("other", "Other"),
]


def forwards(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    Lead.objects.filter(status="closed", close_reason="invalid_number").update(
        status="invalid_number",
    )


def backwards(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    Lead.objects.filter(status="invalid_number").update(status="closed")


class Migration(migrations.Migration):
    dependencies = [
        ("leads", "0022_reloan_requires_disbursed_loan"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="lead",
            name="status",
            field=models.CharField(
                choices=LEAD_STATUS_CHOICES,
                db_index=True,
                default="fresh",
                max_length=25,
            ),
        ),
        migrations.AlterField(
            model_name="calllog",
            name="disposition",
            field=models.CharField(
                choices=CALL_DISPOSITION_CHOICES,
                max_length=30,
            ),
        ),
    ]
