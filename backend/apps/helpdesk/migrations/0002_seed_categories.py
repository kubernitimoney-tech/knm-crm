from django.db import migrations

# (department, name, default_priority) — admins can add/retire categories later.
CATEGORIES = [
    ("relationship", "Call log correction", "medium"),
    ("relationship", "Lead details correction", "medium"),
    ("relationship", "Lead assignment issue", "medium"),
    ("credit", "Repayment date change", "high"),
    ("credit", "Customer bank account change", "high"),
    ("credit", "Sanction details correction", "high"),
    ("credit", "Loan amount / tenure correction", "high"),
    ("collection", "Export data issue", "medium"),
    ("collection", "Repayment / collection entry correction", "high"),
    ("accounts", "UTR number update", "high"),
    ("accounts", "Reference number update", "medium"),
    ("accounts", "Disbursal entry correction", "high"),
    ("general", "Login / access issue", "high"),
    ("general", "Report or dashboard issue", "low"),
    ("general", "Other", "low"),
]


def seed_categories(apps, schema_editor):
    TicketCategory = apps.get_model("helpdesk", "TicketCategory")
    for order, (department, name, priority) in enumerate(CATEGORIES):
        TicketCategory.objects.get_or_create(
            department=department,
            name=name,
            defaults={"default_priority": priority, "sort_order": order},
        )


def unseed_categories(apps, schema_editor):
    TicketCategory = apps.get_model("helpdesk", "TicketCategory")
    for department, name, _ in CATEGORIES:
        TicketCategory.objects.filter(department=department, name=name, tickets__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("helpdesk", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_categories, unseed_categories),
    ]
