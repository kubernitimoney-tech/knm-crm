from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0003_remove_loan_product_duplicate_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="loan",
            name="product_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
