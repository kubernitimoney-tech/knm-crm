from rest_framework import serializers

from apps.organization.models import BankHoliday
from apps.organization.utils.financial_year import (
    BANK_HOLIDAY_FINANCIAL_YEAR_MAX,
    BANK_HOLIDAY_FINANCIAL_YEAR_MIN,
    date_within_financial_year,
    financial_year_label,
    financial_year_start_from_date,
    is_allowed_bank_holiday_financial_year,
)


class BankHolidaySerializer(serializers.ModelSerializer):
    financial_year_display = serializers.SerializerMethodField()

    class Meta:
        model = BankHoliday
        fields = [
            "id",
            "holiday_date",
            "holiday_name",
            "financial_year_start",
            "financial_year_display",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "financial_year_display", "created_at", "updated_at"]

    def get_financial_year_display(self, obj) -> str:
        return financial_year_label(obj.financial_year_start)

    def validate_holiday_name(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Holiday name is required.")
        return cleaned

    def validate_financial_year_start(self, value):
        if value is not None and not is_allowed_bank_holiday_financial_year(value):
            raise serializers.ValidationError(
                f"Financial year must be between "
                f"{financial_year_label(BANK_HOLIDAY_FINANCIAL_YEAR_MIN)} and "
                f"{financial_year_label(BANK_HOLIDAY_FINANCIAL_YEAR_MAX)}."
            )
        return value

    def validate(self, attrs):
        holiday_date = attrs.get("holiday_date") or getattr(self.instance, "holiday_date", None)
        financial_year_start = attrs.get("financial_year_start") or getattr(
            self.instance, "financial_year_start", None
        )

        if holiday_date and financial_year_start is None:
            financial_year_start = financial_year_start_from_date(holiday_date)
            attrs["financial_year_start"] = financial_year_start

        if financial_year_start is not None and not is_allowed_bank_holiday_financial_year(
            financial_year_start
        ):
            raise serializers.ValidationError(
                {
                    "financial_year_start": (
                        f"Financial year must be between "
                        f"{financial_year_label(BANK_HOLIDAY_FINANCIAL_YEAR_MIN)} and "
                        f"{financial_year_label(BANK_HOLIDAY_FINANCIAL_YEAR_MAX)}."
                    )
                }
            )

        if holiday_date and financial_year_start:
            if not date_within_financial_year(holiday_date, financial_year_start):
                raise serializers.ValidationError(
                    {
                        "holiday_date": (
                            f"Date must fall within financial year "
                            f"{financial_year_label(financial_year_start)}."
                        )
                    }
                )

            qs = BankHoliday.objects.filter(
                financial_year_start=financial_year_start,
                holiday_date=holiday_date,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A holiday already exists for this date in the selected financial year."
                )

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        return BankHoliday.objects.create(
            created_by=user,
            updated_by=user,
            **validated_data,
        )

    def update(self, instance, validated_data):
        user = self.context["request"].user
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.updated_by = user
        instance.save()
        return instance
