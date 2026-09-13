from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0004_lead_loan_purpose"),
    ]

    operations = [
        migrations.AddField(
            model_name="leadvideokycrequest",
            name="session_details",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
