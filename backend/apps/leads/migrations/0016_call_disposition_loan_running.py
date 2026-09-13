from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0015_lead_settlement_status"),
    ]

    operations = [
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
