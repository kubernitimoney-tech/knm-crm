from django.db import migrations, models

LEGACY_CALL_BACK_DISPOSITIONS = (
    "call_me_later",
    "call_you_later",
    "one_call_back_required",
)


def forwards(apps, schema_editor):
    CallLog = apps.get_model("leads", "CallLog")
    CallLog.objects.filter(disposition__in=LEGACY_CALL_BACK_DISPOSITIONS).update(
        disposition="call_back",
    )


def backwards(apps, schema_editor):
    CallLog = apps.get_model("leads", "CallLog")
    CallLog.objects.filter(disposition="call_back").update(disposition="call_me_later")


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0011_lead_duplicate_and_loan_running_status"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
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
