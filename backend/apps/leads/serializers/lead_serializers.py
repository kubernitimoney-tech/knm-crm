from datetime import date
from decimal import Decimal

from rest_framework import serializers

from apps.core.validators.drf_fields import (
    AadhaarField,
    BusinessEmailField,
    IndianMobileField,
    PanField,
    PincodeField,
)
from apps.customers.models import AddressType, EmploymentType
from apps.customers.services.customer_service import CustomerService
from apps.leads.constants import LOAN_PURPOSE_OPTIONS, LOAN_PURPOSE_SET, MIN_LEAD_MONTHLY_INCOME
from apps.leads.models import CallDisposition, CallLog, Lead, LeadFollowUpRemark, LeadSource
from apps.leads.services.lead_conversion_service import LeadConversionService
from apps.leads.utils.lead_enrichment import resolve_current_employment, resolve_location
from apps.loans.services.loan_calculation_service import LoanCalculationService


def _latest_approved_decision(application):
    if application is None:
        return None
    prefetched = getattr(application, "_prefetched_objects_cache", {}).get("decisions")
    if prefetched is not None:
        approved = [row for row in prefetched if row.decision == "approved"]
        return max(approved, key=lambda row: row.decided_at) if approved else None
    return application.decisions.filter(decision="approved").order_by("-decided_at").first()


def _active_loan_for_application(application):
    if application is None:
        return None
    loan = getattr(application, "loan", None)
    if loan is not None and not loan.is_deleted:
        return loan
    return None


def _latest_repayment_payment_date(loan):
    if loan is None:
        return None
    prefetched = getattr(loan, "_prefetched_objects_cache", {}).get("repayments")
    if prefetched is not None:
        dated = [row for row in prefetched if row.payment_date]
        return max(dated, key=lambda row: row.payment_date).payment_date if dated else None
    repayment = loan.repayments.filter(payment_date__isnull=False).order_by("-payment_date").first()
    return repayment.payment_date if repayment else None


def _decimal_string(value) -> str | None:
    if value is None:
        return None
    return str(value)


class LeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSource
        fields = ["id", "name", "slug", "is_active"]
        read_only_fields = ["id"]


def _user_label(user) -> str | None:
    if not user:
        return None
    full = user.get_full_name() if hasattr(user, "get_full_name") else ""
    return full.strip() or user.email


class LeadListSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    email = serializers.EmailField(source="customer.email", read_only=True)
    mobile_number = serializers.CharField(source="customer.mobile_number", read_only=True)
    pan_no = serializers.SerializerMethodField()
    aadhaar_no = serializers.SerializerMethodField()
    customer_code = serializers.CharField(source="customer.customer_code", read_only=True)
    customer_gender = serializers.CharField(source="customer.gender", read_only=True)
    customer_dob = serializers.DateField(source="customer.dob", read_only=True, allow_null=True)
    assigned_rm_name = serializers.SerializerMethodField()
    assigned_rm_email = serializers.EmailField(source="assigned_rm.email", read_only=True)
    assigned_cm_name = serializers.SerializerMethodField()
    source_name = serializers.CharField(source="source.name", read_only=True, default=None)
    product_code = serializers.CharField(
        source="interested_product.product_code", read_only=True, default=None
    )
    product_name = serializers.CharField(
        source="interested_product.name", read_only=True, default=None
    )
    loan_purpose = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    close_reason = serializers.CharField(read_only=True)
    close_reason_display = serializers.CharField(source="get_close_reason_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    monthly_income = serializers.SerializerMethodField()
    employment_type = serializers.SerializerMethodField()
    employment_type_display = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()
    pincode = serializers.SerializerMethodField()
    application_status = serializers.SerializerMethodField()
    application_status_display = serializers.SerializerMethodField()
    latest_call_disposition = serializers.SerializerMethodField()
    latest_call_disposition_display = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            "id",
            "lead_id",
            "status",
            "status_display",
            "close_reason",
            "close_reason_display",
            "category",
            "category_display",
            "customer",
            "customer_name",
            "email",
            "mobile_number",
            "pan_no",
            "aadhaar_no",
            "customer_code",
            "customer_gender",
            "customer_dob",
            "required_amount",
            "monthly_income",
            "employment_type",
            "employment_type_display",
            "city",
            "state",
            "pincode",
            "assigned_rm",
            "assigned_rm_name",
            "assigned_rm_email",
            "assigned_cm",
            "assigned_cm_name",
            "source",
            "source_name",
            "interested_product",
            "product_code",
            "product_name",
            "loan_purpose",
            "converted_application",
            "converted_at",
            "application_status",
            "application_status_display",
            "latest_call_disposition",
            "latest_call_disposition_display",
            "submitted_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_customer_name(self, obj):
        return obj.customer.full_name

    def get_pan_no(self, obj):
        return CustomerService.get_primary_pan(obj.customer)

    def get_aadhaar_no(self, obj):
        return CustomerService.get_primary_aadhaar(obj.customer)

    def get_assigned_rm_name(self, obj):
        return _user_label(obj.assigned_rm)

    def get_assigned_cm_name(self, obj):
        return _user_label(obj.assigned_cm)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not data.get("loan_purpose") and data.get("product_name"):
            data["loan_purpose"] = data["product_name"]
        return data

    def _employment(self, obj):
        if not hasattr(obj, "_resolved_employment"):
            obj._resolved_employment = resolve_current_employment(obj.customer)
        return obj._resolved_employment

    def get_monthly_income(self, obj):
        employment = self._employment(obj)
        if employment and employment.monthly_salary is not None:
            return employment.monthly_salary
        return None

    def get_employment_type(self, obj):
        employment = self._employment(obj)
        return employment.employment_type if employment else ""

    def get_employment_type_display(self, obj):
        employment = self._employment(obj)
        return employment.get_employment_type_display() if employment else ""

    def _location(self, obj):
        if not hasattr(obj, "_resolved_location"):
            obj._resolved_location = resolve_location(obj)
        return obj._resolved_location

    def get_city(self, obj):
        return self._location(obj)[0] or ""

    def get_state(self, obj):
        return self._location(obj)[1] or ""

    def get_pincode(self, obj):
        return self._location(obj)[2] or ""

    def _linked_application(self, obj):
        """Resolve once per lead row — status and status_display both read this."""
        if not hasattr(obj, "_cached_linked_application"):
            obj._cached_linked_application = LeadConversionService.resolve_pipeline_application(obj)
        return obj._cached_linked_application

    def get_application_status(self, obj):
        application = self._linked_application(obj)
        return application.status if application else None

    def get_application_status_display(self, obj):
        application = self._linked_application(obj)
        return application.get_status_display() if application else None

    def _resolve_latest_call_disposition(self, obj) -> str | None:
        annotated = getattr(obj, "latest_call_disposition", None)
        if annotated:
            return annotated
        prefetched = getattr(obj, "_prefetched_objects_cache", {}).get("call_logs")
        if prefetched is not None:
            first = prefetched[0] if prefetched else None
            return first.disposition if first else None
        latest = obj.call_logs.order_by("-created_at").values_list("disposition", flat=True).first()
        return latest

    def get_latest_call_disposition(self, obj):
        return self._resolve_latest_call_disposition(obj)

    def get_latest_call_disposition_display(self, obj):
        disposition = self._resolve_latest_call_disposition(obj)
        if not disposition:
            return None
        try:
            return CallDisposition(disposition).label
        except ValueError:
            return disposition.replace("_", " ").title()


class CustomerPreviousLeadSerializer(LeadListSerializer):
    """Customer profile previous-leads table — includes loan summary columns."""

    loan_amount = serializers.SerializerMethodField()
    processing_fee = serializers.SerializerMethodField()
    roi = serializers.SerializerMethodField()
    sanction_date = serializers.SerializerMethodField()
    last_payment_date = serializers.SerializerMethodField()

    class Meta(LeadListSerializer.Meta):
        fields = LeadListSerializer.Meta.fields + [
            "loan_amount",
            "processing_fee",
            "roi",
            "sanction_date",
            "last_payment_date",
        ]

    def _summary_application(self, obj):
        if not hasattr(obj, "_cached_summary_application"):
            obj._cached_summary_application = obj.converted_application or self._linked_application(
                obj
            )
        return obj._cached_summary_application

    def get_loan_amount(self, obj):
        application = self._summary_application(obj)
        if application is not None:
            if application.approved_amount is not None:
                return _decimal_string(application.approved_amount)
            if application.requested_amount is not None:
                return _decimal_string(application.requested_amount)
        if obj.required_amount is not None:
            return _decimal_string(obj.required_amount)
        return None

    def get_processing_fee(self, obj):
        application = self._summary_application(obj)
        loan = _active_loan_for_application(application)
        if loan is not None:
            return _decimal_string(loan.processing_fee)
        decision = _latest_approved_decision(application)
        if decision and decision.processing_fee is not None:
            return _decimal_string(decision.processing_fee)
        return None

    def get_roi(self, obj):
        application = self._summary_application(obj)
        loan = _active_loan_for_application(application)
        if loan is not None:
            return _decimal_string(loan.interest_rate)
        decision = _latest_approved_decision(application)
        if decision and decision.interest_rate is not None:
            return _decimal_string(decision.interest_rate)
        return None

    def get_sanction_date(self, obj):
        application = self._summary_application(obj)
        if application is None:
            return None
        decision = _latest_approved_decision(application)
        sanction_date = LoanCalculationService.resolve_sanction_date(
            application=application,
            decision=decision,
        )
        return sanction_date.isoformat() if sanction_date else None

    def get_last_payment_date(self, obj):
        application = self._summary_application(obj)
        loan = _active_loan_for_application(application)
        payment_date = _latest_repayment_payment_date(loan)
        if payment_date is None:
            return None
        normalized = LoanCalculationService.to_date(payment_date)
        return normalized.isoformat() if normalized else None


class LeadDetailSerializer(LeadListSerializer):
    class Meta(LeadListSerializer.Meta):
        pass


class LeadEmploymentInputSerializer(serializers.Serializer):
    employer_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    designation = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    employment_type = serializers.ChoiceField(
        choices=EmploymentType.choices,
        required=False,
        allow_null=True,
    )
    monthly_salary = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
    )


class LeadAddressInputSerializer(serializers.Serializer):
    address_type = serializers.ChoiceField(
        choices=AddressType.choices,
        required=False,
        default=AddressType.OWN,
    )
    line1 = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    line2 = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    state = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    pincode = PincodeField(required=False, allow_blank=True, default="")
    country = serializers.CharField(max_length=100, required=False, default="India")


def validate_lead_employment_financials(*, employment, required_amount) -> None:
    """Shared income, loan, and employment-type rules for lead creation."""
    employment = employment or {}
    if not employment.get("employment_type"):
        raise serializers.ValidationError(
            {"employment": {"employment_type": "Employment type is required."}}
        )

    monthly_salary = employment.get("monthly_salary")
    if monthly_salary is None:
        raise serializers.ValidationError(
            {"employment": {"monthly_salary": "Monthly income is required."}}
        )

    monthly_salary = Decimal(str(monthly_salary))
    if monthly_salary < MIN_LEAD_MONTHLY_INCOME:
        raise serializers.ValidationError(
            {
                "employment": {
                    "monthly_salary": (
                        f"Monthly income must be at least {MIN_LEAD_MONTHLY_INCOME}."
                    )
                }
            }
        )

    required_amount = Decimal(str(required_amount))
    if required_amount >= monthly_salary:
        raise serializers.ValidationError(
            {"required_amount": ("Required loan amount must be less than monthly income.")}
        )


class LeadCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    email = BusinessEmailField()
    mobile_number = IndianMobileField()
    dob = serializers.DateField()
    gender = serializers.CharField(max_length=30)
    pan_no = PanField(required=False, allow_blank=True, default="")
    aadhaar_no = AadhaarField(required=False, allow_blank=True, default="")
    required_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    source = serializers.PrimaryKeyRelatedField(
        queryset=LeadSource.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    interested_product = serializers.UUIDField(required=False, allow_null=True)
    loan_purpose = serializers.ChoiceField(
        choices=LOAN_PURPOSE_OPTIONS,
        required=False,
        allow_blank=True,
        default="",
    )
    employment = LeadEmploymentInputSerializer(required=False, allow_null=True)
    address = LeadAddressInputSerializer(required=False, allow_null=True)

    def validate_dob(self, value):
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 21:
            raise serializers.ValidationError("Customer must be at least 21 years old.")
        return value

    def validate_loan_purpose(self, value):
        value = (value or "").strip()
        if value and value not in LOAN_PURPOSE_SET:
            raise serializers.ValidationError("Invalid loan purpose.")
        return value

    def validate(self, attrs):
        pan = (attrs.get("pan_no") or "").strip()
        aadhaar = (attrs.get("aadhaar_no") or "").strip()
        if not pan and not aadhaar:
            raise serializers.ValidationError(
                {"pan_no": "Either PAN or Aadhaar number is required."}
            )

        validate_lead_employment_financials(
            employment=attrs.get("employment"),
            required_amount=attrs.get("required_amount"),
        )
        return attrs


class PublicLeadCreateSerializer(serializers.Serializer):
    """Unauthenticated intake from website, social media, and ad campaigns."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    email = BusinessEmailField()
    mobile_number = IndianMobileField()
    dob = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    pan_no = PanField(required=False, allow_blank=True, default="")
    aadhaar_no = AadhaarField(required=False, allow_blank=True, default="")
    required_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    source_slug = serializers.ChoiceField(
        choices=[
            ("website", "Website"),
            ("social-media", "Social Media"),
            ("ads", "Ads"),
        ],
        required=False,
        default="website",
    )
    loan_purpose = serializers.ChoiceField(
        choices=LOAN_PURPOSE_OPTIONS,
        required=False,
        allow_blank=True,
        default="",
    )
    employment = LeadEmploymentInputSerializer(required=False, allow_null=True)
    address = LeadAddressInputSerializer(required=False, allow_null=True)

    def validate_dob(self, value):
        if value is None:
            return value
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 21:
            raise serializers.ValidationError("Customer must be at least 21 years old.")
        return value

    def validate_loan_purpose(self, value):
        value = (value or "").strip()
        if value and value not in LOAN_PURPOSE_SET:
            raise serializers.ValidationError("Invalid loan purpose.")
        return value

    def validate(self, attrs):
        validate_lead_employment_financials(
            employment=attrs.get("employment"),
            required_amount=attrs.get("required_amount"),
        )
        return attrs


class LeadUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            "required_amount",
            "source",
            "status",
            "interested_product",
            "loan_purpose",
            "rejection_reason",
        ]
        extra_kwargs = {field: {"required": False} for field in fields}

    def validate_loan_purpose(self, value):
        value = (value or "").strip()
        if value and value not in LOAN_PURPOSE_SET:
            raise serializers.ValidationError("Invalid loan purpose.")
        return value


class LeadTransferSerializer(serializers.Serializer):
    new_rm = serializers.UUIDField()
    remarks = serializers.CharField(required=False, allow_blank=True, default="")


class LeadConvertSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    requested_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    tenure_value = serializers.IntegerField(required=False, allow_null=True, min_value=1)


class CallLogSerializer(serializers.ModelSerializer):
    disposition_display = serializers.CharField(source="get_disposition_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CallLog
        fields = [
            "id",
            "lead",
            "disposition",
            "disposition_display",
            "remarks",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "lead", "created_by", "created_at"]

    def get_created_by_name(self, obj):
        return _user_label(obj.created_by)


class LeadFollowUpRemarkSerializer(serializers.ModelSerializer):
    recorded_on = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = LeadFollowUpRemark
        fields = [
            "id",
            "remark_category",
            "follow_up_date",
            "priority",
            "notes",
            "recorded_on",
        ]
        read_only_fields = ["id", "recorded_on"]


class CustomerLookupSerializer(serializers.Serializer):
    exists = serializers.BooleanField()
    customer = serializers.DictField(required=False)
    active_lead = serializers.DictField(required=False, allow_null=True)


class PublicLeadTrackSerializer(serializers.Serializer):
    """Track applications on the marketing site by PAN and/or mobile number."""

    pan_no = PanField(required=False, allow_blank=True, default="")
    mobile_number = IndianMobileField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        pan = (attrs.get("pan_no") or "").strip()
        mobile = (attrs.get("mobile_number") or "").strip()
        if not pan and not mobile:
            raise serializers.ValidationError(
                {"mobile_number": "Enter a PAN number or mobile number to track applications."}
            )
        attrs["pan_no"] = pan or None
        attrs["mobile_number"] = mobile or None
        return attrs
