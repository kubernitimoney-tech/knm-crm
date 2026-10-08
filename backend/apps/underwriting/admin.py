from django.contrib import admin

from apps.underwriting.models import (
    BankStatementAnalysis,
    CreditBureauReport,
    FraudCheck,
    RiskAssessment,
)


@admin.register(CreditBureauReport)
class CreditBureauReportAdmin(admin.ModelAdmin):
    list_display = ("application", "bureau", "score", "report_date", "pulled_by")
    list_filter = ("bureau",)
    search_fields = ("application__application_number",)


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = ("application", "risk_grade", "dti_ratio", "assessed_by", "assessed_at")
    list_filter = ("risk_grade",)
    search_fields = ("application__application_number",)


@admin.register(FraudCheck)
class FraudCheckAdmin(admin.ModelAdmin):
    list_display = ("application", "check_type", "result", "checked_at")
    list_filter = ("result", "check_type")
    search_fields = ("application__application_number", "check_type")


@admin.register(BankStatementAnalysis)
class BankStatementAnalysisAdmin(admin.ModelAdmin):
    list_display = (
        "application",
        "avg_balance",
        "salary_credits_detected",
        "bounce_count",
        "analyzed_at",
    )
    list_filter = ("salary_credits_detected",)
    search_fields = ("application__application_number",)
