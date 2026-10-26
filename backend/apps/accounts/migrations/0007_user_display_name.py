from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_permission_role_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="display_name",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Shown only in the app shell (navbar, sidebar, profile). Loan and audit "
                    "records always use the official first/last name."
                ),
                max_length=150,
                verbose_name="Display name",
            ),
        ),
    ]
