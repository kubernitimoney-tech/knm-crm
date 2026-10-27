"""Add CRM username, password-policy and audit fields; create UserProfile and UserApproval."""

import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_user_display_name"),
        ("organization", "0005_field_investigator"),
    ]

    operations = [
        # Pre-existing metadata drift on RBAC models (no schema change).
        migrations.AlterModelOptions(
            name="permission",
            options={
                "ordering": ["code"],
                "verbose_name": "Permission",
                "verbose_name_plural": "Permissions",
            },
        ),
        migrations.AlterModelOptions(
            name="role",
            options={"ordering": ["name"], "verbose_name": "Role", "verbose_name_plural": "Roles"},
        ),
        migrations.AlterModelOptions(
            name="userrole",
            options={
                "ordering": ["user__email", "role__name"],
                "verbose_name": "User Role",
                "verbose_name_plural": "User Roles",
            },
        ),
        migrations.AlterField(
            model_name="permission",
            name="action",
            field=models.CharField(
                choices=[
                    ("view", "View"),
                    ("create", "Create"),
                    ("update", "Update"),
                    ("delete", "Delete"),
                    ("approve", "Approve"),
                    ("reject", "Reject"),
                    ("assign", "Assign"),
                    ("transfer", "Transfer"),
                    ("upload", "Upload"),
                    ("reupload", "Reupload"),
                    ("download", "Download"),
                    ("export", "Export"),
                    ("sanction", "Sanction"),
                    ("submit", "Submit"),
                    ("send", "Send"),
                    ("convert", "Convert"),
                    ("verify", "Verify"),
                    ("grant", "Grant"),
                    ("revoke", "Revoke"),
                ],
                help_text="Operation allowed within the module.",
                max_length=50,
                verbose_name="Action",
            ),
        ),
        migrations.AlterField(
            model_name="permission",
            name="code",
            field=models.CharField(
                db_index=True,
                editable=False,
                help_text="Auto-generated as module.action (e.g. application.approve).",
                max_length=100,
                unique=True,
                verbose_name="Permission code",
            ),
        ),
        migrations.AlterField(
            model_name="permission",
            name="module",
            field=models.CharField(
                choices=[
                    ("customer", "Customer"),
                    ("lead", "Lead"),
                    ("application", "Application"),
                    ("sanction", "Sanction"),
                    ("disbursal", "Disbursal"),
                    ("loan", "Loan"),
                    ("document", "Document"),
                    ("address", "Address"),
                    ("company", "Company"),
                    ("reference", "Reference"),
                    ("dashboard", "Dashboard"),
                    ("report", "Report"),
                    ("user", "User"),
                    ("role", "Role"),
                    ("workflow", "Workflow"),
                    ("call_log", "Call Log"),
                    ("field_investigation", "Field Investigation"),
                    ("collection", "Collection"),
                    ("redflag", "Red Flag"),
                    ("permission", "Permission"),
                    ("audit", "Audit"),
                ],
                help_text="Functional area this permission applies to.",
                max_length=50,
                verbose_name="Module",
            ),
        ),
        # User: new identity, password-policy and audit fields.
        migrations.AddField(
            model_name="user",
            name="username",
            field=models.CharField(
                max_length=30,
                null=True,
                verbose_name="Username",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="middle_name",
            field=models.CharField(blank=True, max_length=150, verbose_name="Middle name"),
        ),
        migrations.AddField(
            model_name="user",
            name="must_change_password",
            field=models.BooleanField(
                default=False,
                help_text="Set when an admin issues a temporary password; cleared on change.",
                verbose_name="Must change password",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="password_changed_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Password changed at"),
        ),
        migrations.AddField(
            model_name="user",
            name="password_expires_at",
            field=models.DateTimeField(
                blank=True,
                help_text="A temporary password cannot be used to sign in after this time.",
                null=True,
                verbose_name="Temporary password expires at",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users_created",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Created by",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="updated_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users_updated",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Updated by",
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(
                db_index=True,
                help_text="Primary login identifier. Stored lowercase; unique across the system.",
                max_length=254,
                unique=True,
                verbose_name="Email address",
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="is_verified",
            field=models.BooleanField(
                default=False,
                help_text="True once the onboarding approval has been granted.",
                verbose_name="Verified",
            ),
        ),
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "mobile_number",
                    models.CharField(
                        blank=True,
                        db_index=True,
                        help_text="10-digit Indian mobile. Required for new users.",
                        max_length=20,
                        verbose_name="Mobile number",
                    ),
                ),
                ("address", models.TextField(blank=True, verbose_name="Address")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "branch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="user_profiles",
                        to="organization.branch",
                        verbose_name="Branch",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "User Profile",
                "verbose_name_plural": "User Profiles",
            },
        ),
        migrations.CreateModel(
            name="UserApproval",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "attachment",
                    models.FileField(
                        blank=True,
                        help_text="Approval mail or document (PDF, EML, MSG, PNG, JPG; max 5 MB).",
                        upload_to="user_approvals/%Y/%m/",
                        verbose_name="Approval attachment",
                    ),
                ),
                (
                    "attachment_name",
                    models.CharField(blank=True, max_length=255, verbose_name="Original file name"),
                ),
                ("request_remarks", models.TextField(verbose_name="Request remarks")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        default=django.utils.timezone.now, verbose_name="Requested at"
                    ),
                ),
                (
                    "approved_at",
                    models.DateTimeField(blank=True, null=True, verbose_name="Reviewed at"),
                ),
                ("approver_remarks", models.TextField(blank=True, verbose_name="Approver remarks")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="user_approvals_reviewed",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Reviewed by",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="user_approvals_requested",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Requested by",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="approval",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "User Approval",
                "verbose_name_plural": "User Approvals",
                "ordering": ["-created_at"],
            },
        ),
    ]
