"""Generate TABLE.md from installed Django models."""

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))
os.chdir(BACKEND_ROOT)

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from django.apps import apps
from django.db import models

SKIP = {"contenttypes", "auth", "admin", "sessions", "token_blacklist"}


def field_type(field):
    if isinstance(field, models.ForeignKey):
        rel = field.related_model._meta.label
        return f"FK → {rel}", f"on_delete={field.remote_field.on_delete.__name__}"
    if isinstance(field, models.OneToOneField):
        rel = field.related_model._meta.label
        return f"O2O → {rel}", f"on_delete={field.remote_field.on_delete.__name__}"
    if isinstance(field, models.ManyToManyField):
        rel = field.related_model._meta.label
        return f"M2M → {rel}", ""

    internal = (
        field.get_internal_type()
        if hasattr(field, "get_internal_type")
        else field.__class__.__name__
    )

    if getattr(field, "choices", None):
        choices = ", ".join(str(c[0]) for c in field.choices[:12])
        if len(field.choices) > 12:
            choices += ", …"
        extra = f"choices: {choices}"
        if internal == "CharField":
            return f"CharField({field.max_length})", extra
        return internal, extra

    if internal == "CharField":
        return f"CharField({field.max_length})", ""
    if internal == "DecimalField":
        return f"Decimal({field.max_digits},{field.decimal_places})", ""
    if internal == "SlugField":
        return f"SlugField({field.max_length})", ""
    if internal == "DateTimeField":
        if getattr(field, "auto_now", False):
            return "DateTimeField", "auto_now"
        if getattr(field, "auto_now_add", False):
            return "DateTimeField", "auto_now_add"
        return "DateTimeField", ""
    return internal, ""


def main():
    lines = [
        "# LMS Database Models",
        "",
        "Reference of Django models in `backend/apps/`, grouped by app.",
        "",
        "Legend: **PK** = primary key, **FK** = foreign key, **O2O** = one-to-one, **UQ** = unique.",
        "",
        "---",
        "",
        "## Abstract Base Models — `apps/core`",
        "",
        "| Mixin | Fields |",
        "| --- | --- |",
        "| `UUIDPrimaryKeyModel` | `id` UUID PK |",
        "| `TimeStampedModel` | `created_at`, `updated_at` |",
        "| `AuditModel` | `created_by`, `updated_by` FK → User |",
        "| `SoftDeleteModel` | `is_deleted`, `deleted_at`, `deleted_by` |",
        "",
        "## Status Enums (current)",
        "",
        "| Domain | Enum | Values |",
        "| --- | --- | --- |",
        "| Lead | `LeadStatus` | `pending_contact`, `contacted`, `follow_up`, `interested`, `not_interested`, `converted`, `closed` |",
        "| Application | `ApplicationStatus` | `documents_pending`, `documents_verified`, `approved`, `rejected`, `cancelled`, `disbursal_sheet_sent`, `disbursed` |",
        "| Loan | `LoanStatus` | `active`, `overdue`, `defaulted`, `closed` |",
        "| Loan | `LoanClosureType` | `normal`, `payday_preclosed`, `pre_closed`, `settlement`, `write_off` |",
        "",
        "## Apps covered",
        "",
        "`accounts` · `activities` · `applications` · `audit_logs` · `collections` · `customers` · `dashboard` · `documents` · `leads` · `ledger` · `loans` · `notifications` · `organization` · `products` · `repayments` · `underwriting` · `workflow`",
        "",
        "---",
        "",
    ]

    app_labels = sorted(
        {
            m._meta.app_config.label
            for m in apps.get_models()
            if m._meta.app_config.label not in SKIP and m._meta.app_config.name.startswith("apps.")
        }
    )

    section = 1
    for label in app_labels:
        app_models = [
            m
            for m in apps.get_models()
            if m._meta.app_config.label == label and not m._meta.abstract
        ]
        if not app_models:
            continue

        lines.append(f"## {section}. `{label}`")
        lines.append("")
        section += 1

        for model in sorted(app_models, key=lambda m: m.__name__):
            lines.append(f"### {model.__name__}")
            lines.append(f"**Table:** `{model._meta.db_table}`")
            bases = [b.__name__ for b in model.__bases__ if b is not models.Model]
            if bases:
                lines.append(f"**Bases:** {', '.join(bases)}")
            lines.append("")
            lines.append("| Field | Type | Notes |")
            lines.append("| --- | --- | --- |")

            for field in model._meta.local_fields:
                name = field.name
                notes = []
                ftype, extra = field_type(field)
                if extra:
                    notes.append(extra)
                if getattr(field, "primary_key", False):
                    notes.append("PK")
                if getattr(field, "unique", False):
                    notes.append("UQ")
                if getattr(field, "null", False):
                    notes.append("nullable")
                if getattr(field, "blank", False):
                    notes.append("blank")
                if getattr(field, "db_index", False):
                    notes.append("indexed")
                if field.default is not models.NOT_PROVIDED:
                    if callable(field.default):
                        notes.append("has default")
                    else:
                        notes.append(f"default={field.default!r}")
                lines.append(f"| `{name}` | {ftype} | {'; '.join(notes)} |")

            for field in model._meta.many_to_many:
                name = field.name
                ftype, extra = field_type(field)
                notes = [extra] if extra else []
                lines.append(f"| `{name}` | {ftype} | {'; '.join(notes)} |")

            lines.append("")

        lines.append("---")
        lines.append("")

    lines.append("## Key Relationships")
    lines.append("")
    lines.append("| From | To | Relation |")
    lines.append("| --- | --- | --- |")

    rels = []
    for model in apps.get_models():
        if model._meta.app_config.label in SKIP or not model._meta.app_config.name.startswith(
            "apps."
        ):
            continue
        for field in model._meta.local_fields:
            if isinstance(field, (models.ForeignKey, models.OneToOneField)):
                rel = "O2O" if isinstance(field, models.OneToOneField) else "FK"
                rels.append((model.__name__, field.related_model.__name__, rel, field.name))

    for row in sorted(rels, key=lambda x: (x[0], x[3])):
        lines.append(f"| {row[0]}.{row[3]} | {row[1]} | {row[2]} |")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("*Generated by `backend/scripts/generate_table_md.py` from live Django models.*")

    output = "\n".join(lines)
    out_path = sys.argv[1] if len(sys.argv) > 1 else "TABLE.md"
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(output)
    print(f"Wrote {out_path} ({len(lines)} lines)")


if __name__ == "__main__":
    main()
