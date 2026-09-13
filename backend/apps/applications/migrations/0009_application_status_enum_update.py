from django.db import migrations, models

APPLICATION_STATUS_MAP = {
    "draft": "documents_pending",
    "interested": "documents_pending",
    "documents_received": "documents_pending",
    "documents_uploaded": "documents_verified",
    "submitted": "documents_verified",
    "under_review": "documents_verified",
}


def forwards(apps, schema_editor):
    LoanApplication = apps.get_model("applications", "LoanApplication")
    ApplicationStatusHistory = apps.get_model("applications", "ApplicationStatusHistory")

    for old, new in APPLICATION_STATUS_MAP.items():
        LoanApplication.objects.filter(status=old).update(status=new)

    for old, new in APPLICATION_STATUS_MAP.items():
        ApplicationStatusHistory.objects.filter(from_status=old).update(from_status=new)
        ApplicationStatusHistory.objects.filter(to_status=old).update(to_status=new)


def backwards(apps, schema_editor):
    LoanApplication = apps.get_model("applications", "LoanApplication")
    ApplicationStatusHistory = apps.get_model("applications", "ApplicationStatusHistory")

    reverse_map = {new: old for old, new in APPLICATION_STATUS_MAP.items()}

    for new, old in reverse_map.items():
        LoanApplication.objects.filter(status=new).update(status=old)

    for new, old in reverse_map.items():
        ApplicationStatusHistory.objects.filter(from_status=new).update(from_status=old)
        ApplicationStatusHistory.objects.filter(to_status=new).update(to_status=old)


class Migration(migrations.Migration):

    dependencies = [
        ("applications", "0008_loanapplication_product_snapshot"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="loanapplication",
            name="status",
            field=models.CharField(
                choices=[
                    ("documents_pending", "Documents Pending"),
                    ("documents_verified", "Documents Verified"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("cancelled", "Cancelled"),
                    ("disbursal_sheet_sent", "Disbursal Sheet Sent"),
                    ("disbursed", "Disbursed"),
                ],
                db_index=True,
                default="documents_pending",
                max_length=30,
            ),
        ),
    ]
