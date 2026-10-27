"""Retire User.mobile_number (now on UserProfile) and make username required."""

from django.db import migrations, models

import apps.accounts.usernames


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0009_backfill_user_profile_and_approval"),
    ]

    operations = [
        migrations.RemoveField(model_name="user", name="mobile_number"),
        migrations.AlterField(
            model_name="user",
            name="username",
            field=models.CharField(
                help_text="Lowercase CRM handle generated from the email (e.g. pankaj, pankaj1).",
                max_length=30,
                unique=True,
                validators=[apps.accounts.usernames.validate_username],
                verbose_name="Username",
            ),
        ),
    ]
