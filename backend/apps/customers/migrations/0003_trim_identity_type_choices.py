from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0002_expand_address_type_choices"),
    ]

    operations = [
        migrations.AlterField(
            model_name="customeridentity",
            name="identity_type",
            field=models.CharField(
                choices=[
                    ("pan", "PAN"),
                    ("aadhaar", "Aadhaar"),
                ],
                max_length=30,
            ),
        ),
    ]
