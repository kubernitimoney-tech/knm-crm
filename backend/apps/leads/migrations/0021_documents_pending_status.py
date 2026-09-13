from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("leads", "0020_lead_close_reason"),
    ]

    operations = [
        migrations.AlterField(
            model_name="lead",
            name="status",
            field=models.CharField(
                choices=[
                    ("fresh", "Fresh"),
                    ("reloan", "Reloan"),
                    ("interested", "Interested"),
                    ("documents_pending", "Document Pending"),
                    ("documents_received", "Documents Received"),
                    ("not_interested", "Not Interested"),
                    ("duplicate_lead", "Duplicate Lead"),
                    ("loan_running", "Loan Running"),
                    ("part_payment", "Part Payment"),
                    ("payday_pre_close", "Payday Pre-Close"),
                    ("closed", "Closed"),
                    ("settlement", "Settlement"),
                ],
                db_index=True,
                default="fresh",
                max_length=25,
            ),
        ),
        migrations.AlterField(
            model_name="calllog",
            name="disposition",
            field=models.CharField(
                choices=[
                    ("busy", "Busy"),
                    ("call_back", "Call Back"),
                    ("call_disconnected", "Call Disconnected"),
                    ("dnd", "DND"),
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
                ],
                max_length=30,
            ),
        ),
    ]
