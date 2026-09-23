from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("applications", "0010_rename_admin_gst_to_gst"),
    ]

    operations = [
        migrations.AlterField(
            model_name="loanapplication",
            name="status",
            field=models.CharField(
                choices=[
                    ("documents_pending", "Documents Pending"),
                    ("documents_incomplete", "Documents Incomplete"),
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
