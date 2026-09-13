from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0008_companyaccount"),
    ]

    operations = [
        migrations.DeleteModel(
            name="CompanyAccount",
        ),
    ]
