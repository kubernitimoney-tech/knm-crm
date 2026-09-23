from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("leads", "0024_digio_provider_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="leadesignrequest",
            name="source_file",
            field=models.FileField(blank=True, upload_to="lead_esign/source/%Y/%m/"),
        ),
        migrations.AddField(
            model_name="leadesignrequest",
            name="sign_type",
            field=models.CharField(
                choices=[("aadhaar", "Aadhaar OTP"), ("electronic", "Email OTP")],
                default="electronic",
                max_length=20,
            ),
        ),
    ]
