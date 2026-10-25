# Luxe Jewelry — Node.js + Vanilla JS

Decoupled rewrite of the Django project in this repository (`bakery` / `bakery_app`).

- **`/client`** — vanilla HTML/CSS/JS front end. No build step, no framework.
- **`/server`** — Node.js + Express REST API, Prisma ORM on PostgreSQL, JWT + bcrypt auth, multer uploads.

See [`../MIGRATION.md`](../MIGRATION.md) for the full mapping from the Django project and the API surface.

## Requirements

- Node.js 20+
- PostgreSQL running on `localhost:5432`

## Quick start

```bash
npm install      # runs `setup`: prisma db push, seed, copy media -> server/uploads
npm run dev      # http://localhost:4000
```

`npm run dev` starts the API server, which also serves the static client and uploaded media, so the whole site is available at **http://localhost:4000**.

Virtual try-on runs live in the browser using MediaPipe. It requests camera access when the user opens the feature, tracks the selected category's body landmarks, and draws the product's transparent PNG on the live preview. Camera frames stay in the browser and are not sent to the server. The MediaPipe browser libraries load from jsDelivr, so the feature needs camera permission, HTTPS or localhost, and an internet connection.

The admin SPA is at **http://localhost:4000/admin/** (default login `admin` / `admin123`, override with `SEED_ADMIN_PASSWORD`).

## Configuration

Copy `server/.env.example` to `server/.env` and fill in the real values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (Prisma) |
| `JWT_SECRET` | Signs the httpOnly auth cookie `luxe_token` |
| `SEED_ADMIN_PASSWORD` | Initial admin password on seed |
| `CONTACT_PHONE`, `CONTACT_EMAIL`, … | Public contact block in the footer |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Order/contact emails (skipped if unset) |
| `IDRAM_MERCHANT_ID`, `IDRAM_ACCOUNT`, `IDRAM_SECRET`, `IDRAM_PRECHECK` | Idram payments |
| `ARCA_LOGIN`, `ARCA_PASSWORD` | ArCa card payments |
| `HOST_URL` | Absolute base URL used by sitemap.xml |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + client on `:4000` (server auto-reloads) |
| `npm run setup` | `prisma db push` + seed + copy media into `server/uploads` |
| `npm run db:seed` | Re-import seed data |
| `npm run db:reset` | Drop, recreate and reseed the database |
| `npm start` | Production start (`NODE_ENV=production npm start`) |

## Data

Seed data is exported from the original Django database to `server/prisma/seed-data.json` (see `server/scripts/export_django.py`). Uploaded images are copied from `../media` into `server/uploads` by `server/scripts/sync-uploads.js` — `server/uploads` itself is gitignored.

## API

All endpoints are prefixed `/api`:

- `GET /api/home`, `/api/categories`, `/api/products`, `/api/products/:slug`, `/api/reviews`, `/api/about`, `/api/config`
- `POST /api/contact`, `/api/reviews`, `/api/checkout`, `/api/bespoke`
- `POST /api/cart`, `/api/cart/add/:pk`, `/api/cart/update`, `/api/cart/remove`, `/api/cart/clear`
- `POST /api/auth/login`, `/api/auth/logout`, `GET /api/auth/me`
- `POST /api/payments/idram/init`, `/api/payments/idram/verify`, `/api/payments/arca/*`
- `GET /api/admin/...` (JWT cookie + `requireAdmin`)
- `GET /sitemap.xml`, `GET /robots.txt`

Errors are JSON `{ "error": "..." }`. Prisma errors map to sensible statuses (`P2025` → 404, `P2002` → 409, `P2003` → 400).
