from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("applications", "0007_status_history"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanapplication",
            name="product_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
