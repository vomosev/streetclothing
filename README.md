# STREET/PLATINUM

A streetwear clothing store with a black-and-platinum visual identity. The storefront is a **Next.js (App Router)** application living at the repository root; the API is an **Express + MySQL** service under `server/`, including the pre-built multi-provider payments module (`server/payments/`) supporting **Flutterwave, PayPal, Paystack and Stripe** in **USD**.

---

## Table of contents

1. [What the store does](#what-the-store-does)
2. [Design system](#design-system)
3. [Repository structure](#repository-structure)
4. [Prerequisites](#prerequisites)
5. [Database setup](#database-setup)
6. [Environment variables](#environment-variables)
7. [Running locally](#running-locally)
8. [Running in production](#running-in-production)
9. [TLS in process](#tls-in-process)
10. [REST API reference](#rest-api-reference)
11. [Payments](#payments)
12. [Demo credentials](#demo-credentials)
13. [Troubleshooting](#troubleshooting)

---

## What the store does

STREET/PLATINUM sells limited streetwear drops — tees, hoodies, outerwear, pants and accessories — plus a **Street Pass** membership.

Shopper-facing features:

- **Catalogue** (`/shop`) with category pill filters, debounced search and explicit loading / error / empty states.
- **Product detail** (`/product/[slug]`) with size selection, stock-aware size buttons, quantity stepper and an add-to-bag flow.
- **Cart** (`/cart`) persisted in `localStorage`; checkout posts only `{ productId, sizeLabel, quantity }` — **the server recomputes every price and the total** from the `products` table.
- **Accounts** (`/signup`, `/login`, `/account`) using cookie sessions with bcrypt-hashed passwords, plus order history.
- **Membership & one-off products** (`/pricing`) with a pay button per configured provider.
- **Billing** (`/billing`, `/billing/success`, `/billing/cancel`) for subscription status, cancellation, provider-hosted management and payment return handling.

Every data-reading view ships a loading skeleton, an error state with retry and an empty state — the frontend degrades gracefully when the API is unreachable.

---

## Design system

All styling lives in **one** global stylesheet, `app/globals.css`, imported exactly once from `app/layout.jsx`. No Tailwind, no CSS modules, no CSS-in-JS, no inline style objects.

### Token layer (`:root`)

| Group | Tokens |
| --- | --- |
| Colour | `--color-bg` (near-black), `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent` (platinum), `--color-accent-hover`, `--color-success`, `--color-warning`, `--color-danger` |
| Spacing | `--space-1` … `--space-16` on a 4px scale (4/8/12/16/24/32/48/64 …) |
| Type | `--text-xs` … `--text-4xl`, each with a matching line-height |
| Radii | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill` |
| Elevation | `--shadow-1`, `--shadow-2`, `--shadow-3` |
| Controls | `--control-sm`, `--control-md`, `--control-lg` |
| Motion | transition duration token (all transitions < 200ms, property-specific) |
| Layering | `--z-dropdown`, `--z-sticky`, `--z-overlay`, `--z-modal`, `--z-toast` |

### Conventions

- Layout spacing uses **Flex/Grid `gap` only** — never margins on children, never spacer divs or `<br>`.
- Mobile-first, widening at **640 / 768 / 1024px**; no horizontal scroll at 360px.
- Interactive elements keep a **≥ 44 × 44px hit area** through padding, with visible `:hover`, `:focus-visible`, `:active` and `:disabled` states.
- `overflow-wrap: break-word` is applied only through `.user-text`, scoped to containers holding user-supplied strings.
- Product imagery is **locally generated inline SVG / CSS gradient artwork** (`components/ProductArtwork.jsx`) inside an aspect-ratio box — no remote or hotlinked images, no layout shift.
- A `@media (prefers-reduced-motion: reduce)` block closes the stylesheet.

---

## Repository structure

```
.
├── package.json              Single root manifest: frontend + backend deps
├── next.config.js            reactStrictMode, NEXT_PUBLIC_API_BASE_URL fallback
├── ecosystem.config.js       PM2 app definition (streetclothing, port 4117)
├── START.sh                  Bash launcher for the API (nohup + logs/)
├── schema.sql                MySQL 8 schema + 12 seeded products + demo user
├── .env.example              Every environment variable, placeholders only
├── .gitignore
│
├── app/                      Next.js App Router
│   ├── globals.css           THE single global stylesheet (tokens + components)
│   ├── layout.jsx            Root layout → AuthProvider → CartProvider → SiteShell
│   ├── page.jsx              Home / hero / featured drop
│   ├── not-found.jsx         404
│   ├── shop/page.jsx
│   ├── product/[slug]/page.jsx
│   ├── cart/page.jsx
│   ├── login/page.jsx
│   ├── signup/page.jsx
│   ├── account/page.jsx
│   ├── pricing/page.jsx      Plans + products + provider pay buttons
│   └── billing/
│       ├── page.jsx          Subscription, cancel, manage
│       ├── success/page.jsx  Reads ?ref=, completes + polls
│       └── cancel/page.jsx
│
├── components/
│   ├── layout/               SiteShell, SiteHeader, SiteFooter
│   ├── ui/                   Button, Input, Card, Modal, Table, Badge,
│   │                         Spinner, EmptyState, StateViews
│   ├── ProductArtwork.jsx
│   ├── ProductCard.jsx
│   ├── ProductGrid.jsx
│   ├── CategoryFilter.jsx
│   ├── AddToCartForm.jsx
│   └── ProviderButtons.jsx
│
├── context/
│   ├── AuthContext.jsx       useAuth(): user, status, login, signup, logout
│   └── CartContext.jsx       useCart(): items, addItem, itemCount, subtotalCents
│
├── lib/
│   ├── api.js                fetch client (credentials: 'include', ApiError)
│   └── format.js             formatPrice, formatDate, formatInterval, titleCase
│
├── public/
│   └── favicon.svg           Local platinum "S/P" monogram
│
└── server/                   Express API
    ├── index.js              Entry point (webhooks → cors → json → session → routes)
    ├── config/
    │   ├── db.js             mysql2/promise pool + checkDatabaseConnection()
    │   └── session.js        express-session + memorystore (sc.sid)
    ├── middleware/
    │   ├── auth.js           getUserFromSession, requireAuth, attachUser
    │   └── errorHandler.js   notFound, errorHandler, asyncHandler
    ├── controllers/
    │   ├── authController.js
    │   ├── productController.js
    │   └── orderController.js
    ├── routes/
    │   ├── auth.js           /api/auth
    │   ├── products.js       /api/products
    │   └── orders.js         /api/orders
    └── payments/             PRE-BUILT MODULE — do not modify
        ├── index.js  routes.js  service.js  store.js  registry.js
        ├── catalogue.js  config.json  http.js  money.js
        ├── reconcile.js  util.js  README.md
        ├── plans.js            ← the only app-owned file here
        └── providers/          stripe.js  paypal.js  paystack.js  flutterwave.js
```

---

## Prerequisites

- **Node.js ≥ 18** (the API uses the global `fetch` available from 18)
- **npm 9+**
- **MySQL 8** (utf8mb4)
- Optional: **PM2** for production process management

---

## Database setup

Create the database and load the schema + seed data:

```bash
mysql -u root -p -e "CREATE DATABASE streetclothing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p streetclothing < schema.sql
```

`schema.sql` creates:

| Table | Purpose |
| --- | --- |
| `users` | `id`, `email` (UNIQUE), `password_hash`, `full_name`, `created_at` |
| `products` | `id`, `slug` (UNIQUE), `name`, `tagline`, `description`, `price_cents`, `category`, `drop_name`, `colorway`, `accent_hex`, `in_stock`, `featured`, `created_at` |
| `product_sizes` | `id`, `product_id` (FK), `label`, `stock` |
| `orders` | `id`, `user_id` (FK, nullable), `reference` (UNIQUE), `status` (`pending`/`paid`/`failed`/`canceled`), `total_cents`, `currency`, `created_at` |
| `order_items` | `id`, `order_id` (FK), `product_id` (FK), `size_label`, `quantity`, `unit_price_cents` |

Indexes exist on `products.category`, `products.featured` and `orders.user_id`. The file ends with 12 seeded streetwear products (Platinum Seam Hoodie, Midnight Cargo Pant, Static Box Tee, …) with sizes, plus one demo user.

The payments module manages its own tables/storage on first boot — no manual step required.

---

## Environment variables

Copy the template and fill it in. **Never commit real secrets.**

```bash
cp .env.example .env
```

| Variable | Meaning |
| --- | --- |
| `PORT` | Port the Express API binds to (deploy assigns `4117`) |
| `NODE_ENV` | `development` or `production` |
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | MySQL database name (e.g. `streetclothing`) |
| `SESSION_SECRET` | Secret used to sign the `sc.sid` session cookie |
| `SESSION_COOKIE_DOMAIN` | Cookie domain shared by the frontend and API hosts (e.g. `.arx-app.com`) |
| `CLIENT_ORIGIN` | Primary allowed browser origin for CORS (e.g. `https://streetclothing.arx-app.com`) |
| `SSL_ENABLED` | `true` to terminate TLS inside the Node process |
| `SSL_CERT_PATH` | Path to the TLS certificate (`/home/arx-app/backends/certs/certificate.crt`) |
| `SSL_KEY_PATH` | Path to the TLS private key (`/home/arx-app/backends/certs/private.key`) |
| `SSL_CA_PATH` | Optional CA bundle path |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL the browser calls (`https://streetclothing-api.arx-app.com:4117`) |
| `PAYMENTS_PUBLIC_URL` | Public frontend base URL providers redirect back to (`https://streetclothing.arx-app.com`) |
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `PAYPAL_CLIENT_ID` | PayPal REST client id |
| `PAYPAL_CLIENT_SECRET` | PayPal REST client secret |
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave secret key |
| `FLUTTERWAVE_WEBHOOK_HASH` | Flutterwave webhook verification hash |

Only `NEXT_PUBLIC_API_BASE_URL` is exposed to the browser. Payment keys are **backend-only** — a provider simply does not appear in `/api/payments/providers` until its keys are present.

---

## Running locally

```bash
npm install          # installs frontend + backend dependencies (one manifest)
npm run build        # builds the Next.js storefront
npm run server       # starts the Express API (server/index.js)
```

`npm start` is identical to `npm run server`.

For frontend iteration you may run the Next.js dev server directly:

```bash
npx next dev
```

and keep `npm run server` running in a second terminal. The frontend never imports server code — it talks to the API over HTTP at `NEXT_PUBLIC_API_BASE_URL`, always with `credentials: 'include'`.

Health check:

```bash
curl -k https://localhost:4117/health
curl -k https://localhost:4117/api/health   # includes database connectivity
```

---

## Running in production

### START.sh

```bash
chmod +x START.sh
./START.sh
```

The script changes to its own directory, exports the variables from `.env` when present, runs `npm install --omit=dev` if `node_modules` is missing, creates `logs/`, then launches the API in the background:

```
nohup node server/index.js > logs/api.log 2>&1 &
```

It prints the PID and the health URL `https://streetclothing-api.arx-app.com:4117/health`.

### PM2

```bash
pm2 start ecosystem.config.js
pm2 logs streetclothing
pm2 restart streetclothing
pm2 save
```

`ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: 'streetclothing',
    script: 'server/index.js',
    cwd: '/home/arx-app/backends/streetclothing',
    env: { NODE_ENV: 'production', PORT: 4117 },
  }],
};
```

The Next.js frontend is built with `npm run build` and deployed separately (static/edge hosting); only the API runs under PM2.

---

## TLS in process

When `SSL_ENABLED=true`, `server/index.js` reads `SSL_CERT_PATH`, `SSL_KEY_PATH` and optionally `SSL_CA_PATH` and creates an **HTTPS** server on `PORT` (4117) bound to `0.0.0.0`. Otherwise it falls back to plain HTTP — useful for local development.

Because the storefront is served over HTTPS on a different host, the session cookie is issued with `secure: true`, `sameSite: 'none'`, `httpOnly: true` and `domain = SESSION_COOKIE_DOMAIN`, and `app.set('trust proxy', 1)` is enabled. Cross-site cookies **require** both sides to be HTTPS.

CORS allows `undefined` origins (server-to-server / curl), `CLIENT_ORIGIN`, `https://streetclothing.arx-app.com` and any `*.arx-app.com` host, with `credentials: true`.

---

## REST API reference

Base URL: `https://streetclothing-api.arx-app.com:4117`
All responses are JSON. Authenticated routes rely on the `sc.sid` cookie.

### Health

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/health` | — | `{ status: 'ok' }` |
| GET | `/api/health` | — | `{ status: 'ok', database: true \| false }` |

### Auth — `/api/auth`

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `{ fullName, email, password }` | `201 { user }` · `400` validation · `409` duplicate email |
| POST | `/api/auth/login` | `{ email, password }` | `200 { user }` · `401 { error: 'Invalid email or password' }` |
| POST | `/api/auth/logout` | — | `{ ok: true }` |
| GET | `/api/auth/me` | — | `{ user }` or `{ user: null }` |

`user` is `{ id, email, fullName }`.

### Products — `/api/products`

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| GET | `/api/products` | `category`, `featured=1`, `search`, `limit` | `{ products: [{ id, slug, name, tagline, priceCents, category, dropName, colorway, accentHex, inStock, featured, sizes: [{ label, stock }] }] }` |
| GET | `/api/products/categories` | — | `{ categories: [{ id, label, count }] }` |
| GET | `/api/products/:slug` | — | `{ product }` (with `description` + `sizes`) · `404 { error: 'Product not found' }` |

### Orders & cart checkout — `/api/orders`

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/api/orders/checkout` | `{ provider, items: [{ productId, sizeLabel, quantity }] }` | `{ reference, redirectUrl }` · `400` empty/invalid cart |
| GET | `/api/orders` | — (auth required) | `{ orders: [{ id, reference, status, totalCents, currency, createdAt, items: [...] }] }` · `401` |

> The checkout endpoint **re-reads every unit price from the database**. Amounts sent by the browser are ignored entirely. A `pending` order plus its `order_items` are written before the provider checkout is created; the `payment.succeeded` listener flips the order to `paid` for any `itemId` beginning `order:`.

### Payments module — `/api/payments`

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/payments/providers` | — | `{ currency, providers: [{ id, label, mode }] }` (empty until keys are configured) |
| GET | `/api/payments/plans` | — | `{ currency, plans: [...], products: [...] }` |
| POST | `/api/payments/checkout` | `{ provider, planId }` or `{ provider, productId }` | `{ reference, redirectUrl }` |
| POST | `/api/payments/:reference/complete` | — | `{ reference, status, kind, itemId, amount, currency }` |
| GET | `/api/payments/subscription` | — | `{ subscription \| null }` |
| POST | `/api/payments/subscription/cancel` | — | `{ subscription }` |
| GET | `/api/payments/subscription/manage` | — | `{ url }` (may be `null` — hide the manage button) |

Provider webhooks are mounted by `payments.attachPaymentWebhooks(app)` **before any body parser**, so raw signature verification works.

---

## Payments

- Currency is **USD** everywhere; amounts are whole numbers in cents.
- `server/payments/plans.js` declares the catalogue:
  - **Plans** — `street-pass-monthly` ($9.00/month) and `street-pass-yearly` ($90.00/year): early drop access, free shipping, member-only colourways.
  - **Products** — `gift-card-50` ($50.00) and `drop-preorder-deposit` ($25.00).
- Prices are rendered with `Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })` after dividing by 100 (zero-decimal currencies such as JPY, XOF, XAF, UGX and RWF are not divided) — see `lib/format.js`.
- Paid API routes can be protected with `payments.requireSubscription()` or `payments.requireSubscription(['street-pass-monthly'])`.
- **Card details are never collected in this app.** Customers are redirected to the provider's hosted checkout and returned to `/billing/success?ref=…` or `/billing/cancel`.

Return-path contract the frontend honours exactly:

| Path | Behaviour |
| --- | --- |
| `/pricing` | Plans + products, one pay button per provider, friendly "payments are not available yet" state when `providers` is empty |
| `/billing` | Current subscription with cancel and manage buttons |
| `/billing/success` | Reads `?ref=`, POSTs `/api/payments/<ref>/complete`, polls every 3s up to 10 times while `pending`, then shows the outcome |
| `/billing/cancel` | "Payment cancelled" with a link back to `/pricing` |

---

## Demo credentials

Seeded by `schema.sql` (bcrypt hash noted in a comment beside the row):

```
email:    demo@streetplatinum.test
password: platinum2024
```

Change or delete this row before any real deployment:

```sql
DELETE FROM users WHERE email = 'demo@streetplatinum.test';
```

---

## Troubleshooting

**`/api/health` reports `database: false`**
Check `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, that MySQL is running, and that the user can connect from the API host. `server/config/db.js` pings a pooled connection and releases it.

**`ER_NO_SUCH_TABLE`**
`schema.sql` was not loaded into the database named by `DB_NAME`. Re-run `mysql -u <user> -p <DB_NAME> < schema.sql`.

**Login succeeds but `/api/auth/me` returns `{ user: null }`**
The session cookie is being dropped. Confirm: both hosts are HTTPS, `SESSION_COOKIE_DOMAIN` covers both (e.g. `.arx-app.com`), the browser request uses `credentials: 'include'`, and the origin is allowed by CORS with `credentials: true`.

**CORS error in the browser console**
Add the exact frontend origin to `CLIENT_ORIGIN`. Wildcard origins cannot be combined with credentials — the server echoes a single allowed origin.

**`/api/payments/providers` returns an empty array**
No provider keys are set. Add `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET`, `PAYSTACK_SECRET_KEY` or `FLUTTERWAVE_SECRET_KEY` to `.env` and restart. The `/pricing` page intentionally shows the "payments are not available yet" state until then.

**Payment stays `pending` on `/billing/success`**
The provider has not confirmed yet. The page polls 10 times over 30 seconds; the webhook (or `payments.reconcile`) will settle it shortly after. Verify the webhook URL is reachable and `STRIPE_WEBHOOK_SECRET` / `FLUTTERWAVE_WEBHOOK_HASH` match the provider dashboard.

**Provider redirects to the wrong site**
`PAYMENTS_PUBLIC_URL` must be the public frontend origin (no trailing slash), not the API origin.

**`EADDRINUSE` on 4117**
Another instance is running: `pm2 delete streetclothing` or `kill $(lsof -t -i:4117)`.

**TLS errors at startup**
With `SSL_ENABLED=true`, both `SSL_CERT_PATH` and `SSL_KEY_PATH` must exist and be readable by the process user. Unset `SSL_ENABLED` locally to fall back to HTTP.

**Frontend renders but all data panels show the error state**
The API is unreachable from the browser. Confirm `NEXT_PUBLIC_API_BASE_URL`, that port 4117 is open, and that the certificate is trusted (self-signed certs must be accepted once in the browser).

---

© STREET/PLATINUM