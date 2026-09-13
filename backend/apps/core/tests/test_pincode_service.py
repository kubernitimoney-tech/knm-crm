import json
from io import BytesIO
from unittest.mock import patch

import pytest

from apps.core.services.pincode_service import PincodeLookupError, lookup_pincode


@patch("apps.core.services.pincode_service.urlopen")
def test_lookup_pincode_success(mock_urlopen):
    mock_urlopen.return_value.__enter__.return_value = BytesIO(
        json.dumps(
            [
                {
                    "Status": "Success",
                    "PostOffice": [
                        {
                            "Name": "Mumbai GPO",
                            "BranchType": "Head Post Office",
                            "DeliveryStatus": "Delivery",
                            "District": "Mumbai",
                            "State": "Maharashtra",
                            "Pincode": "400001",
                        }
                    ],
                }
            ]
        ).encode()
    )

    details = lookup_pincode("400001")
    assert details.pincode == "400001"
    assert details.city == "Mumbai"
    assert details.state == "Maharashtra"


@patch("apps.core.services.pincode_service.urlopen")
def test_lookup_pincode_not_found(mock_urlopen):
    mock_urlopen.return_value.__enter__.return_value = BytesIO(
        json.dumps([{"Status": "Error", "PostOffice": None}]).encode()
    )

    with pytest.raises(PincodeLookupError, match="Pincode not found"):
        lookup_pincode("000000")
