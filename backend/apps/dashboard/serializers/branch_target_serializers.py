from rest_framework import serializers

from apps.dashboard.models import BranchSanctionTarget


class BranchSanctionTargetSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.branch_name", read_only=True)
    branch_city = serializers.CharField(source="branch.city", read_only=True)
    branch_bank = serializers.CharField(source="branch.bank_name", read_only=True)

    class Meta:
        model = BranchSanctionTarget
        fields = [
            "id",
            "branch",
            "branch_name",
            "branch_city",
            "branch_bank",
            "target_amount",
            "period_year",
            "period_month",
            "created_at",
        ]
        read_only_fields = ["id", "branch_name", "branch_city", "branch_bank", "created_at"]

    def validate_target_amount(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Target amount must be greater than zero.")
        return value

    def validate_period_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError("Period month must be between 1 and 12.")
        return value

    def validate(self, attrs):
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        period_year = attrs.get("period_year") or getattr(self.instance, "period_year", None)
        period_month = attrs.get("period_month") or getattr(self.instance, "period_month", None)

        if branch and period_year and period_month:
            qs = BranchSanctionTarget.objects.filter(
                branch=branch,
                period_year=period_year,
                period_month=period_month,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A target already exists for this branch and period."
                )
        return attrs
