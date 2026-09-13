from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0014_lead_payday_pre_close_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="lead",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending_contact", "Pending Contact"),
                    ("contacted", "Contacted"),
                    ("follow_up", "Follow Up"),
                    ("interested", "Interested"),
                    ("not_interested", "Not Interested"),
                    ("converted", "Converted"),
                    ("duplicate_lead", "Duplicate Lead"),
                    ("loan_running", "Loan Running"),
                    ("part_payment", "Part Payment"),
                    ("payday_pre_close", "Payday Pre-Close"),
                    ("closed", "Closed"),
                    ("settlement", "Settlement"),
                ],
                db_index=True,
                default="pending_contact",
                max_length=25,
            ),
        ),
    ]
