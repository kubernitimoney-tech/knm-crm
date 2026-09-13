from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0002_seed_document_types"),
    ]

    operations = [
        migrations.AddField(
            model_name="document",
            name="password",
            field=models.CharField(
                blank=True,
                help_text="Optional password required to open protected files.",
                max_length=255,
            ),
        ),
    ]
