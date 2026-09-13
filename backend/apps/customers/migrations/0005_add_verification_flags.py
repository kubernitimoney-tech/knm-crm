from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0004_customer_address_reference_lead_fk"),
    ]

    operations = [
        migrations.AddField(
            model_name="customeremployment",
            name="is_verified",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="customerreference",
            name="is_verified",
            field=models.BooleanField(default=False),
        ),
    ]
