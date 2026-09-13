from rest_framework import serializers

from apps.audit_logs.models import UserActivityAction, UserActivityLog


class UserActivityLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = UserActivityLog
        fields = [
            "id",
            "user",
            "user_email",
            "action",
            "description",
            "ip_address",
            "user_agent",
            "metadata",
            "created_at",
        ]


class LogUserActivitySerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=UserActivityAction.choices)
    description = serializers.CharField(max_length=255)
    metadata = serializers.DictField(required=False, default=dict)
