from django.db import migrations, models

LEAD_STATUS_MAP = {
    "new": "pending_contact",
    "documents_received": "interested",
    "incomplete_documents": "follow_up",
    "documents_verified": "converted",
    "loan_running": "converted",
    "not_eligible": "not_interested",
}

CALL_DISPOSITION_MAP = {
    "documents_received": "interested",
}


def forwards(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    CallLog = apps.get_model("leads", "CallLog")

    for old, new in LEAD_STATUS_MAP.items():
        Lead.objects.filter(status=old).update(status=new)

    for old, new in CALL_DISPOSITION_MAP.items():
        CallLog.objects.filter(disposition=old).update(disposition=new)


def backwards(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    CallLog = apps.get_model("leads", "CallLog")

    reverse_lead = {new: old for old, new in LEAD_STATUS_MAP.items()}
    reverse_call = {new: old for old, new in CALL_DISPOSITION_MAP.items()}

    for new, old in reverse_lead.items():
        Lead.objects.filter(status=new).update(status=old)

    for new, old in reverse_call.items():
        CallLog.objects.filter(disposition=new).update(disposition=old)


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0007_status_history"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
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
                    ("closed", "Closed"),
                ],
                db_index=True,
                default="pending_contact",
                max_length=25,
            ),
        ),
        migrations.AlterField(
            model_name="calllog",
            name="disposition",
            field=models.CharField(
                choices=[
                    ("busy", "Busy"),
                    ("call_disconnected", "Call Disconnected"),
                    ("call_me_later", "Call Me Later"),
                    ("call_you_later", "Call You Later"),
                    ("dnd", "DND"),
                    ("duplicate_lead", "Duplicate Lead"),
                    ("follow_up_required", "Follow Up Required"),
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
