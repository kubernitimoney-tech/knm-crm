from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("leads", "0019_lead_reloan_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="lead",
            name="close_reason",
            field=models.CharField(
                blank=True,
                choices=[
                    ("dnd", "DND"),
                    ("invalid_number", "Invalid Number"),
                    ("not_interested", "Not Interested"),
                    ("duplicate_lead", "Duplicate Lead"),
                    ("other", "Other"),
                ],
                db_index=True,
                max_length=30,
            ),
        ),
    ]
