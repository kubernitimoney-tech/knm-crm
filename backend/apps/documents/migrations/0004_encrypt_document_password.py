from apps.core import encryption
from cryptography.fernet import InvalidToken
from django.db import migrations


def encrypt_existing_document_passwords(apps, schema_editor):
    Document = apps.get_model("documents", "Document")
    fernet = encryption._fernet()

    for doc in Document.objects.exclude(password="").iterator():
        raw = doc.password
        if not raw:
            continue
        try:
            fernet.decrypt(raw.encode())
            continue
        except (InvalidToken, ValueError, AttributeError):
            Document.objects.filter(pk=doc.pk).update(
                password=encryption.encrypt(raw),
            )


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0003_document_password"),
    ]

    operations = [
        migrations.AlterField(
            model_name="document",
            name="password",
            field=encryption.EncryptedCharField(
                blank=True,
                help_text="Optional password required to open protected files (encrypted at rest).",
            ),
        ),
        migrations.RunPython(encrypt_existing_document_passwords, migrations.RunPython.noop),
    ]
