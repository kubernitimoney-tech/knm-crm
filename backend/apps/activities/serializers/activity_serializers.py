from rest_framework import serializers

from apps.activities.models import Activity


class ActivitySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = Activity
        fields = [
            "id",
            "actor",
            "actor_email",
            "verb",
            "description",
            "content_type",
            "object_id",
            "metadata",
            "created_at",
        ]
