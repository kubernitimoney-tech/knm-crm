from django.db import migrations


def rename_admin_gst_to_gst(apps, schema_editor):
    ApplicationDecision = apps.get_model("applications", "ApplicationDecision")
    LoanApplication = apps.get_model("applications", "LoanApplication")

    for decision in ApplicationDecision.objects.all().iterator():
        details = dict(decision.sanction_details or {})
        if "admin_gst" in details:
            details.setdefault("gst", details.pop("admin_gst"))
            decision.sanction_details = details
            decision.save(update_fields=["sanction_details"])

    for application in LoanApplication.objects.all().iterator():
        details = dict(application.disbursal_sheet_details or {})
        if "admin_gst" in details:
            details.setdefault("gst", details.pop("admin_gst"))
            application.disbursal_sheet_details = details
            application.save(update_fields=["disbursal_sheet_details"])


class Migration(migrations.Migration):
    dependencies = [
        ("applications", "0009_application_status_enum_update"),
    ]

    operations = [
        migrations.RunPython(rename_admin_gst_to_gst, migrations.RunPython.noop),
    ]
