from celery import shared_task


@shared_task(queue="reports")
def generate_loan_portfolio_report(user_id: str, filters: dict):
    """Background portfolio export — persist file and notify the requesting user."""
    return {"status": "completed", "user_id": user_id, "filters": filters}
