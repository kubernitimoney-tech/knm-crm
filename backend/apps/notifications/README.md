# Notifications App

## 1. Purpose

In-app notifications; async delivery via Celery (`notifications` queue).

## 2. Structure

`models/notification.py`, `tasks.py`, list APIView

## 3. Schema

`Notification`: recipient, title, body, channel, is_read, metadata

## 6. API

`GET /api/v1/notifications/` (authenticated)

## 12–13. Flow

Domain services enqueue in-app notifications via `NotificationService`:

| Event | Recipients |
|-------|------------|
| Public lead intake (`POST /leads/intake/`) | Assigned RM and CM |
| Application approved | Production managers |
| Disbursal sheet sent | Account & finance users |
| Repayment due in 0–3 days (daily Celery job) | Collection officers |
| Loan overdue (daily Celery job) | Collection officers and assigned CM |

`send_notification_task.delay(recipient_id, ...)` persists rows on the `notifications` queue.

Daily jobs (09:00 / 09:05 server time): `send_repayment_reminder_notifications`, `send_loan_overdue_notifications`.

Register beat schedules once per environment:

```bash
docker compose exec django python manage.py register_notification_beat_tasks
```
