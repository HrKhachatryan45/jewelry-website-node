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

Virtual try-on runs live in the browser using MediaPipe. The existing renderer remains available; try the opt-in Tasks Vision + Three.js renderer by opening a product URL with `?tryon=v2`. Camera frames stay in the browser and are not uploaded. The v2 runtime assets are served locally.

After installing server dependencies, the postinstall scripts copy the MediaPipe Tasks bundle/WASM and Three.js browser modules into `client/`. The face and hand task files are not distributed in the npm package; download them into `server/assets/mediapipe/`:

- [Face landmarker task](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task)
- [Hand landmarker task](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task)

Then run `npm --prefix server run tryon:copy-mediapipe`. The app serves the files at `/mediapipe/face_landmarker.task` and `/mediapipe/hand_landmarker.task`. For local development, use `?tryon=v2&debug=1` to display tracker landmarks and FPS. Product GLB models continue to use the existing `model3d` field; PNG-only products are shown as a basic preview, and products without an asset use a procedural category preview.

The Diamond Earrings 7512 product uses a single-earring GLB stored at `server/uploads/models/huggie_earring_single.glb`; its adjacent JSON calibration file is stored alongside it. The product database record points to `models/huggie_earring_single.glb`, and the API serves the model and calibration at `/uploads/models/...`. `scale` retains the raw-scale convention used by v2, while `normalizedScale` is a multiplier for the normalized model in the regular try-on.

To use an optional local environment map, place `jewelry-studio.hdr` in `client/hdri/` and set `HDRI_URL` in `client/js/ar/v2/anchors.js` to `/hdri/jewelry-studio.hdr`. By default it uses a procedural room environment without requesting a missing HDR file. Product anchor metadata is optional; pass a product's `tryOnMetadataUrl` to load its JSON sidecar.

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
| `npm --prefix server run tryon:copy-mediapipe` | Copy local MediaPipe runtime files and any downloaded `.task` models |
| `npm --prefix server run tryon:copy-vendor` | Copy local Three.js browser modules |

## Data

Seed data is exported from the original Django database to `server/prisma/seed-data.json` (see `server/scripts/export_django.py`). Uploaded images are copied from `../media` into `server/uploads` by `server/scripts/sync-uploads.js` — `server/uploads` itself is gitignored.

The admin product editor supports up to five product images per item; drag the image cards to reorder them, with the first image used as the cover. It also accepts `.glb` model uploads up to 80 MB, while product images remain limited to 12 MB each. SortableJS is served directly from the server dependency at `/vendor/sortablejs/Sortable.min.js`.

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
