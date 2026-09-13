from django.urls import path

from apps.core.views import (
    BankListAPIView,
    BranchListAPIView,
    IfscLookupAPIView,
    PincodeLookupAPIView,
)

urlpatterns = [
    path("branches/", BranchListAPIView.as_view(), name="branch-list"),
    path("banks/", BankListAPIView.as_view(), name="bank-list"),
    path("pincode/<str:pincode>/", PincodeLookupAPIView.as_view(), name="pincode-lookup"),
    path("ifsc/<str:ifsc_code>/", IfscLookupAPIView.as_view(), name="ifsc-lookup"),
]
