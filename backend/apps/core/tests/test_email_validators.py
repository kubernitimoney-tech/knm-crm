import pytest

from apps.core.validators.email import (
    extract_email_domain,
    is_disposable_email_domain,
    validate_business_email,
)


class TestDisposableEmailDomains:
    @pytest.mark.parametrize(
        "email",
        [
            "user@mailinator.com",
            "user@yopmail.com",
            "user@guerrillamail.com",
            "user@sub.mailinator.com",
        ],
    )
    def test_blocks_disposable_addresses(self, email):
        with pytest.raises(ValueError, match="disposable email provider"):
            validate_business_email(email)

    @pytest.mark.parametrize(
        "email",
        [
            "user@gmail.com",
            "borrower@hdfcbank.com",
            "contact@company.co.in",
        ],
    )
    def test_allows_regular_addresses(self, email):
        assert validate_business_email(email) == email.lower()

    def test_extract_domain(self):
        assert extract_email_domain("Test@Example.COM") == "example.com"

    def test_is_disposable_subdomain(self):
        assert is_disposable_email_domain("foo.mailinator.com") is True
        assert is_disposable_email_domain("gmail.com") is False

    def test_blank_allowed(self):
        assert validate_business_email("", allow_blank=True) == ""

    def test_blank_required(self):
        with pytest.raises(ValueError, match="is required"):
            validate_business_email("")
