# Core App

## 1. Purpose

Shared abstractions: base models, API response envelope, exception handler, pagination.

## 2. Structure

`models/base.py`, `responses.py`, `middleware.py`, `exceptions.py`, `pagination.py`

## 3–4. Schema

Abstract: `TimeStampedModel`, `AuditModel`, `SoftDeleteModel`, `UUIDPrimaryKeyModel`.

## 5–13. Flows

- **Inheritance**: compose `TimeStamped + Audit + SoftDelete` on business entities only.
- **Responses**: `success_response` / `error_response`; middleware wraps raw DRF JSON.
- **Exceptions**: `custom_exception_handler` maps validation to `{ success: false, errors }`.

See root `README.md` for design rationale.
