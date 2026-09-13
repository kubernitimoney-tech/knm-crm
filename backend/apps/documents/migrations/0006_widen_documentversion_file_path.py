from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0005_normalize_document_passwords"),
    ]

    operations = [
        migrations.AlterField(
            model_name="documentversion",
            name="file",
            field=models.FileField(max_length=512, upload_to="documents/%Y/%m/"),
        ),
        migrations.AlterField(
            model_name="documentversion",
            name="mime_type",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
