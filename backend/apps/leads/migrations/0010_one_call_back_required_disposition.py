from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0009_remove_follow_up_required_disposition"),
    ]

    operations = [
        migrations.AlterField(
            model_name="calllog",
            name="disposition",
            field=models.CharField(
                choices=[
                    ("busy", "Busy"),
                    ("call_disconnected", "Call Disconnected"),
                    ("call_me_later", "Call Me Later"),
                    ("call_you_later", "Call You Later"),
                    ("one_call_back_required", "One Call Back Required"),
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
