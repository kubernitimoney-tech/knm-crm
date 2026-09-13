from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("applications", "0004_application_interested_and_docs_uploaded"),
    ]

    operations = [
        migrations.AddField(
            model_name="applicationdecision",
            name="sanction_details",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
