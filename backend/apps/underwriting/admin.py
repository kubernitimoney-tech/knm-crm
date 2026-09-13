from django.contrib import admin

from apps.underwriting.models import (
    BankStatementAnalysis,
    CreditBureauReport,
    FraudCheck,
    RiskAssessment,
)

admin.site.register(CreditBureauReport)
admin.site.register(RiskAssessment)
admin.site.register(FraudCheck)
admin.site.register(BankStatementAnalysis)
