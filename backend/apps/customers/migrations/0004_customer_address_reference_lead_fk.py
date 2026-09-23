from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0003_trim_identity_type_choices"),
        ("leads", "0003_lead_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="customeraddress",
            name="lead",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="addresses",
                to="leads.lead",
            ),
        ),
        migrations.AddField(
            model_name="customerreference",
            name="lead",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="references",
                to="leads.lead",
            ),
        ),
    ]
