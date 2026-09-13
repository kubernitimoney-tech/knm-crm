from rest_framework import serializers

from apps.repayments.models import LoanRepayment, PaymentMode


class LoanRepaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanRepayment
        fields = [
            "id",
            "loan",
            "amount",
            "payment_mode",
            "utr",
            "payment_date",
            "gateway_reference",
            "status",
            "remarks",
            "created_at",
        ]
        read_only_fields = fields


class RecordRepaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    payment_mode = serializers.ChoiceField(choices=PaymentMode.choices)
    utr = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    payment_date = serializers.DateTimeField(required=False, allow_null=True)
    gateway_reference = serializers.CharField(required=False, allow_blank=True, default="")
    remarks = serializers.CharField(required=False, allow_blank=True, default="")
    collection_status = serializers.ChoiceField(
        choices=[
            ("part_payment", "Part Payment"),
            ("close", "Closed"),
            ("payday_pre_close", "Payday Pre-Close"),
            ("settlement", "Settlement"),
        ],
        required=False,
        allow_null=True,
    )

    def validate_payment_date(self, value):
        from django.utils import timezone

        if value is not None and value > timezone.now():
            raise serializers.ValidationError(
                "Collection date and time cannot be after the current date and time."
            )
        return value


class UpdateRepaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    payment_mode = serializers.ChoiceField(choices=PaymentMode.choices, required=False)
    utr = serializers.CharField(required=False, allow_blank=False, trim_whitespace=True)
    payment_date = serializers.DateTimeField(required=False, allow_null=True)
    gateway_reference = serializers.CharField(required=False, allow_blank=True)
    remarks = serializers.CharField(required=False, allow_blank=True)
    collection_status = serializers.ChoiceField(
        choices=[
            ("part_payment", "Part Payment"),
            ("close", "Closed"),
            ("payday_pre_close", "Payday Pre-Close"),
            ("settlement", "Settlement"),
        ],
        required=False,
        allow_null=True,
    )

    def validate_payment_date(self, value):
        from django.utils import timezone

        if value is not None and value > timezone.now():
            raise serializers.ValidationError(
                "Collection date and time cannot be after the current date and time."
            )
        return value

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("At least one field is required to update.")
        return attrs
