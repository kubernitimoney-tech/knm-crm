from django.core.management.base import BaseCommand

from apps.documents.catalog import LEAD_DOCUMENT_TYPE_CATALOG
from apps.documents.models import DocumentType


class Command(BaseCommand):
    help = "Seed document types"

    def handle(self, *args, **options):
        for code, (name, required) in LEAD_DOCUMENT_TYPE_CATALOG.items():
            DocumentType.objects.update_or_create(
                code=code,
                defaults={"name": name, "is_required": required},
            )
        self.stdout.write(self.style.SUCCESS("Document types seeded."))
