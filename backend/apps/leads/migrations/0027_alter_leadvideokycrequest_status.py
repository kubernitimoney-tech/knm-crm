from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("leads", "0026_leadvideokycrequest_selfie_file"),
    ]

    operations = [
        migrations.AlterField(
            model_name="leadvideokycrequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("sent", "Sent"),
                    ("video_pending", "Video Pending"),
                    ("completed", "Completed"),
                    ("expired", "Expired"),
                ],
                default="sent",
                max_length=20,
            ),
        ),
    ]
