from django.contrib.contenttypes.models import ContentType

from apps.activities.models import Activity


class ActivityService:
    @staticmethod
    def log(*, actor, verb: str, description: str, target, metadata: dict | None = None):
        ct = ContentType.objects.get_for_model(target)
        return Activity.objects.create(
            actor=actor,
            verb=verb,
            description=description,
            content_type=ct,
            object_id=target.pk,
            metadata=metadata or {},
        )

    @staticmethod
    def get_timeline_for(target):
        ct = ContentType.objects.get_for_model(target)
        return (
            Activity.objects.filter(content_type=ct, object_id=target.pk)
            .select_related("actor")
            .only(
                "id",
                "verb",
                "description",
                "metadata",
                "created_at",
                "actor__id",
                "actor__email",
                "actor__first_name",
                "actor__last_name",
            )
        )
