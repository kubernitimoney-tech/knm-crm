# Audit Logs App

## 1. Purpose

Compliance-grade change log: who changed what, before/after JSON, IP, user agent.

## 2. Structure

`middleware.py`, `services/audit_service.py`, `signals` (from loans), `AuditLogViewSet`

## 3. Schema

`AuditLog`: user, action, model_name, object_id, before_data, after_data, ip_address, user_agent, created_at

## 4–5. Relationships / samples

Linked to `User`; object_id is string UUID. Created on `LoanApplication` save via signal.

## 6. API

`GET /api/v1/audit-logs/?model_name=LoanApplication`

## 7. Permissions

loan.view (read-only audit for loan officers)

## 8–13. Middleware flow

1. `AuditContextMiddleware` stores IP + UA on thread-local per request
2. `AuditService.log_model_change` reads context + serializes instance
3. Immutable append-only log — no updates/deletes via API
