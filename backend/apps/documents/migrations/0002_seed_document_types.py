from django.db import migrations


def seed_document_types(apps, schema_editor):
    DocumentType = apps.get_model("documents", "DocumentType")
    catalog = {
        "pan": ("PAN Card", True),
        "aadhaar": ("Aadhaar Card", True),
        "salary_slip": ("Salary Slip", True),
        "bank_statement": ("Bank Statement", True),
        "photograph": ("Photograph", True),
        "cibil_report": ("Cibil Report", False),
        "id_card": ("ID Card", False),
        "cheque": ("Cheque", False),
        "electricity_bill": ("Electricity Bill", False),
        "mobile_bill": ("Mobile Bill", False),
        "others": ("Others", False),
    }
    for code, (name, is_required) in catalog.items():
        DocumentType.objects.update_or_create(
            code=code,
            defaults={"name": name, "is_required": is_required},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_document_types, migrations.RunPython.noop),
    ]
