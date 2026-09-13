from django.db import migrations, models


def backfill_employee_codes(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    seq = 1
    for user in User.objects.filter(employee_code="").order_by("created_at", "id"):
        user.employee_code = f"KNM{seq:04d}"
        user.save(update_fields=["employee_code"])
        seq += 1


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_role_display_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="employee_code",
            field=models.CharField(
                blank=True,
                default="",
                editable=False,
                help_text="Human-readable employee identifier (e.g. KNM0001).",
                max_length=20,
                verbose_name="Employee code",
            ),
        ),
        migrations.RunPython(backfill_employee_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="employee_code",
            field=models.CharField(
                blank=True,
                editable=False,
                help_text="Human-readable employee identifier (e.g. KNM0001).",
                max_length=20,
                unique=True,
                verbose_name="Employee code",
            ),
        ),
    ]
