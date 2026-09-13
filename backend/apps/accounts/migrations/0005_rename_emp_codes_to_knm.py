from django.db import migrations


def rename_emp_codes_to_knm(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.filter(employee_code__startswith="EMP"):
        user.employee_code = "KNM" + user.employee_code[3:]
        user.save(update_fields=["employee_code"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_user_employee_code"),
    ]

    operations = [
        migrations.RunPython(rename_emp_codes_to_knm, migrations.RunPython.noop),
    ]
