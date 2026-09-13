from django.db import migrations, models


def forwards(apps, schema_editor):
    CallLog = apps.get_model("leads", "CallLog")
    CallLog.objects.filter(disposition="follow_up_required").update(disposition="call_me_later")


def backwards(apps, schema_editor):
    CallLog = apps.get_model("leads", "CallLog")
    CallLog.objects.filter(disposition="call_me_later").update(disposition="follow_up_required")


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0008_lead_status_enum_update"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
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
