from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0002_status_history"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="loan",
            name="interest_rate",
        ),
        migrations.RemoveField(
            model_name="loan",
            name="processing_fee",
        ),
    ]
