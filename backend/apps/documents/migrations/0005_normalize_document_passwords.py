from apps.core import encryption
from django.db import migrations


def normalize_document_passwords(apps, schema_editor):
    Document = apps.get_model("documents", "Document")

    for doc in Document.objects.exclude(password="").iterator():
        plain = encryption.decrypt_for_display(doc.password)
        if not plain:
            Document.objects.filter(pk=doc.pk).update(password="")
            continue
        Document.objects.filter(pk=doc.pk).update(
            password=encryption.encrypt(plain),
        )


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0004_encrypt_document_password"),
    ]

    operations = [
        migrations.RunPython(normalize_document_passwords, migrations.RunPython.noop),
    ]
