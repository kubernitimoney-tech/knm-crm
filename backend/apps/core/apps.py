from django.apps import AppConfig

ADMIN_LIST_PER_PAGE = 50


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    label = "core"
    verbose_name = "Core"

    def ready(self):
        from django.contrib import admin

        # Paginate every admin changelist at 50 rows. "Show all" is capped at the same
        # size so it can never bypass pagination on large tables.
        admin.ModelAdmin.list_per_page = ADMIN_LIST_PER_PAGE
        admin.ModelAdmin.list_max_show_all = ADMIN_LIST_PER_PAGE
