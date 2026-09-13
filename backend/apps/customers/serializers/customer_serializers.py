from rest_framework import serializers

from apps.core.validators.drf_fields import (
    AadhaarField,
    BusinessEmailField,
    IndianMobileField,
    PanField,
    PincodeField,
)
from apps.customers.models import AddressType, Customer, EmploymentType
from apps.customers.services.customer_service import CustomerService
from apps.leads.serializers.lead_serializers import (
    CallLogSerializer,
    CustomerPreviousLeadSerializer,
)


class CustomerSerializer(serializers.ModelSerializer):
    customer_status = serializers.SerializerMethodField()
    pan_no = serializers.SerializerMethodField()
    aadhaar_no = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "customer_code",
            "first_name",
            "last_name",
            "email",
            "mobile_number",
            "gender",
            "dob",
            "status",
            "pan_no",
            "aadhaar_no",
            "customer_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "customer_code", "customer_status", "created_at", "updated_at"]

    def get_customer_status(self, obj):
        return "Inactive" if obj.is_deleted else obj.get_status_display()

    def get_pan_no(self, obj):
        return CustomerService.get_primary_pan(obj)

    def get_aadhaar_no(self, obj):
        from apps.customers.models import IdentityType

        identity = obj.identities.filter(
            identity_type=IdentityType.AADHAAR, is_primary=True
        ).first()
        return identity.identity_number if identity else ""


def _current_employment(customer: Customer):
    return customer.employments.filter(is_current=True).order_by("-created_at").first()


def _primary_address(customer: Customer):
    address = (
        customer.addresses.filter(address_type=AddressType.OWN).order_by("-created_at").first()
    )
    if not address:
        address = customer.addresses.order_by("-created_at").first()
    return address


class CustomerProfileDetailSerializer(CustomerSerializer):
    monthly_income = serializers.SerializerMethodField()
    employment_type = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()
    pincode = serializers.SerializerMethodField()

    class Meta(CustomerSerializer.Meta):
        fields = CustomerSerializer.Meta.fields + [
            "monthly_income",
            "employment_type",
            "city",
            "state",
            "pincode",
        ]

    def get_monthly_income(self, obj):
        employment = _current_employment(obj)
        return (
            employment.monthly_salary
            if employment and employment.monthly_salary is not None
            else None
        )

    def get_employment_type(self, obj):
        employment = _current_employment(obj)
        return employment.employment_type if employment else ""

    def get_city(self, obj):
        address = _primary_address(obj)
        return address.city if address else ""

    def get_state(self, obj):
        address = _primary_address(obj)
        return address.state if address else ""

    def get_pincode(self, obj):
        address = _primary_address(obj)
        return address.pincode if address else ""


class CustomerProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    email = BusinessEmailField(required=False)
    mobile_number = IndianMobileField(required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=Customer._meta.get_field("gender").choices, required=False, allow_blank=True
    )
    dob = serializers.DateField(required=False, allow_null=True)
    pan_no = PanField(required=False, allow_blank=True)
    aadhaar_no = AadhaarField(required=False, allow_blank=True)
    monthly_income = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    employment_type = serializers.ChoiceField(
        choices=EmploymentType.choices,
        required=False,
        allow_blank=True,
    )
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    pincode = PincodeField(required=False, allow_blank=True)


class CustomerCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    email = BusinessEmailField()
    mobile_number = IndianMobileField()
    gender = serializers.CharField(required=False, allow_blank=True, default="")
    dob = serializers.DateField(required=False, allow_null=True)
    pan_no = serializers.CharField(required=False, allow_blank=True, default="")
    aadhaar_no = serializers.CharField(required=False, allow_blank=True, default="")


class CustomerProfileSerializer(serializers.Serializer):
    customer = CustomerProfileDetailSerializer()
    leads = CustomerPreviousLeadSerializer(many=True)
    active_lead = CustomerPreviousLeadSerializer(allow_null=True)
    call_logs = CallLogSerializer(many=True)
    lead_stats = serializers.DictField()
