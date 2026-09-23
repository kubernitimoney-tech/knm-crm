"""Processing fee and GST calculations for loan sanction."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

GST_RATE_PERCENT = Decimal("18")


class SanctionFeeService:
    @staticmethod
    def _to_decimal(value) -> Decimal:
        if value is None or value == "":
            return Decimal("0")
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal("0")

    @staticmethod
    def _gst_from_details(details: dict | None):
        if not details:
            return None
        value = details.get("gst")
        if value in (None, ""):
            value = details.get("admin_gst")
        return value

    @classmethod
    def compute(
        cls,
        *,
        principal_amount,
        pf_percentage,
        gst_percentage=None,
    ) -> dict[str, str]:
        """
        processing_fee = principal * pf_percentage / 100
        gst = processing_fee * gst_percentage / 100
        """
        principal = cls._to_decimal(principal_amount)
        pf_pct = cls._to_decimal(pf_percentage)
        gst_rate = cls._to_decimal(
            gst_percentage if gst_percentage is not None else GST_RATE_PERCENT
        )
        processing_fee = (principal * pf_pct / Decimal("100")).quantize(Decimal("0.01"))
        gst = (processing_fee * gst_rate / Decimal("100")).quantize(Decimal("0.01"))
        total_deduction = (processing_fee + gst).quantize(Decimal("0.01"))
        return {
            "processing_fee": str(processing_fee),
            "gst": str(gst),
            "pf_percentage": str(pf_pct),
            "gst_rate_percent": str(gst_rate),
            "total_deduction": str(total_deduction),
        }

    @classmethod
    def apply_to_sanction(
        cls,
        *,
        approved_amount,
        sanction_details: dict | None,
        processing_fee=None,
    ) -> tuple[Decimal, dict]:
        details = dict(sanction_details or {})
        pf_percentage = details.get("pf_percentage")
        gst_percentage = details.get("gst_rate_percent")
        if pf_percentage is None and processing_fee is not None:
            # Legacy clients may send processing_fee only; keep as-is.
            fee = cls._to_decimal(processing_fee)
            gst_rate = cls._to_decimal(
                gst_percentage if gst_percentage is not None else GST_RATE_PERCENT
            )
            details.setdefault(
                "gst",
                str((fee * gst_rate / Decimal("100")).quantize(Decimal("0.01"))),
            )
            details.pop("admin_gst", None)
            details.setdefault("gst_rate_percent", str(gst_rate))
            return fee, details

        fees = cls.compute(
            principal_amount=approved_amount,
            pf_percentage=pf_percentage,
            gst_percentage=gst_percentage,
        )
        details["pf_percentage"] = fees["pf_percentage"]
        details["gst"] = fees["gst"]
        details.pop("admin_gst", None)
        details["gst_rate_percent"] = fees["gst_rate_percent"]
        details["total_deduction"] = fees["total_deduction"]
        return cls._to_decimal(fees["processing_fee"]), details

    @classmethod
    def compute_net_disbursal(
        cls,
        *,
        principal_amount,
        processing_fee=None,
        gst=None,
        pf_percentage=None,
    ) -> dict[str, str]:
        """Net disbursal = principal - processing fee - GST."""
        principal = cls._to_decimal(principal_amount)
        if processing_fee is None or gst is None:
            fees = cls.compute(
                principal_amount=principal,
                pf_percentage=pf_percentage if pf_percentage is not None else "0",
                gst_percentage=None,
            )
            processing_fee = cls._to_decimal(
                processing_fee if processing_fee is not None else fees["processing_fee"]
            )
            gst = cls._to_decimal(gst if gst is not None else fees["gst"])
        else:
            processing_fee = cls._to_decimal(processing_fee)
            gst = cls._to_decimal(gst)

        total_deduction = (processing_fee + gst).quantize(Decimal("0.01"))
        net_amount = (principal - total_deduction).quantize(Decimal("0.01"))
        if net_amount < 0:
            net_amount = Decimal("0.00")

        return {
            "principal_amount": f"{principal:.2f}",
            "processing_fee": f"{processing_fee:.2f}",
            "gst": f"{gst:.2f}",
            "total_deduction": f"{total_deduction:.2f}",
            "amount_to_be_disbursed": f"{net_amount:.2f}",
        }

    @classmethod
    def net_disbursal_for_application(cls, application) -> dict[str, str]:
        decision = application.decisions.filter(decision="approved").order_by("-decided_at").first()
        principal = application.approved_amount or application.requested_amount
        processing_fee = None
        gst = None
        pf_percentage = None

        if decision:
            principal = decision.approved_amount or principal
            processing_fee = decision.processing_fee
            details = decision.sanction_details or {}
            gst = cls._gst_from_details(details)
            pf_percentage = details.get("pf_percentage")

        return cls.compute_net_disbursal(
            principal_amount=principal,
            processing_fee=processing_fee,
            gst=gst,
            pf_percentage=pf_percentage,
        )
