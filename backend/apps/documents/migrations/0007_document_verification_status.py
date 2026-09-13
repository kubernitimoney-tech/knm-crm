from django.db import migrations, models


def forwards(apps, schema_editor):
    Document = apps.get_model("documents", "Document")
    Document.objects.filter(is_verified=True).update(verification_status="verified")
    Document.objects.filter(is_verified=False).update(verification_status="unverified")


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0006_widen_documentversion_file_path"),
    ]

    operations = [
        migrations.AddField(
            model_name="document",
            name="verification_status",
            field=models.CharField(
                choices=[
                    ("unverified", "Unverified"),
                    ("verified", "Verified"),
                    ("incomplete", "Incomplete"),
                ],
                default="unverified",
                max_length=20,
            ),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
