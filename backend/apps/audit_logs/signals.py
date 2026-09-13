from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.applications.models import LoanApplication
from apps.audit_logs.services.audit_service import AuditService
from apps.core.soft_delete_context import consume_soft_delete
from apps.customers.models import Customer
from apps.leads.models import Lead
from apps.loans.models import Loan
from apps.repayments.models import LoanRepayment


def _audit_save(sender, instance, created, *, model_name: str):
    if not created and consume_soft_delete(instance):
        AuditService.log_model_change(
            instance=instance,
            action="delete",
            model_name=model_name,
            after=AuditService._serialize(instance),
        )
        return

    AuditService.log_model_change(
        instance=instance,
        action="create" if created else "update",
        model_name=model_name,
    )


def _audit_delete(sender, instance, *, model_name: str):
    AuditService.log_model_change(
        instance=instance,
        action="delete",
        model_name=model_name,
        after=None,
    )


@receiver(post_save, sender=Customer)
def audit_customer_save(sender, instance, created, **kwargs):
    _audit_save(sender, instance, created, model_name="Customer")


@receiver(post_delete, sender=Customer)
def audit_customer_delete(sender, instance, **kwargs):
    _audit_delete(sender, instance, model_name="Customer")


@receiver(post_save, sender=Lead)
def audit_lead_save(sender, instance, created, **kwargs):
    _audit_save(sender, instance, created, model_name="Lead")


@receiver(post_delete, sender=Lead)
def audit_lead_delete(sender, instance, **kwargs):
    _audit_delete(sender, instance, model_name="Lead")


@receiver(post_save, sender=Loan)
def audit_loan_save(sender, instance, created, **kwargs):
    _audit_save(sender, instance, created, model_name="Loan")


@receiver(post_delete, sender=Loan)
def audit_loan_delete(sender, instance, **kwargs):
    _audit_delete(sender, instance, model_name="Loan")


@receiver(post_save, sender=LoanRepayment)
def audit_repayment_save(sender, instance, created, **kwargs):
    _audit_save(sender, instance, created, model_name="LoanRepayment")


@receiver(post_delete, sender=LoanRepayment)
def audit_repayment_delete(sender, instance, **kwargs):
    _audit_delete(sender, instance, model_name="LoanRepayment")


@receiver(post_save, sender=LoanApplication)
def audit_loan_application_save(sender, instance, created, **kwargs):
    _audit_save(sender, instance, created, model_name="LoanApplication")


@receiver(post_delete, sender=LoanApplication)
def audit_loan_application_delete(sender, instance, **kwargs):
    _audit_delete(sender, instance, model_name="LoanApplication")
