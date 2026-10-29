import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organization', '0004_salary_banks'),
    ]

    operations = [
        migrations.CreateModel(
            name='FieldInvestigator',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, help_text='UTC timestamp when this record was first persisted.', verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, help_text='UTC timestamp of the most recent save.', verbose_name='Updated at')),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255, unique=True)),
                ('phone', models.CharField(blank=True, default='', max_length=20)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
    ]
