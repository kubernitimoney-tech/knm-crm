from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0010_one_call_back_required_disposition"),
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
                    ("closed", "Closed"),
                ],
                db_index=True,
                default="pending_contact",
                max_length=25,
            ),
        ),
    ]
