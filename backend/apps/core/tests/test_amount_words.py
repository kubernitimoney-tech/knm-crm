from django.test import SimpleTestCase

from apps.core.amount_words import indian_amount_in_words


class TestIndianAmountInWords(SimpleTestCase):
    def test_sample_repayment_amount(self):
        assert indian_amount_in_words(53200) == "Fifty-Three Thousand Two Hundred"

    def test_principal_amount(self):
        assert indian_amount_in_words(40000) == "Forty Thousand"

    def test_zero_and_blank(self):
        assert indian_amount_in_words(0) == "Zero"
        assert indian_amount_in_words("") == ""
        assert indian_amount_in_words(None) == ""

    def test_lakh(self):
        assert indian_amount_in_words(150000) == "One Lakh Fifty Thousand"
