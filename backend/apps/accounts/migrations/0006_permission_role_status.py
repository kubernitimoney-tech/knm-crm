# Generated manually for Permission.status and Role.status

from django.db import migrations, models


def sync_role_status_from_is_active(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(is_active=False).update(status="inactive")
    Role.objects.filter(is_active=True).update(status="active")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_rename_emp_codes_to_knm"),
    ]

    operations = [
        migrations.AddField(
            model_name="permission",
            name="status",
            field=models.CharField(
                choices=[("active", "Active"), ("inactive", "Inactive")],
                db_index=True,
                default="active",
                max_length=20,
                verbose_name="Status",
            ),
        ),
        migrations.AddField(
            model_name="role",
            name="status",
            field=models.CharField(
                choices=[("active", "Active"), ("inactive", "Inactive")],
                db_index=True,
                default="active",
                max_length=20,
                verbose_name="Status",
            ),
        ),
        migrations.RunPython(sync_role_status_from_is_active, migrations.RunPython.noop),
    ]
