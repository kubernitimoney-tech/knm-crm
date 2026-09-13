from django.db import models


class EntryVerificationStatus(models.TextChoices):
    UNVERIFIED = "unverified", "Unverified"
    VERIFIED = "verified", "Verified"
    INCOMPLETE = "incomplete", "Incomplete"


def is_verified_status(status: str) -> bool:
    return status == EntryVerificationStatus.VERIFIED


def blocks_document_completion(status: str) -> bool:
    return status in {
        EntryVerificationStatus.UNVERIFIED,
        EntryVerificationStatus.INCOMPLETE,
    }


def apply_entry_verification_status(instance, status: str) -> None:
    instance.verification_status = status
    instance.is_verified = is_verified_status(status)


def read_entry_verification_status(instance) -> str:
    status = getattr(instance, "verification_status", None)
    if status:
        return status
    return (
        EntryVerificationStatus.VERIFIED
        if getattr(instance, "is_verified", False)
        else EntryVerificationStatus.UNVERIFIED
    )
