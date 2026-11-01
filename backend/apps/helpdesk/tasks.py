from celery import shared_task


@shared_task(queue="default")
def auto_close_resolved_tickets():
    from apps.helpdesk.services.ticket_service import TicketService

    return {"closed": TicketService.auto_close_due()}
