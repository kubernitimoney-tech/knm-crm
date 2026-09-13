# RBAC navigation inventory

This document maps LMS sidebar sections to the permission codes enforced on the API.
Use it to detect nav/API drift when seed permissions or routes change.

| Sidebar section | Route prefix | Primary API permissions |
|-----------------|--------------|-------------------------|
| Dashboard | `/dashboard` | `dashboard.view` |
| Leads | `/leads` | `lead.view`, `lead.create` |
| Status-wise leads | `/leads/status-wise` | `lead.view` |
| Sanctions | `/sanctions/*` | `application.view`, `application.approve`, `application.sanction` |
| Disbursal | `/disbursal/*` | `disbursal.view`, `disbursal.send`, `disbursal.create` |
| Collections | `/collections/*` | `collection.view`, `collection.create` |
| Reports | `/reports/*` | `report.view`, `audit.view` |
| Master (category) | `/master/category` | `dashboard.view` (read); mutations Super Admin only |
| Bank holidays | `/master/category/bank-holidays` | GET `dashboard.view`; POST/PATCH/DELETE Super Admin |
| Branch targets | `/master/branch-targets` | GET `dashboard.view`; POST/PATCH/DELETE Super Admin |
| Users | `/users` | `user.view`, `user.create` |
| Permission matrix | `/master/permission-matrix` | `permission.view`, `permission.grant` |

## Role notes (unchanged by RBAC hardening)

- **Field Investigator**: intentionally minimal nav; API access via `field_investigation.*` and lead/application view where assigned.
- **Auditor**: view-only via `audit.view`, `report.view`, `lead.view`, etc. — no create/update/delete grants in seed.
- **Admin vs Production Manager**: PM uses admin template minus `user.create`, `user.update`, and `permission.view` / `grant` / `revoke`.
- **lead.assign**: reserved for transfer/roster tooling; transfer endpoint remains Admin/Super Admin only.
- **Sr. RM / Sr. CM**: org-wide visibility on assigned RM/CM pipelines (not branch-scoped).

Frontend route guards should prefer permission codes returned at login (`/auth/me/` permissions list) over hard-coded role names.
