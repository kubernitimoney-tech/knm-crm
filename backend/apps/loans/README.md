# Loans App

## 1. Purpose

Loan origination lifecycle: applications, approvals, disbursement, EMI schedules, payments.

## 2. Folder structure

```
loans/
├── models/loan.py
├── services/loan_service.py
├── selectors/loan_selectors.py
├── views/loan_views.py (ViewSet + APIViews)
└── tests/
```

## 3. Database schema

| Model | Purpose |
|-------|---------|
| LoanApplication | Intake + workflow state |
| Loan | Sanctioned account post-approval |
| LoanAssignment | RM / Ops assignment history |
| LoanApproval | Approve/reject decisions |
| LoanComment | Internal notes |
| LoanStatusHistory | Immutable state transitions |
| EMISchedule | Installment rows |
| PaymentTransaction | Payments against EMIs |

## 4. Relationships

`Customer` → `LoanApplication` → `Loan` → `EMISchedule` → `PaymentTransaction`

## 5. Sample records

Use `seed_fresh_leads` or create records through the API for local testing.

## 6. API examples

```http
POST /api/v1/loans/applications/
POST /api/v1/loans/applications/{id}/submit/
POST /api/v1/loans/applications/{id}/approve/
{ "approved_amount": 500000, "comments": "Approved" }
POST /api/v1/loans/applications/{id}/disburse/
```

## 7. Permission matrix

| Action | Permission |
|--------|------------|
| CRUD applications | loan.view/create/update/delete |
| Submit | loan.update |
| Approve | loan.approve |
| Reject | loan.reject |
| Disburse | loan.disburse |

## 8–11. Flows

- **Auth**: JWT → RBAC + `LoanObjectPermission` (RM, Ops, creator)
- **Workflow**: `LoanService.transition_application` → `WorkflowService.validate_transition`
- **Activity**: logged on create, submit, approve, reject, disburse, assign
- **Audit**: `post_save` signal on `LoanApplication`

## 12. Service layer

All transitions in `LoanService`; views only parse input and return envelope.

## 13. Query optimization

**List**: `select_related(customer, current_state, RM)` + `only()` on list fields.

**Detail**: `prefetch_related(comments, approvals, status_history, assignments)`.

**EMI**: `bulk_create()` in `generate_emi_schedule`.
