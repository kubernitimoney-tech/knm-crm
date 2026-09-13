from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("applications", "0003_application_documents_received_status"),
    ]

    operations = [
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
                    ("cancelled", "Cancelled"),
                ],
                db_index=True,
                default="draft",
                max_length=20,
            ),
        ),
    ]
