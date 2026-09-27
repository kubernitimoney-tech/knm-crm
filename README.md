# Loan Management System (LMS)

Full-stack FinTech LMS: **Django REST API** (`backend/`) + **React dashboard** (`frontend/`).

## Project layout

```
lms/
├── docker-compose.yml   # ← use this (repo root)
├── backend/             # Django 5.2 API, PostgreSQL, Redis, Celery, RBAC
│   └── apps/
│       ├── core, accounts, organization, customers, products
│       ├── leads              # CRM only (ends at CONVERTED)
│       ├── applications, underwriting
│       ├── loans, ledger, repayments, collections
│       ├── documents, workflow, activities, audit_logs
│       └── dashboard, reports, notifications
└── frontend/            # React (Vite) + TypeScript UI (LMS employee app, :3000)
└── marketing-site/      # Customer marketing SPA (:3001)
```

> **Important:** Run all `docker compose` commands from the **repo root** (`lms/`). Running from `backend/` uses a separate Compose project and will show `service "django" is not running` even when the stack is up.



## Contents

- [Quick start (Docker)](#quick-start-docker)
- [Service URLs](#service-urls)
- [Command reference](#command-reference)
  - [Django — with Docker](#django--with-docker)
  - [Django — without Docker](#django--without-docker-local)
  - [React — with Docker](#react--with-docker)
  - [React — without Docker](#react--without-docker-local)
  - [Adminer](#adminer-database-ui)
  - [PostgreSQL, Redis, Celery — Docker](#postgresql-redis-celery--with-docker)
  - [PostgreSQL, Redis, Celery — local](#postgresql-redis-celery--without-docker-local)
  - [Superuser & seeded users](#create-superuser-django-admin)
- [Troubleshooting](#troubleshooting)
- [API authentication](#api-authentication)
- [Architecture](#architecture)
- [Linting & code quality](#linting--code-quality)
- [Testing](#testing)
- [Production deployment](#production-deployment)



## Stack


| Layer         | Choice                               |
| ------------- | ------------------------------------ |
| Backend       | Django 5.2 LTS, DRF, JWT, Celery     |
| Frontend      | React 19, Vite, TypeScript, Tailwind |
| Database      | PostgreSQL 17                        |
| Cache / queue | Redis 7                              |
| Auth          | JWT with role-based UI permissions   |


---



## Quick start (Docker)

From the **repo root** (`lms/`):

```bash
# 1. Copy environment files (first time only)
cp backend/.env.example backend/.env
cp marketing-site/.env.example marketing-site/.env
# Windows: copy backend\.env.example backend\.env
#          copy marketing-site\.env.example marketing-site\.env

# 2. Build and start all services in the background
docker compose up -d --build

# 3. Load demo users, roles, products, workflow (first time or fresh DB)
docker compose exec django python manage.py seed_sample_data
```

Open **[http://localhost:3000](http://localhost:3000)** (LMS) or **[http://localhost:3001](http://localhost:3001)** (marketing site). Migrations and `collectstatic` run automatically when the `django` container starts.

> **Important:** Run every `docker compose` command from the **repo root** (`lms/`). Running from `backend/` uses a different Compose project and you will see `service "django" is not running`.

---



## Service URLs


| Service               | URL                                                                          | Notes                                             |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| **Frontend (LMS UI)** | [http://localhost:3000](http://localhost:3000)                               | Employee LMS app                                  |
| **Marketing site**    | [http://localhost:3001](http://localhost:3001)                               | Customer-facing website                           |
| **API**               | [http://localhost:8000/api/v1/](http://localhost:8000/api/v1/)               | REST API                                          |
| **Health**            | [http://localhost:8000/api/v1/health/](http://localhost:8000/api/v1/health/) | API health check                                  |
| **Django admin**      | [http://localhost:8000/admin/](http://localhost:8000/admin/)                 | Requires `createsuperuser`                        |
| **Adminer**           | [http://localhost:8080](http://localhost:8080)                               | Database UI — see [Adminer](#adminer-database-ui) |
| **Digio webhook**     | `https://<public-host>/api/v1/webhooks/digio/?token=<DIGIO_WEBHOOK_SECRET>` | Paste this in the Digio dashboard. `localhost` will not work. |


---

## Digio e-sign and video KYC

Set sandbox credentials in `backend/.env`, then recreate Django:

```bash
docker compose up -d --force-recreate django
```

Required keys:

```bash
DIGIO_ENV=sandbox
DIGIO_CLIENT_ID=...          # sandbox client id from Digio
DIGIO_CLIENT_SECRET=...      # sandbox client secret
DIGIO_WEBHOOK_SECRET=...     # you choose this string; must match the URL token
DIGIO_KYC_TEMPLATE_NAME=...  # exact KYC template name from the Digio dashboard
DIGIO_ESIGN_SIGN_TYPE=aadhaar
```

Leave `DIGIO_BASE_URL` unset in sandbox so the API uses `https://ext-api.digio.in` (the JSON API). Do not use `https://ext.digio.in` as the API host — that is the website and returns HTML. The signing gateway stays `https://ext.digio.in`. Production API is `https://api.digio.in`.

**Webhook URL to paste in Digio (Profile → Webhooks):**

```text
https://YOUR_PUBLIC_HTTPS_HOST/api/v1/webhooks/digio/?token=YOUR_DIGIO_WEBHOOK_SECRET
```

Digio calls this URL from the internet. `http://localhost:8000/...` will never receive events. For local testing, expose port 8000 with a tunnel (for example `ngrok http 8000`) and use the `https://…ngrok…` host in that URL.

If **Request e-sign** says Digio returned HTML or a non-JSON response, the LMS is not talking to the sandbox API. Recheck sandbox client id/secret (not production), `DIGIO_ENV=sandbox`, and recreate the Django container.

---



## Command reference

All commands below are copy-paste ready.


|            | Docker (repo root `lms/`)                       | Local                                                  |
| ---------- | ----------------------------------------------- | ------------------------------------------------------ |
| **Django** | `docker compose exec django python manage.py …` | `cd backend` → activate `.venv` → `python manage.py …` |
| **React**  | `docker compose … frontend`                     | `cd frontend` → `npm …`                                |
| **DB UI**  | `docker compose up -d adminer`                  | Use Docker for postgres+adminer, or a desktop client   |
| **Celery** | `docker compose up -d celery celery-beat`       | Separate terminals from `backend/`                     |


**Docker** = run from repo root (`lms/`). **Local** = run from `backend/` or `frontend/` as noted.

### Django — with Docker

Prefix every management command with `docker compose exec django`. Use `-it` when the command is interactive (prompts).

```bash
# ── First-time setup ──────────────────────────────────────────────

# Copy env file (once)
cp backend/.env.example backend/.env

# Start full stack (API, UI, Postgres, Redis, Celery, Adminer)
docker compose up -d --build

# Load demo data (users, RBAC, products, workflow)
docker compose exec django python manage.py seed_sample_data

# ── Run / restart API ─────────────────────────────────────────────

# Start all services (no rebuild)
docker compose up -d

# Rebuild images after Dockerfile or requirements change
docker compose up -d --build

# Restart only the Django API container
docker compose restart django

# Follow API logs (live)
docker compose logs -f django

# Last 100 log lines (migration / startup errors)
docker compose logs django --tail 100

# ── Migrations ────────────────────────────────────────────────────

# Create migrations after model changes (all apps)
docker compose exec django python manage.py makemigrations

# Create migrations for one app
docker compose exec django python manage.py makemigrations leads

# Create migrations for multiple apps
docker compose exec django python manage.py makemigrations applications loans

# Apply all pending migrations
docker compose exec django python manage.py migrate

# Apply migrations for one app only
docker compose exec django python manage.py migrate ledger

# Apply up to a specific migration (example)
docker compose exec django python manage.py migrate leads 0015

# List migration status (applied / pending)
docker compose exec django python manage.py showmigrations

# ── Superuser & admin ─────────────────────────────────────────────

# Create Django superuser (interactive — email + password)
docker compose exec -it django python manage.py createsuperuser

# Collect static files (fix unstyled Django admin)
docker compose exec django python manage.py collectstatic --noinput

# ── Shell & database ──────────────────────────────────────────────

# Django shell (ORM)
docker compose exec -it django python manage.py shell

# One-liner in shell
docker compose exec django python manage.py shell -c "from apps.loans.models import Loan; print(Loan.objects.count())"

# PostgreSQL CLI inside postgres container
docker compose exec postgres psql -U lms_user -d lms

# Django dbshell (connects via DATABASE_URL)
docker compose exec django python manage.py dbshell

# ── Seed & maintenance ────────────────────────────────────────────

# Full demo seed (recommended)
docker compose exec django python manage.py seed_sample_data

# Individual seed commands
docker compose exec django python manage.py seed_permissions
docker compose exec django python manage.py seed_loan_workflow
docker compose exec django python manage.py seed_document_types
docker compose exec django python manage.py seed_branches
docker compose exec django python manage.py seed_products
docker compose exec django python manage.py seed_dashboard_targets

# System check
docker compose exec django python manage.py check

# Run backend tests
docker compose exec django pytest

# Run tests with coverage
docker compose exec django pytest --cov=apps

# ── Health check ──────────────────────────────────────────────────

# Prefer this on Windows (host curl can hang)
docker compose exec django curl -sf http://localhost:8000/api/v1/health/
```

**Fresh database (Docker)** — wipe volumes and start clean:

```bash
docker compose down -v
docker compose up -d postgres redis
docker compose run --rm django python manage.py migrate --noinput
docker compose run --rm django python manage.py seed_sample_data
docker compose up -d
```

---



### Django — without Docker (local)

Requires **Python 3.11+**, **PostgreSQL 17**, and **Redis 7** on your machine.

```bash
# ── First-time setup ──────────────────────────────────────────────

cd backend

# Copy env file (once)
cp .env.example .env          # Windows: copy .env.example .env
```

Edit `backend/.env` — use **localhost** for DB and Redis (not `postgres` / `redis`):

```env
DATABASE_URL=postgres://lms_user:lms_password@localhost:5432/lms
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
```

Create the PostgreSQL database (once, from any terminal):

```bash
# Linux / macOS (adjust if your postgres user differs)
createdb -U postgres lms
psql -U postgres -c "CREATE USER lms_user WITH PASSWORD 'lms_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE lms TO lms_user;"

# Windows — use psql or pgAdmin; database name: lms, user: lms_user
```

Python virtualenv and dependencies:

```bash
cd backend

# Create and activate virtualenv
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux / macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements/local.txt

# ── Run API ───────────────────────────────────────────────────────

# Apply migrations (first time and after model changes)
python manage.py migrate

# Load demo data
python manage.py seed_sample_data

# Start development server on port 8000
python manage.py runserver 0.0.0.0:8000

# ── Migrations ────────────────────────────────────────────────────

# Create migrations (all apps)
python manage.py makemigrations

# Create migrations for one app
python manage.py makemigrations leads

# Apply all pending migrations
python manage.py migrate

# Apply one app only
python manage.py migrate ledger

# Show migration status
python manage.py showmigrations

# ── Superuser & admin ─────────────────────────────────────────────

# Create Django superuser (interactive)
python manage.py createsuperuser

# Collect static files (fix unstyled Django admin)
python manage.py collectstatic --noinput

# ── Shell & database ──────────────────────────────────────────────

python manage.py shell
python manage.py dbshell

# ── Seed & maintenance ────────────────────────────────────────────

python manage.py seed_sample_data
python manage.py seed_permissions
python manage.py seed_products
python manage.py check
pytest
pytest --cov=apps
```

---



### React — with Docker

The `frontend` service is included in `docker compose up`. No separate `npm install` on the host.

```bash
# ── Run ───────────────────────────────────────────────────────────

# Start frontend with the full stack
docker compose up -d

# Start only frontend (requires django + postgres already running)
docker compose up -d frontend

# Rebuild frontend image (after Dockerfile / package.json changes)
docker compose up -d --build frontend

# Restart frontend container
docker compose restart frontend

# Follow frontend logs (live)
docker compose logs -f frontend

# Last 100 log lines
docker compose logs frontend --tail 100

# ── Commands inside container ─────────────────────────────────────

# Open a shell in the frontend container
docker compose exec frontend sh

# Run production build inside container
docker compose exec frontend npm run build

# ESLint (matches CI)
docker compose exec frontend npm run lint:eslint

# Marketing site — ESLint
docker compose exec marketing-site npm run lint:eslint
```

Open [http://localhost:3000](http://localhost:3000). API URL is set via `VITE_API_URL=http://localhost:8000/api/v1` in `docker-compose.yml`.

---



### React — without Docker (local)

Requires **Node.js 22.12+**.

```bash
cd frontend

# Copy env file (once)
cp .env.example .env          # Windows: copy .env.example .env

# Install dependencies (first time and after package.json changes)
npm install

# ── Run ───────────────────────────────────────────────────────────

# Development server (port 3000)
npm run dev

# Production build (output in dist/)
npm run build

# Preview production build locally
npm run preview

# Type-check only
npm run lint

# Remove build output
npm run clean
```

Ensure `frontend/.env` points at your API:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Start the Django API separately (`python manage.py runserver` or Docker `django` service).

---



### Adminer (database UI)

Adminer browses PostgreSQL in the browser. **Not** the LMS app login.

**Login at [http://localhost:8080](http://localhost:8080):**


| Field    | Value                                                  |
| -------- | ------------------------------------------------------ |
| System   | **PostgreSQL**                                         |
| Server   | `postgres` (Docker service name — **not** `localhost`) |
| Username | `lms_user`                                             |
| Password | `lms_password`                                         |
| Database | `lms`                                                  |


```bash
# ── Start / stop (from repo root) ─────────────────────────────────

# Start Adminer only (postgres must be running)
docker compose up -d adminer

# Start Adminer with full stack
docker compose up -d

# Stop Adminer only (other services keep running)
docker compose stop adminer

# Start again after stop
docker compose start adminer

# Restart Adminer
docker compose restart adminer

# Remove Adminer container (data in postgres volume is kept)
docker compose rm -sf adminer

# ── Logs & troubleshooting ────────────────────────────────────────

docker compose ps adminer
docker compose logs adminer --tail 100
```


| Problem           | Fix                                                      |
| ----------------- | -------------------------------------------------------- |
| Page not loading  | `docker compose up -d adminer` and wait a few seconds    |
| Could not connect | Server must be `postgres`, not `localhost`               |
| Login failed      | User `lms_user`, password `lms_password`, database `lms` |


**Local Django without Docker:** Adminer in Compose still works if you run `docker compose up -d postgres adminer` and point Django at `localhost:5432` — or use any desktop PostgreSQL client.

---



### PostgreSQL, Redis, Celery — with Docker

```bash
# ── PostgreSQL ────────────────────────────────────────────────────

# Start postgres only
docker compose up -d postgres

# Stop postgres
docker compose stop postgres

# PostgreSQL interactive shell
docker compose exec postgres psql -U lms_user -d lms

# Dump database to file
docker compose exec postgres pg_dump -U lms_user lms > backup.sql

# Restore from file
docker compose exec -T postgres psql -U lms_user -d lms < backup.sql

# ── Redis ─────────────────────────────────────────────────────────

# Start redis only
docker compose up -d redis

# Stop redis
docker compose stop redis

# Redis CLI ping
docker compose exec redis redis-cli ping

# Open Redis CLI
docker compose exec redis redis-cli

# ── Celery worker ─────────────────────────────────────────────────

# Start celery worker (included in full stack up)
docker compose up -d celery

# Stop celery worker
docker compose stop celery

# Restart celery worker
docker compose restart celery

# Follow celery worker logs
docker compose logs -f celery

# ── Celery beat (scheduled tasks) ─────────────────────────────────

# Start celery beat
docker compose up -d celery-beat

# Stop celery beat
docker compose stop celery-beat

# Follow celery beat logs
docker compose logs -f celery-beat

# Register notification beat tasks (run once per environment)
docker compose exec django python manage.py register_notification_beat_tasks

# ── Full stack control ────────────────────────────────────────────

# Start everything
docker compose up -d

# Stop everything (keep data volumes)
docker compose down

# Stop and delete all data (fresh DB)
docker compose down -v

# Remove old containers after service renames
docker compose up -d --remove-orphans

# Status of all services
docker compose ps

# Status including stopped containers
docker compose ps -a
```

---



### PostgreSQL, Redis, Celery — without Docker (local)

Run these in **separate terminals** from `backend/` with the virtualenv activated.

```bash
cd backend
# .venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate    # Linux / macOS

# ── API (required) ────────────────────────────────────────────────
python manage.py runserver 0.0.0.0:8000

# ── Celery worker (terminal 2) ────────────────────────────────────
celery -A config worker -l info -Q default,notifications,reports

# ── Celery beat (terminal 3) ──────────────────────────────────────
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler

# Register notification beat tasks (run once per environment, from backend/)
python manage.py register_notification_beat_tasks
```

PostgreSQL and Redis must be running as system services (or via Docker only for those two):

```bash
# Optional: run only DB + Redis in Docker while Django runs locally
docker compose up -d postgres redis adminer
```

Then set `DATABASE_URL` and `REDIS_URL` to `localhost` in `backend/.env`.

---



### Create superuser (Django admin)

Login uses **email** only. Seeded `admin@kubernitimoney.com` is for the **frontend/API** (RBAC), not Django `/admin/`.

```bash
# Docker (interactive)
docker compose exec -it django python manage.py createsuperuser

# Local (interactive)
cd backend && python manage.py createsuperuser
```

Non-interactive (Docker or local, from `backend/`):

```bash
python manage.py shell -c "
from apps.accounts.models import User
User.objects.create_superuser(
    email='you@company.com',
    password='ChangeMe123!',
    first_name='Admin',
    last_name='User',
)
"
```

---



### Seeded users (after `seed_sample_data`)


| Role                  | Email                           | Password    | Use            |
| --------------------- | ------------------------------- | ----------- | -------------- |
| Super Admin           | `pankaj@kubernitimoney.com`     | `Admin@123` | Frontend + API |
| Admin (RBAC)          | `admin@kubernitimoney.com`      | `Admin@123` | Frontend + API |
| Production Manager    | `production@kubernitimoney.com` | `Admin@123` | Frontend + API |
| Senior RM             | `rm1@kubernitimoney.com`        | `DeDust!23` | Frontend + API |
| Relationship Manager  | `rm2@kubernitimoney.com`        | `DeDust!23` | Frontend + API |
| Senior Credit Manager | `cm1@kubernitimoney.com`        | `DeDust!23` | Frontend + API |
| Credit Manager        | `cm2@kubernitimoney.com`        | `DeDust!23` | Frontend + API |
| Field Investigator    | `fi1@kubernitimoney.com`        | `DeDust!23` | Frontend + API |
| Account & Finance     | `account@kubernitimoney.com`    | `DeDust!23` | Frontend + API |
| Collection Manager    | `collection@kubernitimoney.com` | `DeDust!23` | Frontend + API |


> Passwords are only set when the account has no usable password yet. Existing passwords are left unchanged.



### Seed commands


| Command                  | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `seed_sample_data`       | All-in-one: permissions, workflow, branches, products, demo users |
| `seed_permissions`       | RBAC roles and permissions                                        |
| `seed_loan_workflow`     | Workflow states and transitions                                   |
| `seed_document_types`    | Document type master                                              |
| `seed_branches`          | Organization branches                                             |
| `seed_products`          | Loan products (PAYDAY, SALARY_ADVANCE)                            |
| `seed_dashboard_targets` | Officer/branch sanction targets                                   |




### Create a new Django app

New apps live under `backend/apps/` and must be added to `config/settings/base.py` → `INSTALLED_APPS`.

```bash
cd backend

# Scaffold inside apps/ (recommended)
mkdir -p apps/my_feature
python manage.py startapp my_feature apps/my_feature

# Then: add to INSTALLED_APPS, makemigrations, migrate
python manage.py makemigrations my_feature
python manage.py migrate
```

---



## Troubleshooting



### `service "django" is not running`


| Cause                          | Fix                                                                |
| ------------------------------ | ------------------------------------------------------------------ |
| Wrong directory (`cd backend`) | Run from repo root: `cd lms`                                       |
| Stack not started              | `docker compose up -d`                                             |
| Container crashed              | `docker compose ps -a` and `docker compose logs django --tail 100` |




### Port conflicts (Windows)


| Error                          | Fix                                                           |
| ------------------------------ | ------------------------------------------------------------- |
| `Bind for 0.0.0.0:6379 failed` | Stop other Redis; `docker compose down`                       |
| `Bind for 0.0.0.0:5432 failed` | Stop local PostgreSQL                                         |
| `Bind for 0.0.0.0:8000 failed` | Free port 8000; `docker compose down && docker compose up -d` |
| `Bind for 0.0.0.0:3000 failed` | Free port 3000 or stop other frontend                         |
| `Bind for 0.0.0.0:8080 failed` | Free port 8080 or `docker compose stop adminer`               |




### Django admin looks unstyled

```bash
# Docker
docker compose exec django python manage.py collectstatic --noinput

# Local
cd backend && python manage.py collectstatic --noinput
```

Hard-refresh the browser (Ctrl+F5) on [http://localhost:8000/admin/](http://localhost:8000/admin/).

### View logs


| Component   | Docker                               | Local                            |
| ----------- | ------------------------------------ | -------------------------------- |
| API         | `docker compose logs -f django`      | Terminal running `runserver`     |
| Frontend    | `docker compose logs -f frontend`    | Terminal running `npm run dev`   |
| Celery      | `docker compose logs -f celery`      | Terminal running `celery worker` |
| Celery beat | `docker compose logs -f celery-beat` | Terminal running `celery beat`   |
| Postgres    | `docker compose logs -f postgres`    | System / Docker logs             |
| Redis       | `docker compose logs -f redis`       | System / Docker logs             |
| Adminer     | `docker compose logs -f adminer`     | —                                |


**Note:** Inside Docker, the DB host is `postgres` in `backend/.env`. Do not use `localhost` there when using Compose. The browser calls the API at `http://localhost:8000`.

---



## API authentication

On **Windows PowerShell**, `curl` is an alias for `Invoke-WebRequest` and does **not** accept `-X`, `-H`, or `-d`. Use `**Invoke-RestMethod`** below, or call real curl as `**curl.exe`**.

### PowerShell

```powershell
# Login (returns access + refresh tokens)
$body = @{ email = "admin@kubernitimoney.com"; password = "Admin@123" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/login/" `
  -Method POST -ContentType "application/json" -Body $body
$login

$access = $login.data.tokens.access
$refresh = $login.data.tokens.refresh

# Authenticated request (requires dashboard.view permission or superuser)
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/dashboard/" `
  -Headers @{ Authorization = "Bearer $access" }

# Refresh token
$refreshBody = @{ refresh = $refresh } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/refresh/" `
  -Method POST -ContentType "application/json" -Body $refreshBody

# Logout
$logoutBody = @{ refresh = $refresh } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/logout/" `
  -Method POST -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $access" } -Body $logoutBody
```



### Bash / Git Bash / WSL (`curl`)

```bash
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@kubernitimoney.com", "password": "Admin@123"}'

curl http://localhost:8000/api/v1/dashboard/ \
  -H "Authorization: Bearer <access_token>"
```



### Windows: real curl (`curl.exe`)

```powershell
curl.exe -X POST http://localhost:8000/api/v1/auth/login/ `
  -H "Content-Type: application/json" `
  -d "{\"email\": \"admin@kubernitimoney.com\", \"password\": \"Admin@123\"}"
```

---



## Architecture

```
View (thin) → Service (business rules) → Selector (reads) → ORM
```

- **ViewSets**: CRUD resources (`Customer`, `Loan`, `User`, `Role`, `Document`)
- **APIViews**: workflows (`approve`, `reject`, `disburse`, `dashboard`, `export`)



## Design decisions (summary)



### Base models


| Model              | Use                                                 |
| ------------------ | --------------------------------------------------- |
| `TimeStampedModel` | All persisted entities                              |
| `AuditModel`       | Staff-managed records (`created_by` / `updated_by`) |
| `SoftDeleteModel`  | Business entities only — not audit/history tables   |




### UUID primary keys

- **Security**: no sequential ID enumeration
- **API**: opaque, stable identifiers in URLs
- **Distributed**: generate IDs without DB coordination



### RBAC

Permissions are `module` + `action` → auto `code` (e.g. `loan.approve`). Cached in Redis at `user:{id}:permissions`. Invalidated on role/permission changes via signals.

### Response envelope

```json
{ "success": true, "message": "", "data": {} }
{ "success": false, "message": "", "errors": {} }
```

Global via `custom_exception_handler` + `ResponseWrapperMiddleware`.

### Query optimization (where used)


| Technique          | Location                | Why                     |
| ------------------ | ----------------------- | ----------------------- |
| `select_related`   | Loan list, audit logs   | FK joins in one query   |
| `prefetch_related` | Loan detail, roles      | Reverse FK / M2M        |
| `only` / `defer`   | Customer list           | Smaller rows for tables |
| `bulk_create`      | EMI schedule generation | Single INSERT batch     |




## App documentation

Each app has a `README.md` with schema, APIs, permission matrix, and flows where present:

- [apps/core](backend/apps/core/README.md) · [apps/accounts](backend/apps/accounts/README.md)
- [apps/customers](backend/apps/customers/README.md) · [apps/leads](backend/apps/leads/README.md)
- [apps/loans](backend/apps/loans/README.md) · [apps/workflow](backend/apps/workflow/README.md)
- [apps/documents](backend/apps/documents/README.md) · [apps/activities](backend/apps/activities/README.md)
- [apps/audit_logs](backend/apps/audit_logs/README.md) · [apps/notifications](backend/apps/notifications/README.md)
- [apps/dashboard](backend/apps/dashboard/README.md) · [apps/reports](backend/apps/reports/README.md)

Domain apps (CRM/LMS split): `organization`, `products`, `applications`, `underwriting`, `ledger`, `repayments`, `collections` — see [TABLE.md](TABLE.md) for full schema.

## Linting & code quality

| Stack                                | Tool                                                  | Config                         |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------ |
| Backend (Python)                     | [Ruff](https://docs.astral.sh/ruff/)                  | `backend/pyproject.toml`       |
| Frontend & marketing site (TS/React) | [ESLint](https://eslint.org/) 9 + `typescript-eslint` | `eslint.config.js` in each app |

### Lint all — backend, frontend, marketing-site

Run from the **repo root** before pushing (same checks as CI).

**Local (host):**

```bash
# Backend — Ruff check + format check
cd backend && pip install -r requirements/dev.txt && ruff check . && ruff format --check .

# Frontend — ESLint (CI uses lint:eslint; lint also runs tsc when types are clean)
cd frontend && npm run lint:eslint

# Marketing site — ESLint
cd marketing-site && npm run lint:eslint
```

**One-liner (local, repo root):**

```bash
cd backend && ruff check . && ruff format --check . && cd ../frontend && npm run lint:eslint && cd ../marketing-site && npm run lint:eslint
```

**Docker** (stack running: `docker compose up -d`):

```bash
# Backend — Ruff is not in the production image; install once per container session
docker compose exec django sh -c "pip install 'ruff==0.15.20' && ruff check . && ruff format --check ."

# Frontend
docker compose exec frontend npm run lint:eslint

# Marketing site
docker compose exec marketing-site npm run lint:eslint
```

**Auto-fix (local):**

```bash
cd backend && ruff check . --fix && ruff format .
cd frontend && npm run lint:fix
cd marketing-site && npm run lint:fix
```

### Pre-commit

Config: [`.pre-commit-config.yaml`](.pre-commit-config.yaml)

Runs **backend (Ruff)**, **frontend (ESLint)**, **marketing-site (ESLint)**, plus trailing whitespace, EOF, YAML, and large-file checks.

**Install once** (Python 3.12+ and Node.js on the host; `npm install` in `frontend/` and `marketing-site/`):

```bash
python -m pip install pre-commit
python -m pre_commit install
```

On Windows, `pre-commit` may not be on PATH after a user-level pip install. `python -m pre_commit` always works.

**Run all hooks on the whole repo** (recommended before push):

```bash
python -m pre_commit run --all-files
```

**Run a single hook:**

```bash
python -m pre_commit run ruff --all-files
python -m pre_commit run ruff-format --all-files
python -m pre_commit run eslint-frontend --all-files
python -m pre_commit run eslint-marketing-site --all-files
```

Hooks also run automatically on `git commit` after `python -m pre_commit install`.

### CI (GitHub Actions)

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

On push/PR to `development`, `testing`, `staging`, `production`, `main`, or `master`:

- **Backend** — Ruff check + format check; pytest
- **Frontend** — ESLint; production build
- **Marketing site** — ESLint; production build
- **PR into `testing`, or push to `testing`** — SSH deploy to the test VPS after all checks pass

**Why deploy feels slow:** GitHub runs 6 jobs first (~5–15 min), then the VPS builds 3 Docker images (`django`, `frontend`, `marketing`) with `npm ci`, Vite, and `pip install`. First deploy or dependency changes take longest; later deploys reuse Docker layer cache.

**Deploy on VPS** (also run manually over SSH):

```bash
export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
cd ~/lms && git fetch origin testing && git checkout testing && git reset --hard origin/testing
docker compose -f docker-compose.prod.yml build --parallel django frontend marketing
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

`celery` and `celery-beat` reuse the same `lms-backend:latest` image as `django` (one backend build, not three).

---



## Testing

```bash
cd backend
pip install -r requirements/test.txt
pytest --cov=apps
```



## Production deployment

1. Build image from `docker/Dockerfile` (Gunicorn, non-root user).
2. Run `migrate` as init job; never in running pod without coordination.
3. Scale `django` behind load balancer; sticky sessions not required (JWT).
4. Run `celery` and `celery-beat` as separate deployments.
5. Use managed PostgreSQL + Redis; set `DATABASE_URL`, `REDIS_URL` via secrets.
6. Mount object storage for `media/` (swap `LocalStorageBackend` for S3).
7. Enable `DOCUMENT_VIRUS_SCAN_ENABLED` with ClamAV sidecar.



## Additional documentation


| Document                                               | Description                                    |
| ------------------------------------------------------ | ---------------------------------------------- |
| [backend/POSTMAN_README.md](backend/POSTMAN_README.md) | Postman setup, auth flow, all endpoints        |
| [backend/DEPLOY_README.md](backend/DEPLOY_README.md)   | Deployment guide (Docker, staging, production) |
| [backend/postman/](backend/postman/)                   | Importable Postman collection + environment    |
| [frontend/README.md](frontend/README.md)               | Frontend features and structure                |




## License

Proprietary — internal LMS project.
