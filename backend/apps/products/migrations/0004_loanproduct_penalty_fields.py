from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0003_loanproduct_processing_fee_percentage"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanproduct",
            name="penalty_rate",
            field=models.DecimalField(decimal_places=4, default=0, max_digits=8),
        ),
        migrations.AddField(
            model_name="loanproduct",
            name="penalty_grace_days",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
