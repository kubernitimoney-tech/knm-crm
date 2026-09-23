from unittest.mock import patch

import pytest

from apps.core.services.ifsc_service import (
    IfscDetails,
    IfscLookupError,
    apply_ifsc_bank_details,
    resolve_ifsc_bank_details,
)


class TestIfscDisbursalHelpers:
    def test_apply_ifsc_bank_details_fills_bank_and_branch(self):
        with patch("apps.core.services.ifsc_service.lookup_ifsc") as lookup:
            lookup.return_value = IfscDetails(
                ifsc_code="CBIN0200037",
                bank_name="Central Bank Of India",
                branch="Gopalganj",
                city="Gopalganj",
                state="BIHAR",
            )
            result = apply_ifsc_bank_details(
                {
                    "ifsc_code": "CBIN0200037",
                    "bank_name": "Wrong Bank",
                    "branch": "Wrong Branch",
                }
            )

        assert result["bank_name"] == "Central Bank Of India"
        assert result["branch"] == "Gopalganj"

    def test_apply_ifsc_bank_details_raises_when_ifsc_invalid(self):
        with patch("apps.core.services.ifsc_service.lookup_ifsc") as lookup:
            lookup.side_effect = IfscLookupError("IFSC not found")
            with pytest.raises(IfscLookupError):
                apply_ifsc_bank_details({"ifsc_code": "CBIN0200037"})

    def test_resolve_ifsc_bank_details_returns_empty_on_failure(self):
        with patch("apps.core.services.ifsc_service.lookup_ifsc") as lookup:
            lookup.side_effect = IfscLookupError("IFSC not found")
            result = resolve_ifsc_bank_details("CBIN0200037")

        assert result == {"bank_name": "", "branch": ""}
