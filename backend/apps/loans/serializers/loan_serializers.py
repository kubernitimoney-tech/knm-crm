from django.utils import timezone
from rest_framework import serializers

from apps.ledger.selectors.balance_selectors import get_latest_balance
from apps.loans.models import Loan, LoanDisbursement
from apps.loans.services.loan_service import LoanService


class LoanSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    product_code = serializers.CharField(source="product.product_code", read_only=True)
    outstanding_balance = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Loan
        fields = [
            "id",
            "loan_account_number",
            "application",
            "customer",
            "customer_name",
            "product",
            "product_code",
            "branch",
            "principal_amount",
            "processing_fee",
            "interest_amount",
            "total_repayable",
            "product_snapshot",
            "outstanding_balance",
            "interest_rate",
            "due_date",
            "status",
            "status_display",
            "disbursed_at",
            "closed_at",
            "created_at",
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["loan_account_number"] = LoanService.display_loan_account_number(
            instance.loan_account_number
        )
        return data

    def get_outstanding_balance(self, obj):
        return str(get_latest_balance(obj.id))


class LoanDisbursementSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanDisbursement
        fields = [
            "id",
            "loan",
            "disbursed_amount",
            "gross_amount",
            "deductions",
            "payment_mode",
            "utr_reference",
            "disbursed_at",
            "status",
            "remarks",
        ]
        read_only_fields = ["id", "loan", "disbursed_at", "status"]


class DisburseLoanSerializer(serializers.Serializer):
    utr_reference = serializers.CharField(max_length=100)
    disbursed_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    payment_mode = serializers.CharField(max_length=20, required=False, default="NEFT")
    disbursed_at = serializers.DateTimeField(required=False, allow_null=True)
    disbursal_type = serializers.ChoiceField(
        choices=["auto", "manual"],
        required=False,
        allow_blank=True,
    )
    remarks = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_disbursed_at(self, value):
        if not value:
            return value
        disbursed_date = (
            timezone.localtime(value).date() if timezone.is_aware(value) else value.date()
        )
        if disbursed_date > timezone.localdate():
            raise serializers.ValidationError("Disbursed date cannot be after today.")
        return value
