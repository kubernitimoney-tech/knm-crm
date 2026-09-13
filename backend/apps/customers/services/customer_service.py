from django.db import transaction

from apps.activities.services.activity_service import ActivityService
from apps.core.encryption import blind_hash
from apps.core.validators.email import validate_business_email
from apps.core.validators.india import normalize_aadhaar, normalize_pan, validate_mobile
from apps.customers.models import (
    AddressType,
    Customer,
    CustomerAddress,
    CustomerEmployment,
    CustomerIdentity,
    EmploymentType,
    IdentityType,
)


class CustomerService:
    @staticmethod
    def generate_customer_code() -> str:
        last = Customer.all_objects.order_by("-created_at").first()
        seq = 1
        if last and last.customer_code:
            digits = "".join(ch for ch in last.customer_code if ch.isdigit())
            if digits:
                seq = int(digits) + 1
        return f"{seq:05d}"

    @classmethod
    def _upsert_identity(cls, customer: Customer, identity_type: str, number: str, user) -> None:
        if not number:
            return
        identity, created = CustomerIdentity.objects.get_or_create(
            customer=customer,
            identity_type=identity_type,
            defaults={
                "identity_number": number,
                "is_primary": True,
                "created_by": user,
                "updated_by": user,
            },
        )
        if not created and identity.identity_number != number:
            identity.identity_number = number
            identity.updated_by = user
            identity.save()

    @classmethod
    def _create_employment(cls, customer: Customer, user, data: dict | None) -> None:
        if not data:
            return
        employment_type = (data.get("employment_type") or "").strip()
        if not employment_type:
            return
        CustomerEmployment.objects.create(
            customer=customer,
            employer_name=(data.get("employer_name") or "").strip() or "Not specified",
            designation=(data.get("designation") or "").strip(),
            employment_type=employment_type,
            monthly_salary=data.get("monthly_salary"),
            experience_months=data.get("experience_months") or 0,
            is_current=True,
            is_verified=False,
            created_by=user,
            updated_by=user,
        )

    @classmethod
    def _create_address(cls, customer: Customer, user, data: dict | None) -> None:
        if not data:
            return
        city = (data.get("city") or "").strip()
        state = (data.get("state") or "").strip()
        pincode = (data.get("pincode") or "").strip()
        line1 = (data.get("line1") or "").strip()
        if not line1:
            line1 = city or state or pincode or ""
        if not line1 and not city and not state and not pincode:
            return
        if not line1:
            line1 = "Address on file"
        CustomerAddress.objects.create(
            customer=customer,
            address_type=data.get("address_type") or AddressType.OWN,
            line1=line1,
            line2=(data.get("line2") or "").strip(),
            city=city,
            state=state,
            pincode=pincode,
            country=data.get("country") or "India",
            is_verified=False,
            created_by=user,
            updated_by=user,
        )

    @classmethod
    @transaction.atomic
    def create_customer(
        cls, *, user, data: dict, employment: dict | None = None, address: dict | None = None
    ) -> Customer:
        pan = data.pop("pan_no", None) or data.pop("pan", None)
        aadhaar = data.pop("aadhaar_no", None) or data.pop("aadhaar", None)
        if data.get("mobile_number"):
            data["mobile_number"] = validate_mobile(data["mobile_number"])
        if data.get("email"):
            data["email"] = validate_business_email(data["email"])
        if not data.get("customer_code"):
            data["customer_code"] = cls.generate_customer_code()
        customer = Customer.objects.create(
            created_by=user,
            updated_by=user,
            **data,
        )
        cls._upsert_identity(customer, IdentityType.PAN, pan or "", user)
        cls._upsert_identity(customer, IdentityType.AADHAAR, aadhaar or "", user)
        cls._create_employment(customer, user, employment)
        cls._create_address(customer, user, address)
        ActivityService.log(
            actor=user,
            verb="created",
            description="Customer Created",
            target=customer,
        )
        return customer

    @classmethod
    def _upsert_current_employment(
        cls,
        customer: Customer,
        user,
        *,
        employment_type: str | None = None,
        monthly_income=None,
    ) -> None:
        employment = customer.employments.filter(is_current=True).order_by("-created_at").first()
        if employment is None:
            normalized_type = (employment_type or "").strip()
            if not normalized_type and monthly_income is None:
                return
            cls._create_employment(
                customer,
                user,
                {
                    "employment_type": normalized_type or EmploymentType.SALARIED,
                    "monthly_salary": monthly_income,
                },
            )
            return

        changed = False
        if employment_type is not None:
            normalized_type = employment_type.strip()
            if normalized_type:
                employment.employment_type = normalized_type
                changed = True
        if monthly_income is not None:
            employment.monthly_salary = monthly_income
            changed = True
        if changed:
            employment.updated_by = user
            employment.save()

    @classmethod
    def _apply_lead_employment(cls, customer: Customer, user, employment: dict | None) -> None:
        if not employment:
            return

        employment_type = (employment.get("employment_type") or "").strip()
        monthly_salary = employment.get("monthly_salary")
        employer_name = (employment.get("employer_name") or "").strip()
        designation = (employment.get("designation") or "").strip()

        if not any((employment_type, monthly_salary is not None, employer_name, designation)):
            return

        current = customer.employments.filter(is_current=True).order_by("-created_at").first()
        if current is None:
            cls._create_employment(
                customer,
                user,
                {
                    **employment,
                    "employment_type": employment_type or EmploymentType.SALARIED,
                },
            )
            return

        switched_job = bool(
            employer_name
            and employer_name != current.employer_name
            and current.employer_name != "Not specified"
        ) or bool(employment_type and employment_type != current.employment_type)

        if switched_job:
            current.is_current = False
            current.updated_by = user
            current.save(update_fields=["is_current", "updated_by", "updated_at"])
            cls._create_employment(
                customer,
                user,
                {
                    **employment,
                    "employment_type": employment_type or current.employment_type,
                    "employer_name": employer_name or current.employer_name,
                },
            )
            return

        changed = False
        if employment_type:
            current.employment_type = employment_type
            changed = True
        if monthly_salary is not None:
            current.monthly_salary = monthly_salary
            changed = True
        if employer_name:
            current.employer_name = employer_name
            changed = True
        if designation or employment.get("designation") is not None:
            current.designation = designation
            changed = True
        if changed:
            current.updated_by = user
            current.save()

    @classmethod
    def _upsert_primary_address(
        cls,
        customer: Customer,
        user,
        *,
        city: str | None = None,
        state: str | None = None,
        pincode: str | None = None,
    ) -> None:
        if city is None and state is None and pincode is None:
            return

        address = (
            customer.addresses.filter(address_type=AddressType.OWN).order_by("-created_at").first()
            or customer.addresses.filter(address_type=AddressType.RENTED)
            .order_by("-created_at")
            .first()
            or customer.addresses.order_by("-created_at").first()
        )
        if address is None:
            line1 = (city or state or pincode or "").strip() or "Address on file"
            cls._create_address(
                customer,
                user,
                {
                    "address_type": AddressType.OWN,
                    "line1": line1,
                    "city": (city or "").strip(),
                    "state": (state or "").strip(),
                    "pincode": (pincode or "").strip(),
                },
            )
            return

        changed = False
        if city is not None:
            address.city = city.strip()
            changed = True
        if state is not None:
            address.state = state.strip()
            changed = True
        if pincode is not None:
            address.pincode = pincode.strip()
            changed = True
        if changed:
            address.updated_by = user
            address.save()

    @classmethod
    @transaction.atomic
    def update_customer_profile(cls, *, user, customer: Customer, data: dict) -> Customer:
        pan = data.pop("pan_no", None)
        aadhaar = data.pop("aadhaar_no", None)
        monthly_income = data.pop("monthly_income", None)
        employment_type = data.pop("employment_type", None)
        city = data.pop("city", None)
        state = data.pop("state", None)
        pincode = data.pop("pincode", None)

        for key, value in data.items():
            setattr(customer, key, value)
        customer.updated_by = user
        customer.save()

        if pan is not None:
            cls._upsert_identity(customer, IdentityType.PAN, pan, user)
        if aadhaar is not None:
            cls._upsert_identity(customer, IdentityType.AADHAAR, aadhaar, user)

        cls._upsert_current_employment(
            customer,
            user,
            employment_type=employment_type,
            monthly_income=monthly_income,
        )
        cls._upsert_primary_address(
            customer,
            user,
            city=city,
            state=state,
            pincode=pincode,
        )

        ActivityService.log(
            actor=user,
            verb="updated",
            description="Customer Profile Updated",
            target=customer,
        )
        return customer

    @classmethod
    @transaction.atomic
    def update_customer(cls, *, user, customer: Customer, data: dict) -> Customer:
        pan = data.pop("pan_no", None)
        aadhaar = data.pop("aadhaar_no", None)
        for key, value in data.items():
            setattr(customer, key, value)
        customer.updated_by = user
        customer.save()
        if pan is not None:
            cls._upsert_identity(customer, IdentityType.PAN, pan, user)
        if aadhaar is not None:
            cls._upsert_identity(customer, IdentityType.AADHAAR, aadhaar, user)
        return customer

    @classmethod
    def find_by_pan(cls, pan: str) -> Customer | None:
        pan = normalize_pan(pan)
        pan_hash = blind_hash(pan)
        if not pan_hash:
            return None
        identity = (
            CustomerIdentity.objects.filter(
                identity_type=IdentityType.PAN,
                identity_hash=pan_hash,
                customer__is_deleted=False,
            )
            .select_related("customer")
            .first()
        )
        return identity.customer if identity else None

    @classmethod
    def find_by_aadhaar(cls, aadhaar: str) -> Customer | None:
        aadhaar = normalize_aadhaar(aadhaar)
        aadhaar_hash = blind_hash(aadhaar)
        if not aadhaar_hash:
            return None
        identity = (
            CustomerIdentity.objects.filter(
                identity_type=IdentityType.AADHAAR,
                identity_hash=aadhaar_hash,
                customer__is_deleted=False,
            )
            .select_related("customer")
            .first()
        )
        return identity.customer if identity else None

    @classmethod
    def find_by_email(cls, email: str) -> Customer | None:
        normalized = (email or "").strip()
        if not normalized:
            return None
        return Customer.objects.filter(email__iexact=normalized, is_deleted=False).first()

    @classmethod
    def find_by_mobile(cls, mobile: str) -> Customer | None:
        try:
            normalized = validate_mobile(mobile, allow_blank=True)
        except ValueError:
            return None
        if not normalized:
            return None
        return Customer.objects.filter(mobile_number=normalized, is_deleted=False).first()

    @classmethod
    def find_by_identifiers(
        cls,
        *,
        pan: str | None = None,
        aadhaar: str | None = None,
        email: str | None = None,
        mobile: str | None = None,
    ) -> Customer | None:
        for finder, value in (
            (cls.find_by_pan, pan),
            (cls.find_by_aadhaar, aadhaar),
            (cls.find_by_email, email),
            (cls.find_by_mobile, mobile),
        ):
            if not value:
                continue
            customer = finder(value)
            if customer is not None:
                return customer
        return None

    @classmethod
    @transaction.atomic
    def resolve_for_lead(
        cls,
        *,
        user,
        pan: str | None,
        aadhaar: str | None,
        email: str | None,
        mobile: str | None,
        customer_data: dict,
        employment: dict | None = None,
        address: dict | None = None,
    ) -> tuple[Customer, bool]:
        existing = cls.find_by_identifiers(
            pan=pan,
            aadhaar=aadhaar,
            email=email,
            mobile=mobile,
        )
        if existing is not None:
            cls._apply_lead_employment(existing, user, employment)
            return existing, False

        payload = {**customer_data}
        if pan:
            payload["pan_no"] = pan
        if aadhaar:
            payload["aadhaar_no"] = aadhaar
        customer = cls.create_customer(
            user=user,
            data=payload,
            employment=employment,
            address=address,
        )
        return customer, True

    @classmethod
    @transaction.atomic
    def get_or_create_by_pan(cls, *, user, pan: str, data: dict) -> tuple[Customer, bool]:
        existing = cls.find_by_pan(pan)
        if existing is not None:
            return existing, False
        payload = {**data, "pan_no": pan}
        customer = cls.create_customer(user=user, data=payload)
        return customer, True

    @staticmethod
    def _iter_identities(customer: Customer):
        """Use prefetched identities on list APIs; fall back to a queryset otherwise."""
        prefetched = getattr(customer, "_prefetched_objects_cache", {}).get("identities")
        if prefetched is not None:
            return prefetched
        return customer.identities.all()

    @staticmethod
    def get_primary_pan(customer: Customer) -> str:
        for identity in CustomerService._iter_identities(customer):
            if identity.identity_type == IdentityType.PAN and identity.is_primary:
                return identity.identity_number
        return ""

    @staticmethod
    def get_primary_aadhaar(customer: Customer) -> str:
        for identity in CustomerService._iter_identities(customer):
            if identity.identity_type == IdentityType.AADHAAR and identity.is_primary:
                return identity.identity_number
        return ""

    @staticmethod
    def customer_lookup_payload(customer: Customer) -> dict:
        return {
            "id": str(customer.id),
            "customer_code": customer.customer_code,
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "email": customer.email,
            "mobile_number": customer.mobile_number,
            "pan_no": CustomerService.get_primary_pan(customer),
            "aadhaar_no": CustomerService.get_primary_aadhaar(customer),
            "dob": customer.dob,
            "gender": customer.gender,
        }
