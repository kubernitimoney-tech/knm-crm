from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0003_lead_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="lead",
            name="loan_purpose",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
