from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="customeraddress",
            name="address_type",
            field=models.CharField(
                choices=[
                    ("residential", "Residential"),
                    ("current", "Current"),
                    ("permanent", "Permanent"),
                    ("office", "Office"),
                    ("correspondence", "Correspondence"),
                ],
                max_length=20,
            ),
        ),
    ]
