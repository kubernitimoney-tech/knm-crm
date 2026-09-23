from django.db import migrations, models

RENTED_LEGACY = {"office", "correspondence"}
OWN_LEGACY = {"residential", "current", "permanent"}


def migrate_address_types(apps, schema_editor):
    CustomerAddress = apps.get_model("customers", "CustomerAddress")
    for address in CustomerAddress.objects.all().iterator():
        current = address.address_type
        if current in RENTED_LEGACY:
            address.address_type = "rented"
        elif current in OWN_LEGACY or current not in {"own", "rented"}:
            address.address_type = "own"
        address.save(update_fields=["address_type"])


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0005_add_verification_flags"),
    ]

    operations = [
        migrations.RunPython(migrate_address_types, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="customeraddress",
            name="address_type",
            field=models.CharField(
                choices=[("own", "Own"), ("rented", "Rented")],
                max_length=20,
            ),
        ),
    ]
