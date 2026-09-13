from django.db import migrations, models

LEAD_STATUS_MAP = {
    "contacted": "fresh",
    "follow_up": "fresh",
}


def forwards(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    LeadStatusHistory = apps.get_model("leads", "LeadStatusHistory")

    for old, new in LEAD_STATUS_MAP.items():
        Lead.objects.filter(status=old).update(status=new)
        LeadStatusHistory.objects.filter(from_status=old).update(from_status=new)
        LeadStatusHistory.objects.filter(to_status=old).update(to_status=new)


def backwards(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    LeadStatusHistory = apps.get_model("leads", "LeadStatusHistory")

    reverse_map = {new: old for old, new in LEAD_STATUS_MAP.items()}

    for new, old in reverse_map.items():
        Lead.objects.filter(status=new).update(status=old)
        LeadStatusHistory.objects.filter(from_status=new).update(from_status=old)
        LeadStatusHistory.objects.filter(to_status=new).update(to_status=old)


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0017_lead_fresh_and_documents_received_status"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="lead",
            name="status",
            field=models.CharField(
                choices=[
                    ("fresh", "Fresh"),
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
