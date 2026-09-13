from decimal import Decimal

from django.db import migrations, models


def copy_percentage_fee_to_new_field(apps, schema_editor):
    LoanProduct = apps.get_model("products", "LoanProduct")
    for product in LoanProduct.objects.filter(processing_fee_type="percentage"):
        if not product.processing_fee_percentage and product.processing_fee:
            product.processing_fee_percentage = product.processing_fee
            product.save(update_fields=["processing_fee_percentage"])


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0002_loan_product_schema_update"),
    ]

    operations = [
        migrations.AddField(
            model_name="loanproduct",
            name="processing_fee_percentage",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=5),
        ),
        migrations.AlterField(
            model_name="loanproduct",
            name="processing_fee",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Flat rupee amount when processing_fee_type is fixed.",
                max_digits=12,
            ),
        ),
        migrations.RunPython(copy_percentage_fee_to_new_field, migrations.RunPython.noop),
    ]
