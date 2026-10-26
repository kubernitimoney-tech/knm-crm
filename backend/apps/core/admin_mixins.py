from django.contrib.admin.views.main import ORDER_VAR, ChangeList
from django.db.models import Case, IntegerField, Value, When

LEAD_SEARCH_RANK = "lead_search_rank"


class LeadFirstChangeList(ChangeList):
    """Puts lead-ID search matches ahead of the regular ordering."""

    def get_queryset(self, request, exclude_parameters=None):
        queryset = super().get_queryset(request, exclude_parameters)
        if LEAD_SEARCH_RANK in queryset.query.annotations and ORDER_VAR not in self.params:
            queryset = queryset.order_by(LEAD_SEARCH_RANK, *queryset.query.order_by)
        return queryset


class LeadFirstSearchMixin:
    """Admin search that lists lead-ID matches first, then matches on the other fields.

    ``search_fields[0]`` must be the lead ID lookup. Results are ranked, not
    filtered: lead IDs share the numeric format of other identifiers (e.g.
    application numbers), so hiding non-lead matches would hide real hits.
    Clicking a column header sorts by that column instead.
    """

    def get_changelist(self, request, **kwargs):
        return LeadFirstChangeList

    def get_search_results(self, request, queryset, search_term):
        queryset, may_have_duplicates = super().get_search_results(request, queryset, search_term)
        term = search_term.strip()
        if term:
            queryset = queryset.annotate(
                **{
                    LEAD_SEARCH_RANK: Case(
                        When(**{f"{self.search_fields[0]}__icontains": term}, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    )
                }
            )
        return queryset, may_have_duplicates
