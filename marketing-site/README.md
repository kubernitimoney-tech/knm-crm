# Kuberniti Money — Marketing Website

Customer-facing marketing SPA for [Kuberniti Money](https://www.kubernitimoney.com). Informs visitors about payday/short-term personal loans, builds trust, and drives loan applications via the existing Django LMS API.

**Tagline:** Quick loans. Clear terms. Trusted support.

## Tech stack

- React 18+ · TypeScript · Vite
- React Router · Tailwind CSS (Kuberniti brand tokens)
- React Hook Form + Zod · Axios

## Local development

### Prerequisites

- Node.js 22.12+
- Django API running on port 8000 (see repo root `backend/`)

### Setup

```bash
cd marketing-site
cp .env.example .env
npm install
npm run dev
```

The site runs at **http://localhost:3001** (LMS employee app stays on port 3000).

### Environment variables

| Variable | Dev default | Description |
|----------|-------------|-------------|
| `VITE_API_URL` | `http://localhost:8000/api/v1` | Django API base URL |
| `VITE_BRAND_NAME` | `Kuberniti Money` | Brand display name |
| `VITE_SUPPORT_EMAIL` | `support@kubernitimoney.com` | Support email |
| `VITE_SUPPORT_PHONE` | `+91-1800-XXX-XXXX` | Support phone |
| `VITE_SITE_URL` | `http://localhost:3001` | Public site URL |

### Production

```env
VITE_API_URL=https://api.kubernitimoney.com/api/v1
VITE_SITE_URL=https://www.kubernitimoney.com
```

Build for production:

```bash
npm run build
npm run preview
```

## CORS configuration

Add the marketing site origin to Django `CORS_ALLOWED_ORIGINS`:

**Development:** `http://localhost:3001`, `http://127.0.0.1:3001`

**Production:** `https://www.kubernitimoney.com`

Update `backend/.env` or `backend/config/settings/local.py` and `docker-compose.yml` as needed.

## API integration

### Submit lead (required)

```
POST {VITE_API_URL}/leads/intake/
Content-Type: application/json
```

No `Authorization` header. Always send `"source_slug": "website"`.

**Minimum payload:**

```json
{
  "first_name": "Asha",
  "last_name": "Verma",
  "email": "asha@example.com",
  "mobile_number": "9876543210",
  "required_amount": "25000.00",
  "source_slug": "website"
}
```

**Success (201):**

```json
{
  "success": true,
  "message": "Lead submitted successfully",
  "data": {
    "lead_id": "000123",
    "status_display": "Pending Contact",
    "category_display": "Fresh"
  }
}
```

**Rate limit:** 2 leads per customer per hour → HTTP 429.

### List sources (optional)

```
GET {VITE_API_URL}/leads/intake/sources/
```

Implementation: `src/lib/leadsApi.ts` · Types: `src/types/lead.ts`

## Pages

| Route | Page |
|-------|------|
| `/` | Landing — hero, how it works, highlights, testimonials teaser, FAQ teaser |
| `/apply` | 4-step loan application wizard |
| `/testimonials` | Customer stories |
| `/faq` | FAQ accordion |
| `/about` | About us |
| `/contact` | Contact information |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

## Project structure

```
marketing-site/
├── src/
│   ├── components/   # Header, Footer, Chatbot, Hero, ApplyForm, etc.
│   ├── pages/        # Route pages
│   ├── lib/          # leadsApi.ts, brand.ts, applyFormSchema.ts
│   ├── types/        # lead.ts
│   ├── data/         # testimonials, FAQ content
│   └── styles/       # Brand tokens (Tailwind @theme)
├── .env.example
├── tailwind.config.ts
└── README.md
```

## Out of scope

- Customer login / loan tracking / payments
- Employee LMS features (see `frontend/` on port 3000)

## Docker (optional)

Included in root `docker-compose.yml`. From the repo root:

```bash
docker compose up -d --build
```

Marketing site: **http://localhost:3001** (LMS UI remains on port 3000).

The `marketing-site` service mounts source for hot reload, uses a dedicated `node_modules` volume, and sets `VITE_*` env vars for browser-side API calls to `http://localhost:8000/api/v1`.
