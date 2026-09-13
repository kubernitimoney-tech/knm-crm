from datetime import date
from decimal import Decimal

from django.utils.dateparse import parse_date
from rest_framework import serializers

from apps.applications.models import ApplicationDecision, LoanApplication
from apps.applications.services.sanction_salary_bank_service import (
    SanctionSalaryBankServiceError,
    prepare_sanction_details,
)
from apps.core.india_validators import validate_indian_cibil_score, validate_sanction_income_limits
from apps.core.validators.india import validate_cheque_number


class ApplicationDecisionSerializer(serializers.ModelSerializer):
    decided_by_email = serializers.EmailField(source="decided_by.email", read_only=True)
    decided_by_name = serializers.CharField(source="decided_by.get_full_name", read_only=True)
    interest_rate = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationDecision
        fields = [
            "id",
            "decision",
            "decided_by",
            "decided_by_email",
            "decided_by_name",
            "approved_amount",
            "approved_tenure_value",
            "interest_rate",
            "processing_fee",
            "rejection_reason",
            "remarks",
            "sanction_details",
            "decided_at",
        ]
        read_only_fields = fields

    def get_interest_rate(self, obj):
        if obj.interest_rate is None:
            return None
        return f"{obj.interest_rate:.2f}"


class LoanApplicationSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    product_code = serializers.CharField(source="product.product_code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    latest_decision = serializers.SerializerMethodField()

    class Meta:
        model = LoanApplication
        fields = [
            "id",
            "application_number",
            "customer",
            "customer_name",
            "lead",
            "product",
            "product_code",
            "product_name",
            "branch",
            "requested_amount",
            "approved_amount",
            "tenure_value",
            "tenure_unit",
            "purpose",
            "status",
            "status_display",
            "workflow",
            "current_state",
            "assigned_rm",
            "assigned_cm",
            "customer_snapshot",
            "product_snapshot",
            "submitted_at",
            "decided_at",
            "latest_decision",
            "disbursal_sheet_details",
            "disbursal_sheet_sent_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "application_number", "created_at", "updated_at"]

    def get_latest_decision(self, obj):
        prefetched = getattr(obj, "_prefetched_objects_cache", {}).get("decisions")
        if prefetched:
            decision = max(prefetched, key=lambda item: item.decided_at)
        else:
            decision = obj.decisions.order_by("-decided_at").first()

        # After decide(), the in-memory prefetch cache can be stale/empty while DB has a row.
        if decision is None and obj.decided_at:
            decision = (
                ApplicationDecision.objects.filter(application_id=obj.pk)
                .order_by("-decided_at")
                .first()
            )
        if decision is None:
            return None
        return ApplicationDecisionSerializer(decision, context=self.context).data


class ApplicationCreateSerializer(serializers.Serializer):
    customer_id = serializers.UUIDField()
    product_id = serializers.UUIDField()
    requested_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    tenure_value = serializers.IntegerField(required=False, min_value=1)
    purpose = serializers.CharField(required=False, allow_blank=True, default="")
    branch_id = serializers.UUIDField(required=False, allow_null=True)


class ApplicationDecisionWriteSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approved", "rejected"])
    approved_amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=Decimal("0"),
    )
    approved_tenure_value = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    interest_rate = serializers.DecimalField(
        max_digits=8, decimal_places=4, required=False, allow_null=True
    )
    processing_fee = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    rejection_reason = serializers.CharField(required=False, allow_blank=True, default="")
    remarks = serializers.CharField(required=False, allow_blank=True, default="")
    sanction_details = serializers.JSONField(required=False)

    def validate(self, attrs):
        details = attrs.get("sanction_details") or {}
        cibil = details.get("cibil_score")
        decision = attrs.get("decision")
        required = decision in ("approved", "rejected")
        try:
            normalized = validate_indian_cibil_score(cibil, required=required)
        except ValueError as exc:
            raise serializers.ValidationError(
                {"sanction_details": {"cibil_score": str(exc)}}
            ) from exc
        if normalized is not None:
            details = dict(details)
            details["cibil_score"] = normalized
            attrs["sanction_details"] = details

        if decision == "approved":
            try:
                attrs["sanction_details"] = prepare_sanction_details(details)
                details = attrs["sanction_details"]
            except SanctionSalaryBankServiceError as exc:
                raise serializers.ValidationError({"sanction_details": str(exc)}) from exc
            try:
                validate_sanction_income_limits(
                    approved_amount=attrs.get("approved_amount"),
                    monthly_income=details.get("monthly_income"),
                    monthly_obligation=details.get("monthly_obligation"),
                )
            except ValueError as exc:
                raise serializers.ValidationError({"sanction_details": str(exc)}) from exc

        return attrs


class SanctionFeeCalculateSerializer(serializers.Serializer):
    principal_amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        min_value=Decimal("0"),
    )
    pf_percentage = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, default=0
    )
    gst_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )


class DisbursalSheetWriteSerializer(serializers.Serializer):
    company_account = serializers.CharField(required=False, allow_blank=True, default="")
    account_number = serializers.CharField()
    ifsc_code = serializers.CharField()
    bank_name = serializers.CharField(required=False, allow_blank=True, default="")
    branch = serializers.CharField(required=False, allow_blank=True, default="")
    cheque_no = serializers.CharField(required=False, allow_blank=True, default="")
    enach_id = serializers.CharField(required=False, allow_blank=True, default="")
    fi_date = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    fi_type = serializers.CharField(required=False, allow_blank=True, default="")
    fi_done_by = serializers.CharField(required=False, allow_blank=True, default="")
    amount_to_be_disbursed = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    total_deduction = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    payment_type = serializers.CharField(required=False, allow_blank=True, default="IMPS")
    remarks = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        try:
            attrs["cheque_no"] = validate_cheque_number(
                attrs.get("cheque_no", ""),
                field_label="Cheque number",
            )
        except ValueError as exc:
            raise serializers.ValidationError({"cheque_no": str(exc)}) from exc
        fi_date_raw = attrs.get("fi_date")
        if fi_date_raw:
            parsed = parse_date(str(fi_date_raw).strip()[:10])
            if not parsed:
                raise serializers.ValidationError({"fi_date": "FI date is invalid."})
            if parsed > date.today():
                raise serializers.ValidationError({"fi_date": "FI date cannot be after today."})
            attrs["fi_date"] = parsed.isoformat()
        return attrs
