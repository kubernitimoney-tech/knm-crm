import pytest
from django.urls import reverse
from tests.factories import UserFactory

from apps.accounts.services.auth_context import build_auth_context


@pytest.mark.django_db
class TestDisplayName:
    def test_display_name_falls_back_to_full_name(self):
        user = UserFactory(first_name="ravi", last_name="kumar", display_name="")
        assert user.get_display_name() == "Ravi Kumar"

        user.display_name = "  RK  "
        assert user.get_display_name() == "RK"

    def test_auth_context_exposes_display_name_separately(self):
        user = UserFactory(first_name="ravi", last_name="kumar", display_name="RK")
        context_user = build_auth_context(user)["user"]
        assert context_user["display_name"] == "RK"
        assert context_user["full_name"] == "Ravi Kumar"

    def test_user_can_update_only_own_display_name(self, api_client):
        user = UserFactory(first_name="ravi", last_name="kumar")
        api_client.force_authenticate(user=user)

        response = api_client.patch(
            reverse("auth-me"),
            {"display_name": "  RK  ", "first_name": "Hacked", "email": "x@example.com"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["data"]["user"]["display_name"] == "RK"
        user.refresh_from_db()
        assert user.display_name == "RK"
        assert user.first_name == "ravi"
        assert user.email != "x@example.com"

    def test_loan_data_labels_ignore_display_name(self):
        from apps.applications.serializers.application_pipeline_serializers import (
            _user_label as pipeline_label,
        )
        from apps.leads.serializers.lead_serializers import _user_label as lead_label

        user = UserFactory(first_name="ravi", last_name="kumar", display_name="RK")
        assert pipeline_label(user) == "Ravi Kumar"
        assert lead_label(user) == "Ravi Kumar"
