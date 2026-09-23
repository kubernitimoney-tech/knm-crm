from django.db import migrations, models

APPLICATION_STATUS_MAP = {
    "documents_pending": "interested",
}


def forwards(apps, schema_editor):
    LoanApplication = apps.get_model("applications", "LoanApplication")
    ApplicationStatusHistory = apps.get_model("applications", "ApplicationStatusHistory")

    for old, new in APPLICATION_STATUS_MAP.items():
        LoanApplication.objects.filter(status=old).update(status=new)
        ApplicationStatusHistory.objects.filter(from_status=old).update(from_status=new)
        ApplicationStatusHistory.objects.filter(to_status=old).update(to_status=new)


def backwards(apps, schema_editor):
    LoanApplication = apps.get_model("applications", "LoanApplication")
    ApplicationStatusHistory = apps.get_model("applications", "ApplicationStatusHistory")

    reverse_map = {new: old for old, new in APPLICATION_STATUS_MAP.items()}

    for new, old in reverse_map.items():
        LoanApplication.objects.filter(status=new).update(status=old)
        ApplicationStatusHistory.objects.filter(from_status=new).update(from_status=old)
        ApplicationStatusHistory.objects.filter(to_status=new).update(to_status=old)


class Migration(migrations.Migration):

    dependencies = [
        ("applications", "0011_application_documents_incomplete_status"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="loanapplication",
            name="status",
            field=models.CharField(
                choices=[
                    ("interested", "Interested"),
                    ("documents_received", "Documents Received"),
                    ("documents_incomplete", "Documents Incomplete"),
                    ("documents_verified", "Documents Verified"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("cancelled", "Cancelled"),
                    ("disbursal_sheet_sent", "Disbursal Sheet Sent"),
                    ("disbursed", "Disbursed"),
                    ("closed", "Closed"),
                ],
                db_index=True,
                default="interested",
                max_length=20,
            ),
        ),
    ]
