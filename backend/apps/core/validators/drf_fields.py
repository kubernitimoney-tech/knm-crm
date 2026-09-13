from rest_framework import serializers

from apps.core.validators.email import validate_business_email
from apps.core.validators.india import (
    validate_aadhaar,
    validate_gstin,
    validate_ifsc,
    validate_mobile,
    validate_pan,
    validate_pincode,
)


class _ValidatedCharField(serializers.CharField):
    validator = staticmethod(lambda value, **kwargs: value)
    field_label = "Value"

    def __init__(self, **kwargs):
        self._validate_allow_blank = kwargs.get("allow_blank", False)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        try:
            return self.validator(
                value, allow_blank=self._validate_allow_blank, field_label=self.field_label
            )
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class IndianMobileField(_ValidatedCharField):
    field_label = "Mobile number"

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", 10)
        super().__init__(**kwargs)

    validator = staticmethod(validate_mobile)


class IfscField(_ValidatedCharField):
    field_label = "IFSC code"

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", 11)
        super().__init__(**kwargs)

    validator = staticmethod(validate_ifsc)


class PincodeField(_ValidatedCharField):
    field_label = "PIN code"

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", 6)
        super().__init__(**kwargs)

    validator = staticmethod(validate_pincode)


class PanField(_ValidatedCharField):
    field_label = "PAN number"

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", 10)
        super().__init__(**kwargs)

    validator = staticmethod(validate_pan)


class AadhaarField(_ValidatedCharField):
    field_label = "Aadhaar number"

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", 12)
        super().__init__(**kwargs)

    validator = staticmethod(validate_aadhaar)


class GstinField(_ValidatedCharField):
    field_label = "GSTIN"

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", 15)
        super().__init__(**kwargs)

    validator = staticmethod(validate_gstin)


class BusinessEmailField(serializers.EmailField):
    field_label = "Email"

    def __init__(self, **kwargs):
        self._validate_allow_blank = kwargs.get("allow_blank", False)
        self.field_label = kwargs.pop("field_label", self.field_label)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        try:
            return validate_business_email(
                value,
                allow_blank=self._validate_allow_blank,
                field_label=self.field_label,
            )
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
