from django.db import migrations, models

ROLE_DISPLAY_NAMES = {
    "super-admin": "Super Admin",
    "admin": "Admin",
    "production-manager": "Prod. Mgr",
    "relationship-manager": "RM",
    "senior-relationship-manager": "Sr. RM",
    "credit-manager": "CM",
    "senior-credit-manager": "Sr. CM",
    "field-investigator": "FI",
    "account-finance": "Finance",
    "collection-officer": "Collection",
    "auditor": "Auditor",
}


def populate_display_names(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for role in Role.objects.all():
        display_name = ROLE_DISPLAY_NAMES.get(role.slug, role.name)
        if role.display_name != display_name:
            role.display_name = display_name
            role.save(update_fields=["display_name"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_session_epoch"),
    ]

    operations = [
        migrations.AddField(
            model_name="role",
            name="display_name",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Short label for compact UI e.g. Sr. RM, Sr. CM.",
                max_length=50,
            ),
        ),
        migrations.RunPython(populate_display_names, migrations.RunPython.noop),
    ]
