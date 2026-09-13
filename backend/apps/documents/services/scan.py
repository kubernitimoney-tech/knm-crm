from django.conf import settings


def scan_file_for_virus(file) -> str:
    if not settings.DOCUMENT_VIRUS_SCAN_ENABLED:
        return "clean"
    return "pending"
