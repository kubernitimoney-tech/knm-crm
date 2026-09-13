from django.db import migrations, models


def forwards(apps, schema_editor):
    CustomerAddress = apps.get_model("customers", "CustomerAddress")
    CustomerAddress.objects.filter(is_verified=True).update(verification_status="verified")
    CustomerAddress.objects.filter(is_verified=False).update(verification_status="unverified")


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0010_unique_customer_bank_account_hash"),
    ]

    operations = [
        migrations.AddField(
            model_name="customeraddress",
            name="verification_status",
            field=models.CharField(
                choices=[
                    ("unverified", "Unverified"),
                    ("verified", "Verified"),
                    ("incomplete", "Incomplete"),
                ],
                default="unverified",
                max_length=20,
            ),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
