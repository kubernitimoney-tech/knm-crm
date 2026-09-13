from rest_framework import serializers

from apps.organization.models import Branch


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = [
            "id",
            "branch_code",
            "branch_name",
            "bank_name",
            "address_line1",
            "address_line2",
            "city",
            "state",
            "country",
            "mobile_no",
            "phone_no",
            "email",
            "opening_date",
            "status",
        ]
        read_only_fields = fields
