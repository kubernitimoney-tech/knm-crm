from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="session_epoch",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Incremented on each login to invalidate tokens from prior sessions.",
                verbose_name="Session epoch",
            ),
        ),
    ]
