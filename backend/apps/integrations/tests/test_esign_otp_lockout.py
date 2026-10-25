import uuid
from types import SimpleNamespace

import pytest
from django.core.cache import cache

from apps.integrations.digio.esign import (
    EMAIL_OK_KEY,
    EMAIL_OTP_KEY,
    OTP_LOCKED_MESSAGE,
    OTP_MAX_ATTEMPTS,
    verify_esign_email_otp,
)
from apps.integrations.digio.exceptions import DigioValidationError


@pytest.fixture
def row():
    cache.clear()
    yield SimpleNamespace(id=uuid.uuid4(), status="pending")
    cache.clear()


def test_email_otp_locks_after_max_wrong_attempts(row):
    cache.set(EMAIL_OTP_KEY.format(row.id), "123456", timeout=600)
    for _ in range(OTP_MAX_ATTEMPTS - 1):
        with pytest.raises(DigioValidationError, match="incorrect"):
            verify_esign_email_otp(row=row, otp="000000")
    with pytest.raises(DigioValidationError, match=OTP_LOCKED_MESSAGE):
        verify_esign_email_otp(row=row, otp="000000")
    # The real code no longer works once locked; a new code must be requested.
    with pytest.raises(DigioValidationError, match="Request a new verification code"):
        verify_esign_email_otp(row=row, otp="123456")
    assert not cache.get(EMAIL_OK_KEY.format(row.id))


def test_email_otp_correct_code_still_works(row):
    cache.set(EMAIL_OTP_KEY.format(row.id), "123456", timeout=600)
    with pytest.raises(DigioValidationError):
        verify_esign_email_otp(row=row, otp="000000")
    verify_esign_email_otp(row=row, otp="123456")
    assert cache.get(EMAIL_OK_KEY.format(row.id))
