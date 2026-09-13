from rest_framework import serializers

from apps.organization.models import Bank


class BankSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bank
        fields = ["id", "name", "is_active"]
