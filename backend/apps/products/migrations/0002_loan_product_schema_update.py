from django.db import migrations, models


def migrate_processing_fee_types(apps, schema_editor):
    LoanProduct = apps.get_model("products", "LoanProduct")
    LoanProduct.objects.filter(processing_fee_type="flat").update(processing_fee_type="fixed")
    LoanProduct.objects.filter(processing_fee_type="percent").update(processing_fee_type="percentage")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("products", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="loanproduct",
            old_name="product_name",
            new_name="name",
        ),
        migrations.RenameField(
            model_name="loanproduct",
            old_name="interest_calculation",
            new_name="interest_type",
        ),
        migrations.RenameField(
            model_name="loanproduct",
            old_name="gst_rate",
            new_name="gst_percentage",
        ),
        migrations.AddField(
            model_name="loanproduct",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="loanproduct",
            name="preclosure_allowed",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="loanproduct",
            name="part_payment_allowed",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="loanproduct",
            name="max_part_payments",
            field=models.PositiveIntegerField(default=999),
        ),
        migrations.AddField(
            model_name="loanproduct",
            name="overdue_after_days",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="loanproduct",
            name="default_after_days",
            field=models.PositiveIntegerField(default=30),
        ),
        migrations.AlterField(
            model_name="loanproduct",
            name="product_code",
            field=models.CharField(db_index=True, max_length=20, unique=True),
        ),
        migrations.AlterField(
            model_name="loanproduct",
            name="min_amount",
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.AlterField(
            model_name="loanproduct",
            name="max_amount",
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
        migrations.AlterField(
            model_name="loanproduct",
            name="processing_fee",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AlterField(
            model_name="loanproduct",
            name="interest_type",
            field=models.CharField(
                choices=[
                    ("flat", "Flat"),
                    ("reducing", "Reducing"),
                    ("fixed", "Fixed"),
                ],
                default="flat",
                max_length=20,
            ),
        ),
        migrations.RunPython(migrate_processing_fee_types, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="loanproduct",
            name="processing_fee_type",
            field=models.CharField(
                choices=[("fixed", "Fixed"), ("percentage", "Percentage")],
                default="fixed",
                max_length=20,
            ),
        ),
        migrations.RemoveField(
            model_name="loanproduct",
            name="penalty_rate",
        ),
        migrations.RemoveField(
            model_name="loanproduct",
            name="penalty_grace_days",
        ),
        migrations.RemoveField(
            model_name="loanproduct",
            name="product_config",
        ),
        migrations.RemoveField(
            model_name="loanproduct",
            name="workflow",
        ),
    ]
