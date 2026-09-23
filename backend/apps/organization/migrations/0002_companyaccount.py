import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import apps.core.encryption


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CompanyAccount",
            fields=[
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        db_index=True,
                        help_text="UTC timestamp when this record was first persisted.",
                        verbose_name="Created at",
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True,
                        help_text="UTC timestamp of the most recent save.",
                        verbose_name="Updated at",
                    ),
                ),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("account_name", models.CharField(max_length=255)),
                ("account_number", apps.core.encryption.EncryptedCharField(max_length=50)),
                ("ifsc_code", models.CharField(max_length=11)),
                ("bank_name", models.CharField(max_length=255)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "is_default",
                    models.BooleanField(
                        db_index=True,
                        default=False,
                        help_text="Default account pre-filled on disbursal sheets.",
                    ),
                ),
                (
                    "branch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="company_accounts",
                        to="organization.branch",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        help_text="User who created this record.",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(app_label)s_%(class)s_created",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Created by",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        help_text="User who last updated this record.",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(app_label)s_%(class)s_updated",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Updated by",
                    ),
                ),
            ],
            options={
                "ordering": ["account_name"],
                "indexes": [models.Index(fields=["is_active", "is_default"], name="organizatio_is_acti_8a1f2c_idx")],
            },
        ),
    ]
