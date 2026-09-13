from django.db import migrations, models

SELF_EMPLOYED_LEGACY = {"business", "self_employed"}
SALARIED_LEGACY = {"salaried", "other"}


def migrate_employment_types(apps, schema_editor):
    CustomerEmployment = apps.get_model("customers", "CustomerEmployment")
    for employment in CustomerEmployment.objects.all().iterator():
        current = employment.employment_type
        if current in SELF_EMPLOYED_LEGACY:
            employment.employment_type = "self_employed"
        else:
            employment.employment_type = "salaried"
        employment.save(update_fields=["employment_type"])


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0006_address_type_own_rented"),
    ]

    operations = [
        migrations.RunPython(migrate_employment_types, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="customeremployment",
            name="employment_type",
            field=models.CharField(
                choices=[("salaried", "Salaried"), ("self_employed", "Self Employed")],
                max_length=30,
            ),
        ),
    ]
