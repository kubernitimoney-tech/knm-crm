# LMS API — Postman Testing Guide

Use this guide to test the Loan Management System API with [Postman](https://www.postman.com/downloads/).

| Environment | Base URL | Postman env file |
|-------------|----------|------------------|
| **Local (Docker)** | `http://localhost:8000/api/v1` | `postman/LMS_Local.postman_environment.json` |
| **Test VPS** | `https://api-test.kubernitimoney.com/api/v1` | `postman/LMS_Test.postman_environment.json` |

Import the collection and environment from the `postman/` folder (see [Import collection](#import-collection)).

---

## 1. Prerequisites

1. Stack is running from the **repo root**:

   ```bash
   docker compose up -d
   docker compose exec django python manage.py seed_sample_data
   ```

2. You have a user that can log in (seeded admin or your superuser).

3. Postman installed (desktop or web).

---

## 2. Postman environments

### 2.1 LMS Local (development)

Import `postman/LMS_Local.postman_environment.json` or create an environment named **LMS Local**:

| Variable | Initial value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:8000/api/v1` | API root |
| `admin_email` | `admin@kubernitimoney.com` | Seeded admin email |
| `admin_password` | `Admin@123` | Seeded admin password |
| `access_token` | *(empty)* | Set automatically after login |
| `refresh_token` | *(empty)* | Set automatically after login |
| `customer_id` | *(empty)* | Customer UUID |
| `lead_id` | *(empty)* | Lead UUID |
| `application_id` | *(empty)* | Loan application UUID |
| `loan_id` | *(empty)* | Loan UUID |
| `product_id` | *(empty)* | Product UUID (set by List Products) |
| `user_id` | *(empty)* | User UUID |
| `audit_log_id` | *(empty)* | Audit log UUID |

### 2.2 LMS Test (VPS — test.kubernitimoney.com)

Import `postman/LMS_Test.postman_environment.json` and select **LMS Test (test.kubernitimoney.com)** in Postman (top-right).

| Variable | Initial value | Description |
|----------|---------------|-------------|
| `base_url` | `https://api-test.kubernitimoney.com/api/v1` | Test API root |
| `app_url` | `https://test.kubernitimoney.com` | LMS web app (for reference) |
| `admin_email` | `admin@kubernitimoney.com` | Superuser / admin email on VPS |
| `admin_password` | *(empty — set yours)* | Password from `createsuperuser` on server |
| `scm_email` | *(empty — set yours)* | Senior Credit Manager test user |
| `scm_password` | *(empty — set yours)* | SCM password |
| `access_token` | *(empty)* | Set automatically after login |
| `refresh_token` | *(empty)* | Set automatically after login |
| *(same ID vars as local)* | *(empty)* | `customer_id`, `lead_id`, etc. |

**Before first test on VPS:**

1. DNS must resolve `api-test.kubernitimoney.com` to your VPS.
2. Stack running: `docker compose -f docker-compose.prod.yml up -d` on the server.
3. Seed data (once): `seed_permissions`, `seed_products`, `seed_loan_workflow`, etc. — see [DEPLOY_README.md](./DEPLOY_README.md).
4. Fill `admin_password` (and optionally `scm_email` / `scm_password`) in the Postman environment.

**Django admin on test:** `https://api-test.kubernitimoney.com/admin/`

**Other deployments:** duplicate an environment file and change `base_url` only (e.g. `https://api.kubernitimoney.com/api/v1` for production later).

---

## 3. Global headers

For **authenticated** requests, add:

| Key | Value |
|-----|--------|
| `Authorization` | `Bearer {{access_token}}` |
| `Content-Type` | `application/json` |

Auth endpoints (`login`, `refresh`) and **public lead intake / track** (`POST /leads/intake/`, `GET /leads/intake/sources/`, `POST /leads/intake/track/`) do **not** need `Authorization`. The imported collection sets Bearer auth at collection level; public intake requests override with **No Auth**.

---

## 4. Response format

All JSON responses use this envelope:

**Success:**

```json
{
  "success": true,
  "message": "OK",
  "data": { }
}
```

**Error:**

```json
{
  "success": false,
  "message": "Validation error.",
  "errors": { }
}
```

**Paginated lists** return:

```json
{
  "success": true,
  "data": {
    "count": 42,
    "next": "...",
    "previous": null,
    "results": [ ]
  }
}
```

---

## 5. Authentication flow (do this first)

### 5.1 Login

| Field | Value |
|-------|--------|
| Method | `POST` |
| URL | `{{base_url}}/auth/login/` |
| Body | raw → JSON |

```json
{
  "email": "{{admin_email}}",
  "password": "{{admin_password}}"
}
```

**Tests script** (saves tokens):

```javascript
if (pm.response.code === 200) {
    const res = pm.response.json();
    if (res.data && res.data.tokens) {
        pm.environment.set("access_token", res.data.tokens.access);
        pm.environment.set("refresh_token", res.data.tokens.refresh);
    }
}
```

### 5.2 Me

| Method | `GET` |
| URL | `{{base_url}}/auth/me/` |

Returns the logged-in user profile and permissions.

### 5.3 Refresh token

| Method | `POST` |
| URL | `{{base_url}}/auth/refresh/` |

```json
{
  "refresh": "{{refresh_token}}"
}
```

### 5.4 Logout

| Method | `POST` |
| URL | `{{base_url}}/auth/logout/` |

```json
{
  "refresh": "{{refresh_token}}"
}
```

---

## 6. Health check (no auth)

| Method | `GET` |
| URL | `{{base_url}}/health/` |

Expected: `200`, `"success": true`, `"data": { "status": "healthy" }`.

---

## 7. Endpoint reference

### Core

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| List branches | GET | `{{base_url}}/core/branches/` | `branch.view` |

---

### Accounts

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| List users | GET | `{{base_url}}/accounts/users/` | `user.view` |
| Create user | POST | `{{base_url}}/accounts/users/` | `user.create` |
| Get user | GET | `{{base_url}}/accounts/users/{id}/` | `user.view` |
| Assign role | POST | `{{base_url}}/accounts/users/{id}/assign-role/` | `user.update` |
| Revoke role | POST | `{{base_url}}/accounts/users/{id}/revoke-role/` | `user.update` |
| Role history | GET | `{{base_url}}/accounts/users/{id}/role-history/` | `user.view` |
| Assignable roles | GET | `{{base_url}}/accounts/users/assignable-roles/` | `user.view` |
| List roles | GET | `{{base_url}}/accounts/roles/` | `role.view` |
| Permission matrix | GET | `{{base_url}}/accounts/permissions/matrix/` | `role.view` |
| Grant role permission | POST | `{{base_url}}/accounts/roles/{role_slug}/permissions/grant/` | `role.update` |
| Revoke role permission | POST | `{{base_url}}/accounts/roles/{role_slug}/permissions/revoke/` | `role.update` |

---

### Customers

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| List | GET | `{{base_url}}/customers/` | `customer.view` |
| Create | POST | `{{base_url}}/customers/` | `customer.create` |
| Get | GET | `{{base_url}}/customers/{id}/` | `customer.view` |
| Update | PATCH | `{{base_url}}/customers/{id}/` | `customer.update` |
| Delete | DELETE | `{{base_url}}/customers/{id}/` | `customer.delete` |
| Profile | GET | `{{base_url}}/customers/{id}/profile/` | `customer.view` |

**Create customer:**

```json
{
  "first_name": "Amit",
  "last_name": "Kumar",
  "email": "amit@example.com",
  "mobile_number": "9876501234",
  "gender": "male",
  "dob": "1990-05-15",
  "pan_no": "ABCDE1234F"
}
```

Save response `data.id` → `customer_id`.

**List query params:** `?search=amit`, `?page=1`, `?page_size=20`

---

### Leads

#### Public intake (no authentication)

For **website**, **social media**, and **ads** forms — no JWT required.

| Name | Method | URL | Auth |
|------|--------|-----|------|
| List intake sources | GET | `{{base_url}}/leads/intake/sources/` | None |
| Submit lead (intake) | POST | `{{base_url}}/leads/intake/` | None |
| Track applications (PAN or mobile) | POST | `{{base_url}}/leads/intake/track/` | None |

**List intake sources** returns:

```json
{
  "success": true,
  "data": [
    { "slug": "website", "name": "Website" },
    { "slug": "social-media", "name": "Social Media" },
    { "slug": "ads", "name": "Ads" }
  ]
}
```

**Submit lead (website example — full payload, matches the marketing-site apply form):**

```json
{
  "first_name": "Asha",
  "last_name": "Verma",
  "email": "asha@example.com",
  "mobile_number": "9876501234",
  "dob": "1992-03-10",
  "gender": "Female",
  "pan_no": "ABCPV1234A",
  "aadhaar_no": "123456789012",
  "required_amount": "25000.00",
  "loan_purpose": "Personal",
  "source_slug": "website",
  "employment": {
    "employer_name": "Infosys Ltd",
    "designation": "Software Engineer",
    "employment_type": "salaried",
    "monthly_salary": "60000.00"
  },
  "address": {
    "address_type": "own",
    "line1": "45 Residency Road",
    "line2": "Near Central Mall",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560025",
    "country": "India"
  }
}
```

> The marketing-site sends this full nested payload (personal details + `employment` + `address`), which is why website leads show complete data. A minimal body (only `first_name`, `email`, `mobile_number`, `required_amount`, `source_slug`) is also accepted, but the resulting lead will be missing income, location, PAN/Aadhaar, and loan purpose.

| Field | Required | Notes |
|-------|----------|--------|
| `first_name` | Yes | |
| `email` | Yes | Valid business email |
| `mobile_number` | Yes | 10-digit Indian mobile |
| `required_amount` | Yes | Decimal string |
| `source_slug` | No | `website` (default), `social-media`, or `ads` |
| `last_name` | No | |
| `dob` | No | If sent, customer must be 21+ |
| `gender` | No | e.g. `male`, `female` |
| `pan_no` / `aadhaar_no` | No | Optional on public intake |
| `loan_purpose` | No | See loan purpose list below |
| `employment` | No | `{ "employment_type": "salaried", "monthly_salary": "50000.00" }` |
| `address` | No | `{ "line1", "city", "state", "pincode", ... }` |

**Response (201):**

```json
{
  "success": true,
  "message": "Lead submitted successfully",
  "data": {
    "id": "uuid",
    "lead_id": "LMS000123",
    "category": "fresh",
    "category_display": "Fresh",
    "status": "pending_contact",
    "status_display": "Pending Contact",
    "source_slug": "website",
    "source_name": "Website"
  }
}
```

- First lead for a customer → `category: fresh`
- Repeat customer → `category: reloan`
- Status is always **`pending_contact`** on create
- Rate limit: max **2 leads per customer per hour** (returns `429` if exceeded)

**Social media / ads:** same body; set `"source_slug": "social-media"` or `"ads"`.

---

#### Authenticated lead APIs (JWT required)

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| List | GET | `{{base_url}}/leads/` | `lead.view` |
| Summary | GET | `{{base_url}}/leads/summary/` | `lead.view` (or reporting/disbursement roles) |
| Create | POST | `{{base_url}}/leads/` | `lead.create` |
| Get | GET | `{{base_url}}/leads/{id}/` | `lead.view` |
| Update | PATCH | `{{base_url}}/leads/{id}/` | `lead.update` |
| Delete | DELETE | `{{base_url}}/leads/{id}/` | `lead.delete` |
| Convert | POST | `{{base_url}}/leads/{id}/convert/` | `lead.convert` |
| Transfer | POST | `{{base_url}}/leads/{id}/transfer/` | `lead.update` |
| Call logs | GET/POST | `{{base_url}}/leads/{id}/call-logs/` | `call_log.view` / `call_log.create` |
| Customer lookup | GET | `{{base_url}}/leads/customer-lookup/?mobile_number=...` | `customer.view` **or** `lead.view` **or** `lead.create` |
| Sources (admin) | GET | `{{base_url}}/leads/sources/` | `lead.view` |
| Pipeline | GET | `{{base_url}}/leads/pipeline/` | `lead.view` |
| Assignment roster | GET | `{{base_url}}/leads/assignment-roster/` | `lead.view` |

**List query params:** `?search=...`, `?status=interested`, `?category=fresh|reloan`, `?application_status=disbursed`, `?date_from=2026-01-01`, `?date_to=2026-12-31`, `?page=1`, `?page_size=20`

**Summary query params:** same filters as list; returns `{ "total", "fresh", "reloan" }` counts without row payload.

**Create lead (staff / CRM — full payload):**

```json
{
  "first_name": "Ravi",
  "last_name": "Sharma",
  "email": "ravi@example.com",
  "mobile_number": "9876512345",
  "dob": "1990-05-15",
  "gender": "male",
  "pan_no": "FGHIJ5678K",
  "required_amount": "50000.00",
  "loan_purpose": "Personal",
  "employment": {
    "employment_type": "salaried",
    "employer_name": "Acme Pvt Ltd",
    "monthly_salary": "55000.00"
  },
  "address": {
    "line1": "12 MG Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001"
  }
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `first_name`, `email`, `mobile_number`, `dob`, `gender`, `required_amount` | Yes | |
| `pan_no` **or** `aadhaar_no` | One required | |
| `employment.monthly_salary` | Yes | Min `40000`; loan amount must be **less than** monthly income |
| `source` | No | Lead source UUID from `GET /leads/sources/` |
| `interested_product` | No | Product UUID |
| `loan_purpose` | No | One of: `Personal`, `Medical emergency`, `Wedding`, `Others`, etc. |

Save `data.id` → `lead_id`, `data.customer` → `customer_id`.

**Log call (updates lead status by disposition):**

```json
{
  "disposition": "interested",
  "remarks": "Customer interested in payday loan"
}
```

`disposition` values: `busy`, `call_back`, `call_disconnected`, `dnd`, `duplicate_lead`, `loan_running`, `interested`, `invalid_number`, `no_answer`, `not_interested`, `switched_off`, `other`

Examples:
- `duplicate_lead` → lead status `duplicate_lead`
- `loan_running` → lead status `loan_running`
- `interested` → lead status `interested` (may auto-create application)

**Convert lead:**

```json
{
  "product_id": "{{product_id}}",
  "requested_amount": "50000.00",
  "tenure_value": 1
}
```

---

### Applications

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| List products | GET | `{{base_url}}/applications/products/` | `loan.view` |
| List applications | GET | `{{base_url}}/applications/applications/` | `loan.view` |
| Get application | GET | `{{base_url}}/applications/applications/{id}/` | `loan.view` |
| Create | POST | `{{base_url}}/applications/applications/create/` | `loan.create` |
| Submit | POST | `{{base_url}}/applications/applications/{id}/submit/` | `loan.update` |
| Decide | POST | `{{base_url}}/applications/applications/{id}/decide/` | `loan.approve` |
| Create loan | POST | `{{base_url}}/applications/applications/{id}/create-loan/` | `loan.approve` |

> Note the path prefix: `/applications/applications/` (not `/loans/applications/`).

**Create application:**

```json
{
  "customer_id": "{{customer_id}}",
  "product_id": "{{product_id}}",
  "requested_amount": "50000.00",
  "tenure_value": 1,
  "purpose": "Personal expense"
}
```

Run **List Products** first to get a `product_id` (seeded codes: `PAYDAY`, `SALARY_ADVANCE`).

**Approve (decide):**

```json
{
  "decision": "approved",
  "approved_amount": "50000.00",
  "approved_tenure_value": 1,
  "interest_rate": "24.0000",
  "processing_fee": "500.00",
  "remarks": "Approved"
}
```

**Reject (decide):**

```json
{
  "decision": "rejected",
  "rejection_reason": "Insufficient documentation",
  "remarks": "Rejected"
}
```

**Typical workflow:** Create → Submit → Decide (approved) → Create Loan

---

### Loans

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| List loans | GET | `{{base_url}}/loans/` | `loan.view` |
| Get loan | GET | `{{base_url}}/loans/{id}/` | `loan.view` |
| Disburse | POST | `{{base_url}}/loans/{id}/disburse/` | `loan.disburse` |
| List repayments | GET | `{{base_url}}/loans/{id}/repayments/` | `loan.view` |
| Record repayment | POST | `{{base_url}}/loans/{id}/repayments/record/` | `loan.disburse` |
| Ledger | GET | `{{base_url}}/loans/{id}/ledger/` | `loan.view` |

**Disburse:**

```json
{
  "utr_reference": "UTR123456789",
  "payment_mode": "neft",
  "remarks": "Disbursed via NEFT"
}
```

**Record repayment:**

```json
{
  "amount": "5000.00",
  "payment_mode": "upi",
  "utr": "UPI987654321",
  "remarks": "Partial repayment"
}
```

`payment_mode`: `cash` | `upi` | `imps` | `neft` | `rtgs` | `cheque`

---

### Documents

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| List docs for application | GET | `{{base_url}}/documents/applications/{application_id}/documents/` | `document.view` |
| Get document | GET | `{{base_url}}/documents/applications/{application_id}/documents/{id}/` | `document.view` |
| Upload | POST | `{{base_url}}/documents/upload/{application_id}/` | `document.upload` |

**Upload:** Body → **form-data** (not JSON)

| Key | Type | Value |
|-----|------|--------|
| `document_type` | Text | `pan` |
| `file` | File | *(select file)* |

`document_type` codes: `pan`, `aadhaar`, `salary_slip`, `bank_statement`, `photograph`

---

### Workflow

| Method | GET |
| URL | `{{base_url}}/workflow/` |
| Permission | `workflow.view` |

---

### Activities

| Method | GET |
| URL | `{{base_url}}/activities/timeline/?model={model}&object_id={uuid}` |
| Permission | `audit.view` |

**Query params:**

| Param | Values |
|-------|--------|
| `model` | `customer`, `lead`, `loan_application`, `loan` |
| `object_id` | UUID of the record |

Example: `?model=loan_application&object_id={{application_id}}`

---

### Dashboard

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| Summary | GET | `{{base_url}}/dashboard/` | `dashboard.view` |
| Tables | GET | `{{base_url}}/dashboard/tables/` | `dashboard.view` |
| List branch targets | GET | `{{base_url}}/dashboard/branch-targets/` | `dashboard.view` |
| Create branch target | POST | `{{base_url}}/dashboard/branch-targets/` | `dashboard.update` |

---

### Reports

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| Filter options | GET | `{{base_url}}/reports/filters/` | `report.view` |
| Portfolio export | POST | `{{base_url}}/reports/portfolio/` | `report.export` |
| Disbursed | GET | `{{base_url}}/reports/disbursed/?page=1&page_size=50` | `report.view` |
| Collection | GET | `{{base_url}}/reports/collection/?page=1&page_size=50` | `report.view` |
| CIBIL | GET | `{{base_url}}/reports/cibil/?page=1&page_size=50` | `report.view` |

**Portfolio export body:** optional filters as JSON, e.g. `{}` or `{ "status": "approved" }`.

---

### Notifications

| Method | GET |
| URL | `{{base_url}}/notifications/` |

Returns notifications for the logged-in user.

---

### Audit logs

| Name | Method | URL | Permission |
|------|--------|-----|------------|
| List | GET | `{{base_url}}/audit-logs/` | `audit.view` |
| Get | GET | `{{base_url}}/audit-logs/{id}/` | `audit.view` |

Query: `?model_name=LoanApplication&action=create`

---

## 8. Common HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation / business rule error |
| 401 | Missing or invalid JWT |
| 403 | Authenticated but missing RBAC permission |
| 404 | Resource not found |

---

## 9. Troubleshooting in Postman

| Issue | Fix |
|-------|-----|
| 401 on all APIs | Run **Auth → Login** again; check `Authorization: Bearer {{access_token}}` |
| 403 Forbidden | User lacks permission; use superuser or assign role (`seed_permissions`) |
| Connection refused | `docker compose ps` — ensure `django` is **Up** (run from repo root) |
| HTML instead of JSON | Wrong URL; use `/api/v1/...` not `/admin/` |
| Empty `data` on list | Check pagination: `data.results` inside paginated responses |
| 404 on loan applications | Use `/applications/applications/`, not `/loans/applications/` |
| Missing `product_id` | Run **Applications → List Products** first |
| 401 on public intake | Remove `Authorization` header; use **Public Lead Intake** requests (No Auth) |
| 429 on lead create | Same customer submitted more than 2 leads in the last hour |

---

## 10. Import collection

Files in `postman/`:

| File | Purpose |
|------|---------|
| `LMS_API.postman_collection.json` | Pre-built requests (grouped by module) |
| `LMS_Local.postman_environment.json` | Local Docker (`localhost:8000`) |
| `LMS_Test.postman_environment.json` | Test VPS (`api-test.kubernitimoney.com`) |

**Import steps:**

1. Postman → **Import** → select the collection + the environment you need (Local or Test).
2. Select environment **LMS Local** or **LMS Test (test.kubernitimoney.com)** (top-right).
3. For Test: set `admin_password` (and `scm_email` / `scm_password` if testing SCM lead create).
4. Run **Auth → Login** first (or **Login (Senior Credit Manager)** for SCM tests).
5. Run **Applications → List Products** to set `product_id`.
6. Run other requests in the collection.

### Test server — Senior Credit Manager lead create

1. As admin: **Accounts → Permission Matrix** → grant `lead.create` to **Senior Credit Manager** (with approval email).
2. In Postman env: set `scm_email` and `scm_password`.
3. **Auth → Login (Senior Credit Manager)**.
4. **Auth → Me** — confirm `lead.create` appears in `permissions`.
5. **Leads → Customer Lookup** then **Leads → Create Lead**.

---

## 11. Suggested test sequence

**Public intake (optional — no login):**

1. `GET` Public intake sources
2. `POST` Submit lead (website / social-media / ads)

**Authenticated workflow:**

1. `GET` Health
2. `POST` Login → save tokens
3. `GET` Me
4. `GET` List Products → save `product_id`
5. `POST` Create Lead (staff) **or** use public intake above → save `lead_id` and `customer_id`
6. `POST` Create Application → save `application_id` *(or Convert Lead)*
7. `POST` Submit Application
8. `POST` Approve Application (decide)
9. `POST` Create Loan from Application → save `loan_id`
10. `POST` Disburse Loan
11. `POST` Record Repayment
12. `GET` Loan Ledger
13. `GET` Activity Timeline
14. `GET` Dashboard
15. `POST` Upload document (form-data)
16. `POST` Logout

---

## 12. Admin vs API users

| Use case | Tool |
|----------|------|
| REST API | Postman + JWT (`/api/v1/...`) |
| Django admin UI (local) | `http://localhost:8000/admin/` — needs `is_staff=True` |
| Django admin UI (test VPS) | `https://api-test.kubernitimoney.com/admin/` |
| Database UI (local) | Adminer `http://localhost:8080` — see root [README.md](../README.md#adminer-database-ui) |

API login does not grant admin access unless the user is staff/superuser.
