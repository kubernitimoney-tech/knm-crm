from django.db import migrations, models


def forwards(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    Lead.objects.filter(category="reloan", status="fresh").update(status="reloan")


def backwards(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    Lead.objects.filter(category="reloan", status="reloan").update(status="fresh")


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0018_remove_contacted_follow_up_status"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="lead",
            name="status",
            field=models.CharField(
                choices=[
                    ("fresh", "Fresh"),
                    ("reloan", "Reloan"),
                    ("interested", "Interested"),
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
    ]
