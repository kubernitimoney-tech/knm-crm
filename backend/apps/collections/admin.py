from django.contrib import admin

from apps.collections.models import (
    CollectionActivity,
    CollectionCase,
    PromiseToPay,
    SettlementOffer,
)

admin.site.register(CollectionCase)
admin.site.register(CollectionActivity)
admin.site.register(PromiseToPay)
admin.site.register(SettlementOffer)
