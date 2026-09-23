# Customers App

## 1. Purpose

Borrower KYC profile management with soft delete and activity logging.

## 2. Structure

`models/`, `services/customer_service.py`, `selectors/`, `views/CustomerViewSet`, `tests/`

## 3. Schema

`Customer`: UUID PK, `customer_code`, demographics, `monthly_income`, `address`. Indexes on code, email. Check: income ≥ 0.

## 4. Relationships

`Customer` 1—* `LoanApplication`

## 5. Sample

`CUS-00001`, Rahul Sharma — via seed script.

## 6. API

`GET/POST /api/v1/customers/` — requires `customer.view` / `customer.create`.

## 7. Permissions

customer.view | create | update | delete

## 8–13. Flows

Create → `CustomerService.create_customer` → `ActivityService.log` → audit via core patterns.

**Query**: list uses `only()` + `defer(address)` + `select_related(created_by)`.
