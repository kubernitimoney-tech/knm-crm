from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("applications", "0005_applicationdecision_sanction_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanapplication",
            name="disbursal_sheet_details",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="loanapplication",
            name="disbursal_sheet_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="loanapplication",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("interested", "Interested"),
                    ("documents_received", "Documents Received"),
                    ("documents_uploaded", "Documents Uploaded"),
                    ("submitted", "Submitted"),
                    ("under_review", "Under Review"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("disbursal_sheet_sent", "Disbursal Sheet Send"),
                    ("disbursed", "Disbursed"),
                    ("cancelled", "Cancelled"),
                ],
                db_index=True,
                default="draft",
                max_length=20,
            ),
        ),
    ]
