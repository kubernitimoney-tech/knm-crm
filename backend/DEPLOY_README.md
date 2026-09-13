# LMS Backend — Deployment Guide

Deployment instructions for **local Docker**, **staging**, and **production**. For day-to-day development, see [README.md](README.md).

---

## 1. Architecture overview

```
                    ┌─────────────┐
                    │ Load balancer│
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Django  │ │  Celery  │ │Celery Beat│
        │ Gunicorn │ │  worker  │ │ scheduler │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        ┌──────────┐           ┌──────────┐
        │PostgreSQL│           │  Redis   │
        └──────────┘           └──────────┘
```

| Service | Role |
|---------|------|
| **django** | HTTP API (Gunicorn), migrations on start |
| **postgres** | Primary database |
| **redis** | Cache, Celery broker, JWT blacklist backing |
| **celery** | Async tasks (notifications, reports) |
| **celery-beat** | Scheduled tasks |
| **adminer** | Optional DB UI (dev only — disable in production) |

---

## 2. Prerequisites

| Tool | Version |
|------|---------|
| Docker | 24+ |
| Docker Compose | v2+ |
| Git | Any recent |

**Production also needs:**

- Domain + TLS certificate (or load balancer TLS termination)
- Secrets store (AWS Secrets Manager, Vault, K8s secrets, etc.)
- Managed PostgreSQL and Redis (recommended)

---

## 3. Local deployment (Docker Compose)

### 3.1 First-time setup

```bash
cd /path/to/backend
cp .env.example .env
# Edit .env: SECRET_KEY, passwords (optional for local)

docker compose up -d --build
```

Wait until `django` is healthy:

```bash
docker compose ps
docker compose logs django --tail 30
```

### 3.2 Database & seed data

Migrations run on container start. Run seeds manually.

**Option A — full demo seed (recommended for local):** creates all master data **and** sample users/leads.

```bash
docker compose exec django python manage.py seed_sample_data
```

**Option B — master data only (no demo users/leads).** Run the complete set — all six are required for core flows (e.g. `seed_products` is needed for lead → application conversion):

```bash
docker compose exec django python manage.py seed_permissions
docker compose exec django python manage.py seed_loan_workflow
docker compose exec django python manage.py seed_document_types
docker compose exec django python manage.py seed_branches
docker compose exec django python manage.py seed_products
docker compose exec django python manage.py seed_dashboard_targets
```

> ⚠️ Do **not** seed only permissions. Without `seed_products` (and the workflow), marking a call "Interested" will silently fail to create the loan application and the lead stays stuck at "Interested".

### 3.3 Create admin user

```bash
docker compose exec django python manage.py createsuperuser
```

### 3.4 Verify deployment

| Check | Command / URL |
|-------|----------------|
| Health | `curl http://localhost:8000/api/v1/health/` |
| Admin | http://localhost:8000/admin/ |
| API login | See [POSTMAN_README.md](POSTMAN_README.md) |

### 3.5 Stop / reset

```bash
# Stop containers (keep data)
docker compose down

# Stop and remove volumes (DESTROYS DB)
docker compose down -v
```

---

## 4. Environment variables

Copy from `.env.example`. **Never commit `.env` to git.**

| Variable | Required | Description |
|----------|----------|-------------|
| `DJANGO_SETTINGS_MODULE` | Yes | `config.settings.local` / `staging` / `production` |
| `SECRET_KEY` | Yes | Long random string (production: 50+ chars) |
| `DEBUG` | Yes | `False` in production |
| `ALLOWED_HOSTS` | Yes | Comma-separated domains |
| `DATABASE_URL` | Yes | `postgres://user:pass@host:5432/dbname` |
| `REDIS_URL` | Yes | `redis://host:6379/0` |
| `CELERY_BROKER_URL` | Yes | Redis DB index 1 recommended |
| `CELERY_RESULT_BACKEND` | Yes | Redis DB index 2 recommended |
| `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` | No | Default 30 |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | No | Default 7 |
| `CORS_ALLOWED_ORIGINS` | Prod | Frontend URLs |
| `SECURE_SSL_REDIRECT` | Prod | `True` behind HTTPS |
| `MEDIA_ROOT` | No | `/app/media` in Docker |
| `DOCUMENT_VIRUS_SCAN_ENABLED` | No | `True` when scanner integrated |

### Docker Compose overrides

Use the repo root `docker-compose.yml` (not a file under `backend/`). It sets for app containers:

- `DATABASE_URL` → host `postgres`
- `REDIS_URL` → host `redis`

Do **not** use `localhost` for DB/Redis inside containers.

### Host-specific `DATABASE_URL`

| Where Django runs | DB host in URL |
|-------------------|----------------|
| Inside Docker | `postgres` |
| On host machine | `localhost` |

---

## 5. Staging deployment

### 5.1 Settings module

```bash
export DJANGO_SETTINGS_MODULE=config.settings.staging
```

Or in `.env`:

```env
DJANGO_SETTINGS_MODULE=config.settings.staging
DEBUG=False
ALLOWED_HOSTS=staging-api.yourdomain.com
```

### 5.2 Build & run

```bash
docker compose build
docker compose up -d
```

Use staging-specific secrets for `DATABASE_URL` and `REDIS_URL` (managed services).

### 5.3 Post-deploy commands

```bash
docker compose exec django python manage.py migrate --noinput
docker compose exec django python manage.py collectstatic --noinput
docker compose exec django python manage.py seed_permissions
docker compose exec django python manage.py seed_loan_workflow
docker compose exec django python manage.py seed_document_types
docker compose exec django python manage.py seed_branches
docker compose exec django python manage.py seed_products
docker compose exec django python manage.py seed_dashboard_targets
```

---

## 5A. Production on a single VPS (Docker Compose + Caddy)

This is the flow used for the live **test / staging** deployment on the VPS. The whole
stack (Django, Postgres, Redis, Celery, both frontends, and a Caddy reverse proxy that
provisions HTTPS automatically) runs from `docker-compose.prod.yml` at the **repo root**.

Domain mapping (test environment):

| URL | Serves |
|-----|--------|
| `test.kubernitimoney.com` | LMS app (frontend) |
| `api-test.kubernitimoney.com` | Django API (+ `/media/`) |
| `kubernitimoney.com` | Marketing site (SPA) |
| `www.kubernitimoney.com` | Permanent redirect to apex |

### 5A.1 First-time setup on the server

```bash
git clone git@github.com:<org>/<repo>.git lms
cd lms

# Create the production env file (secrets injected automatically)
cp backend/.env.production.example backend/.env
# then edit backend/.env: set SECRET_KEY, FIELD_ENCRYPTION_KEY (generate below)
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # FIELD_ENCRYPTION_KEY
```

`ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` are already set for the
test domains in `.env.production.example`. Postgres/Redis run on the internal Docker network
(no public ports), so the default DB credentials are acceptable for the test env.

### 5A.2 Build & launch

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Migrations and `collectstatic` run automatically on the `django` container start. Caddy
fetches HTTPS certificates automatically once DNS points at the server — watch it with
`docker compose -f docker-compose.prod.yml logs -f caddy`.

### 5A.3 Seed master data (REQUIRED) + admin user

```bash
# Full master data (all six are required — seed_products enables lead conversion)
docker compose -f docker-compose.prod.yml exec django python manage.py seed_permissions
docker compose -f docker-compose.prod.yml exec django python manage.py seed_loan_workflow
docker compose -f docker-compose.prod.yml exec django python manage.py seed_document_types
docker compose -f docker-compose.prod.yml exec django python manage.py seed_branches
docker compose -f docker-compose.prod.yml exec django python manage.py seed_products
docker compose -f docker-compose.prod.yml exec django python manage.py seed_dashboard_targets

# Admin login
docker compose -f docker-compose.prod.yml exec -it django python manage.py createsuperuser
```

> The demo bundle `seed_sample_data` also works and additionally creates sample users/leads;
> prefer the individual master seeds above on a real (non-demo) environment.

### 5A.4 Redeploy (pull latest code)

```bash
cd ~/lms
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

> This is exactly what the CI/CD `deploy-test` job automates on push to the `testing` branch.

### 5A.5 SMTP (for sanction / disbursal emails)

Transactional emails (sanction approved, disbursal sheet sent) are sent by the **celery**
worker. Set SMTP creds in `backend/.env` or they fall back to the console backend (printed to
worker logs):

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_HOST_USER=<address>
EMAIL_HOST_PASSWORD=<app password>
DEFAULT_FROM_EMAIL=Kuberniti Money <no-reply@kubernitimoney.com>
```

Verify: `docker compose -f docker-compose.prod.yml exec django python manage.py send_test_email you@example.com`

---

## 6. Production deployment

### 6.1 Checklist

- [ ] `DEBUG=False`
- [ ] Strong `SECRET_KEY` from secrets manager
- [ ] `ALLOWED_HOSTS` set to real domains
- [ ] `DJANGO_SETTINGS_MODULE=config.settings.production`
- [ ] HTTPS (`SECURE_SSL_REDIRECT=True`, TLS at load balancer)
- [ ] Managed PostgreSQL (backups enabled)
- [ ] Managed Redis (persistence if required)
- [ ] Remove or disable **adminer** service
- [ ] Media files on S3 (update document storage backend)
- [ ] Sentry DSN configured (optional, in `requirements/production.txt`)
- [ ] Log aggregation (CloudWatch, Datadog, etc.)
- [ ] Run Celery worker + beat as separate replicas

### 6.2 Production `.env` example

```env
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<from-secrets-manager>
DEBUG=False
ALLOWED_HOSTS=api.yourdomain.com
DATABASE_URL=postgres://user:pass@db-host:5432/lms_prod
REDIS_URL=redis://redis-host:6379/0
CELERY_BROKER_URL=redis://redis-host:6379/1
CELERY_RESULT_BACKEND=redis://redis-host:6379/2
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
SECURE_SSL_REDIRECT=True
```

### 6.3 Docker image build (CI/CD)

```bash
docker build -f docker/Dockerfile -t lms-api:${VERSION} .
docker tag lms-api:${VERSION} registry.example.com/lms-api:${VERSION}
docker push registry.example.com/lms-api:${VERSION}
```

### 6.4 Migrations (production-safe)

Run migrations as a **one-off job**, not on every pod start in multi-replica setups:

```bash
docker compose run --rm django python manage.py migrate --noinput
```

For Kubernetes:

```bash
kubectl run lms-migrate --rm -it --image=registry.example.com/lms-api:latest \
  -- python manage.py migrate --noinput
```

### 6.5 Static files

WhiteNoise serves static files from the app container. On deploy:

```bash
python manage.py collectstatic --noinput
```

Included in Docker startup command for single-node Compose; run explicitly in K8s init job if needed.

### 6.6 Gunicorn tuning (production)

Default Dockerfile CMD:

```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --threads 2 --timeout 120
```

Adjust workers: `(2 × CPU cores) + 1`. Set `--timeout` above slow report endpoints.

### 6.7 Celery

```bash
# Worker
celery -A config worker -l info -Q default,notifications,reports

# Beat (single instance only)
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

Scale workers horizontally; run **exactly one** beat scheduler.

---

## 7. Kubernetes (outline)

Typical manifests:

| Resource | Replicas | Notes |
|----------|----------|-------|
| Deployment `lms-api` | 2+ | Gunicorn, no migrate in CMD |
| Deployment `lms-celery-worker` | 2+ | Same image, celery command |
| Deployment `lms-celery-beat` | 1 | Single replica |
| Job `lms-migrate` | On release | `manage.py migrate` |
| Service | ClusterIP / LB | Port 8000 |
| Ingress | 1 | TLS termination |

Secrets: mount `DATABASE_URL`, `SECRET_KEY`, `REDIS_URL` as env from Secret.

---

## 8. Operations commands

### Logs

```bash
docker compose logs -f django
docker compose logs -f celery
docker compose logs django --tail 100
```

### Shell

```bash
docker compose exec django python manage.py shell
```

### Restart services

```bash
docker compose restart django
docker compose restart celery celery-beat
```

### Database backup (Compose Postgres)

```bash
docker compose exec postgres pg_dump -U lms_user lms > backup_$(date +%Y%m%d).sql
```

### Restore

```bash
cat backup.sql | docker compose exec -T postgres psql -U lms_user -d lms
```

---

## 9. Health checks & monitoring

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health/` | Liveness (Docker healthcheck uses this) |

Monitor additionally:

- Postgres connections / disk
- Redis memory
- Celery queue depth
- HTTP 5xx rate
- Gunicorn worker restarts

---

## 10. Rollback

1. Deploy previous image tag.
2. If migrations were applied, restore DB from backup or run backward migrations only if provided.
3. Restart `django`, `celery`, `celery-beat`.

---

## 11. Security notes

- Rotate `SECRET_KEY` and DB passwords on compromise.
- JWT refresh blacklisting requires Redis availability.
- Restrict Postgres/Redis ports — not public on internet.
- Use WAF / rate limiting on auth endpoints in production.
- Keep `requirements/*.txt` updated (`pip audit` / Dependabot).

---

## 12. Related docs

| Document | Content |
|----------|---------|
| [README.md](README.md) | Development quick start |
| [POSTMAN_README.md](POSTMAN_README.md) | API testing with Postman |
| `apps/*/README.md` | Per-module architecture |

---

## 13. Quick command reference

```bash
# Build & start
docker compose up -d --build

# Status
docker compose ps

# Migrate
docker compose exec django python manage.py migrate

# Seeds — full master data (all six required; seed_products enables lead conversion)
docker compose exec django python manage.py seed_permissions
docker compose exec django python manage.py seed_loan_workflow
docker compose exec django python manage.py seed_document_types
docker compose exec django python manage.py seed_branches
docker compose exec django python manage.py seed_products
docker compose exec django python manage.py seed_dashboard_targets
# ...or the demo bundle (master data + sample users/leads):
docker compose exec django python manage.py seed_sample_data

# Superuser
docker compose exec django python manage.py createsuperuser

# Static
docker compose exec django python manage.py collectstatic --noinput

# Stop
docker compose down
```
