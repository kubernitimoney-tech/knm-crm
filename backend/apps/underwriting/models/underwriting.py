from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel, UUIDPrimaryKeyModel


class BureauProvider(models.TextChoices):
    CIBIL = "cibil", "CIBIL"
    EXPERIAN = "experian", "Experian"
    CRIF = "crif", "CRIF"


class RiskGrade(models.TextChoices):
    A = "A", "A"
    B = "B", "B"
    C = "C", "C"
    D = "D", "D"
    E = "E", "E"


class FraudCheckResult(models.TextChoices):
    PASS = "pass", "Pass"
    FAIL = "fail", "Fail"
    REVIEW = "review", "Review"


class CreditBureauReport(UUIDPrimaryKeyModel, TimeStampedModel):
    application = models.ForeignKey(
        "applications.LoanApplication",
        on_delete=models.CASCADE,
        related_name="bureau_reports",
    )
    bureau = models.CharField(max_length=20, choices=BureauProvider.choices)
    score = models.IntegerField(null=True, blank=True)
    report_date = models.DateField(null=True, blank=True)
    raw_response_ref = models.CharField(max_length=255, blank=True)
    parsed_data = models.JSONField(default=dict, blank=True)
    pulled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    pulled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-pulled_at"]
        indexes = [models.Index(fields=["application", "bureau"])]


class RiskAssessment(UUIDPrimaryKeyModel, TimeStampedModel):
    application = models.ForeignKey(
        "applications.LoanApplication",
        on_delete=models.CASCADE,
        related_name="risk_assessments",
    )
    risk_grade = models.CharField(max_length=1, choices=RiskGrade.choices)
    dti_ratio = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    assessment_data = models.JSONField(default=dict, blank=True)
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    assessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-assessed_at"]


class FraudCheck(UUIDPrimaryKeyModel, TimeStampedModel):
    application = models.ForeignKey(
        "applications.LoanApplication",
        on_delete=models.CASCADE,
        related_name="fraud_checks",
    )
    check_type = models.CharField(max_length=50)
    result = models.CharField(max_length=20, choices=FraudCheckResult.choices)
    details = models.JSONField(default=dict, blank=True)
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-checked_at"]


class BankStatementAnalysis(UUIDPrimaryKeyModel, TimeStampedModel):
    application = models.ForeignKey(
        "applications.LoanApplication",
        on_delete=models.CASCADE,
        related_name="bank_analyses",
    )
    avg_balance = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    salary_credits_detected = models.BooleanField(default=False)
    bounce_count = models.PositiveIntegerField(default=0)
    analysis_data = models.JSONField(default=dict, blank=True)
    analyzed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-analyzed_at"]
        verbose_name_plural = "Bank statement analyses"
