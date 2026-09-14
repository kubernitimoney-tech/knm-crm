from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("leads", "0025_leadesignrequest_source_file_sign_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="leadvideokycrequest",
            name="selfie_file",
            field=models.FileField(blank=True, upload_to="lead_video_kyc/selfie/%Y/%m/"),
        ),
    ]
