# Help Desk App

## 1. Purpose

Internal tickets: any CRM user (RM, CM, Collection, Accounts, ...) raises an issue they
cannot fix themselves (call log edit, repayment date, bank account, UTR, export data);
IT Support corrects it and resolves; the raiser confirms the fix and closes.

## 2. Lifecycle

```
OPEN ─► IN_PROGRESS ─► RESOLVED ─► CLOSED (raiser confirms | auto after 3 working days)
 │  ▲        │            └──► REOPENED ─► IN_PROGRESS ...
 │  └ ON_HOLD ◄┘
 └──► CANCELLED (raiser, before work starts)
```

- Resolve needs a resolution remark (optional before → after `corrections`).
- Only the raiser closes or reopens. Closed is final; follow-ups use `related_ticket`.
- Nobody resolves a ticket they raised.
- `auto_close_at` = resolved time + 3 working days (Sundays and `BankHoliday` dates
  skipped). Cleared on reopen, recomputed on the next resolve.

All transitions go through `TicketService`, which writes a `TicketEvent`, logs an
`Activity` on the linked record and sends in-app notifications.

## 3. RBAC

| Code | Who |
|---|---|
| `ticket.view`, `ticket.create` | every role (Auditor: view only) |
| `ticket.resolve`, `ticket.assign`, `ticket.export` | IT Support, Admin tiers |

Role `it-support` (IT Support) has read-only access to leads, call logs, customers,
applications, sanction, disbursal, loans, collection and documents. Edit grants needed
for a correction are given per user, not baked into the role.

Visibility: ticket.resolve / ticket.assign holders and admins see all tickets; everyone
else sees tickets they raised or are assigned.

## 4. API (`/api/v1/helpdesk/`)

```
GET        categories/                   ?department=   (Admin: POST / PATCH)
GET/POST   tickets/                      ?status=a,b&department&priority&category&assigned_to=me|none|<id>&mine=1&search&date_from&date_to
GET        tickets/{id}/                 detail + events + comments + attachments + allowed_actions
POST       tickets/{id}/assign/          {"assignee": "<uuid>"}
POST       tickets/{id}/start/
POST       tickets/{id}/hold/            {"remark"}
POST       tickets/{id}/resolve/         {"remark", "corrections": [{"field","before","after"}]}
POST       tickets/{id}/close/           {"remark"?}      raiser only
POST       tickets/{id}/reopen/          {"remark"}       raiser only
POST       tickets/{id}/cancel/          {"remark"?}      raiser only, OPEN only
POST       tickets/{id}/comments/        {"body", "is_internal"?}
POST       tickets/{id}/attachments/     multipart file (PDF/PNG/JPG/XLSX/CSV, 5 MB)
GET        tickets/summary/              status counts, my confirmations, IT queue counts
GET        tickets/assignees/            IT Support users
GET        tickets/export/               CSV (ticket.export)
```

Linkable records (`linked_type`): `lead`, `call_log`, `customer`, `application`, `loan`.

## 5. Auto-close

Register the hourly beat task once per environment:

```
python manage.py register_helpdesk_beat_tasks
```
