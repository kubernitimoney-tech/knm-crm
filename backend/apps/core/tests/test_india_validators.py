import pytest

from apps.core.validators.india import normalize_mobile, validate_mobile


class TestNormalizeMobile:
    def test_strips_non_digits(self):
        assert normalize_mobile("+91 98765 43210") == "9876543210"

    def test_strips_country_code(self):
        assert normalize_mobile("919876543210") == "9876543210"

    def test_strips_leading_zero(self):
        assert normalize_mobile("09876543210") == "9876543210"

    def test_plain_ten_digits(self):
        assert normalize_mobile("9876543210") == "9876543210"


class TestValidateMobile:
    @pytest.mark.parametrize(
        "value",
        ["9876543210", "8765432109", "7654321098", "6543210987", "+91 9876543210", "919876543210"],
    )
    def test_accepts_valid_indian_mobile(self, value):
        assert validate_mobile(value) == normalize_mobile(value)

    @pytest.mark.parametrize(
        "value",
        ["1234567890", "5123456789", "2222222222", "12345", "98765432101"],
    )
    def test_rejects_invalid_mobile(self, value):
        with pytest.raises(ValueError, match="valid 10-digit Indian mobile"):
            validate_mobile(value)

    def test_blank_required(self):
        with pytest.raises(ValueError, match="is required"):
            validate_mobile("")

    def test_blank_allowed(self):
        assert validate_mobile("", allow_blank=True) == ""


class TestValidateChequeNumber:
    @pytest.mark.parametrize("value", ["123456", "000001", " 12 34 56 "])
    def test_accepts_valid_cheque_number(self, value):
        from apps.core.validators.india import normalize_cheque_number, validate_cheque_number

        assert validate_cheque_number(value) == normalize_cheque_number(value)

    @pytest.mark.parametrize("value", ["", "12345", "1234567", "ABC123"])
    def test_rejects_invalid_cheque_number(self, value):
        from apps.core.validators.india import validate_cheque_number

        with pytest.raises(ValueError):
            validate_cheque_number(value)
