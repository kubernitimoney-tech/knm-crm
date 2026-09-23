from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("leads", "0023_call_disposition_status_updates"),
    ]

    operations = [
        migrations.AddField(
            model_name="leadesignrequest",
            name="access_token",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="leadesignrequest",
            name="provider",
            field=models.CharField(
                choices=[("digio", "Digio")],
                db_index=True,
                default="digio",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="leadesignrequest",
            name="provider_request_id",
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name="leadesignrequest",
            name="request_url",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="leadvideokycrequest",
            name="access_token",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="leadvideokycrequest",
            name="provider",
            field=models.CharField(
                choices=[("digio", "Digio")],
                db_index=True,
                default="digio",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="leadvideokycrequest",
            name="provider_request_id",
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddField(
            model_name="leadvideokycrequest",
            name="request_url",
            field=models.URLField(blank=True, max_length=500),
        ),
    ]
