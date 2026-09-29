# Integration Notes for streetclothing

## Overview

**STREET/PLATINUM** (package name: `streetclothing`) is a streetwear e-commerce application split across two runtimes that live in a single repository and share one `package.json`:

- **Storefront** — a Next.js App Router frontend at the repository root (`app/`, `components/`, `context/`, `lib/`). It covers the home page, catalogue (`/shop`), product detail (`/product/[slug]`), cart, authentication, account/order history, membership pricing and billing screens.
- **API** — an Express server under `server/`, backed by MySQL 8, providing session-based auth with bcrypt hashing, product/catalogue endpoints, server-computed cart checkout, order history and the pre-built payments module in `server/payments/`.

Payments are handled by four providers — **Stripe, PayPal, Paystack and Flutterwave** — all denominated in **USD**. The payments module is pre-built and documented separately; this document covers how to wire it into the rest of the app via environment variables.

Key architectural constraints baked into the generated code:

- **One stylesheet.** `app/globals.css` is the only styling surface (design tokens + semantic classes). No Tailwind, no CSS modules, no CSS-in-JS, no inline style objects.
- **Runtime-only API calls.** The browser reads `NEXT_PUBLIC_API_BASE_URL` and fetches inside `useEffect`; nothing in `lib/api.js` runs at module scope. Every data view ships loading, error, empty **and** success states, so the storefront degrades gracefully when the API is unreachable.
- **Server-authoritative pricing.** `POST /api/orders/checkout` re-reads every price from the `products` table; browser-supplied totals are never trusted.
- **TLS in-process.** When `SSL_ENABLED=true`, `server/index.js` builds an HTTPS server itself from the configured certificate paths and binds directly to `PORT` (4117).

## Prerequisites

| Requirement | Version / Notes |
|---|---|
| Node.js | **>= 18** (enforced by `engines.node` in `package.json`) |
| npm | 9+ (ships with Node 18) |
| MySQL | **8.0+**, `utf8mb4` default charset |
| PM2 | Optional, for production process management (`npm install -g pm2`) |
| TLS certificate + key | Required only when `SSL_ENABLED=true`; default paths under `/home/arx-app/backends/certs/` |
| Payment provider accounts | Stripe, PayPal (REST app), Paystack, Flutterwave — test keys are sufficient for local work |

A Unix-like shell is assumed for `START.sh` (bash, `set -euo pipefail`).

## Installation

### 1. Clone and install dependencies

There is a **single root `package.json`** holding both frontend and backend dependencies (`next`, `react`, `react-dom`, `express`, `cors`, `dotenv`, `express-session`, `memorystore`, `bcryptjs`, `mysql2`, `cookie-parser`). There are no workspaces and no separate install step inside `server/`.

```bash
git clone <your-repo-url> streetclothing
cd streetclothing
npm install
```

For a production host where you only need the API runtime:

```bash
npm install --omit=dev
```

### 2. Create the database and load the schema

```bash
mysql -u root -p -e "CREATE DATABASE streetclothing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'streetclothing'@'localhost' IDENTIFIED BY 'your-secret-here';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON streetclothing.* TO 'streetclothing'@'localhost'; FLUSH PRIVILEGES;"

mysql -u streetclothing -p streetclothing < schema.sql
```

`schema.sql` creates `users`, `products`, `product_sizes`, `orders` and `order_items` (with indexes on `products.category`, `products.featured` and `orders.user_id`), then seeds **12 streetwear products** (e.g. *Platinum Seam Hoodie*, *Midnight Cargo Pant*, *Static Box Tee*) with sizes, colourways and prices, plus **one demo user** whose bcrypt hash and plaintext password are noted in a comment at the bottom of the file. Use those credentials to verify login end to end — see `README.md` for the exact values.

### 3. Configure environment

```bash
cp .env.example .env
$EDITOR .env
```

`.env.example` contains placeholders only — never commit real secrets. `.gitignore` already excludes `.env`, `.env.local`, `node_modules`, `.next`, `out`, `logs`, `*.log` and certificate files.

### 4. Build the frontend

```bash
npm run build
```

This runs `next build` and emits `.next/`. The `scripts` block is intentionally minimal and contains exactly three entries:

```json
{ "build": "next build", "start": "node server/index.js", "server": "node server/index.js" }
```

## Environment Variables

All variables are read by the Express process from `.env` (loaded via `dotenv/config` at the top of `server/index.js`). Variables prefixed `NEXT_PUBLIC_` are additionally inlined into the browser bundle at build time, with a fallback defined in `next.config.js`.

### Server runtime

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the Express API binds to (assigned by the deploy script). | `4117` |
| `NODE_ENV` | Node environment. Controls error verbosity in `server/middleware/errorHandler.js`. | `production` |

### Database

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | MySQL host used by the `mysql2/promise` pool in `server/config/db.js`. | `127.0.0.1` |
| `DB_USER` | MySQL user. | `streetclothing` |
| `DB_PASSWORD` | MySQL password. | `your-secret-here` |
| `DB_NAME` | MySQL database name. | `streetclothing` |

### Sessions and CORS

| Variable | Description | Example |
|---|---|---|
| `SESSION_SECRET` | Secret used to sign the session cookie (`sc.sid`). Use a long random string. | `change-me-to-a-long-random-string` |
| `SESSION_COOKIE_DOMAIN` | Cookie domain shared by the frontend and API hosts, so the browser sends the session cookie cross-subdomain. | `.arx-app.com` |
| `CLIENT_ORIGIN` | Primary allowed browser origin for CORS. The origin callback in `server/index.js` also permits any `*.arx-app.com` host and undefined origins (server-to-server / curl). | `https://streetclothing.arx-app.com` |

### TLS

| Variable | Description | Example |
|---|---|---|
| `SSL_ENABLED` | Set to `'true'` to terminate TLS inside the Node process (`https.createServer`). Anything else falls back to `http.createServer`. | `true` |
| `SSL_CERT_PATH` | Path to the TLS certificate file. | `/home/arx-app/backends/certs/certificate.crt` |
| `SSL_KEY_PATH` | Path to the TLS private key file. | `/home/arx-app/backends/certs/private.key` |
| `SSL_CA_PATH` | Optional path to the TLS CA bundle. | `/home/arx-app/backends/certs/ca_bundle.crt` |

### Frontend

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the backend API used by the browser. Consumed by `lib/api.js` as `API_BASE_URL`, with the same default hard-coded in `next.config.js`. | `https://streetclothing-api.arx-app.com:4117` |

### Payments module

| Variable | Description | Example |
|---|---|---|
| `PAYMENTS_PUBLIC_URL` | Public frontend base URL the payment providers redirect back to (`/billing/success`, `/billing/cancel`). | `https://streetclothing.arx-app.com` |
| `STRIPE_SECRET_KEY` | Stripe secret API key (payments module). | `sk_test_placeholder` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (payments module). | `whsec_placeholder` |
| `PAYPAL_CLIENT_ID` | PayPal REST client id (payments module). | `paypal-client-id-placeholder` |
| `PAYPAL_CLIENT_SECRET` | PayPal REST client secret (payments module). | `paypal-client-secret-placeholder` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (payments module). | `sk_test_paystack_placeholder` |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave secret key (payments module). | `FLWSECK_TEST-placeholder` |
| `FLUTTERWAVE_WEBHOOK_HASH` | Flutterwave webhook verification hash (payments module). | `flw-webhook-hash-placeholder` |

> Providers with missing or placeholder credentials are simply omitted from `GET /api/payments/providers`. The UI handles that case: `components/ProviderButtons.jsx` renders the shared *"Payments are not available yet — check back soon"* empty state on `/pricing` and `/cart`.

## Running the Application

### Local development

Run the two processes in separate terminals.

Terminal 1 — API:

```bash
npm run server        # node server/index.js
```

Terminal 2 — frontend (Next.js dev server):

```bash
npx next dev
```

For local work set `SSL_ENABLED=false`, point `NEXT_PUBLIC_API_BASE_URL` at `http://localhost:4117`, and leave `SESSION_COOKIE_DOMAIN` empty. Note that `server/config/session.js` sets `cookie.secure: true` and `sameSite: 'none'`; if you are on plain `http://localhost`, the browser will refuse the cookie, so either run local TLS or temporarily relax those two cookie options while developing auth flows.

### Production (single command)

```bash
./START.sh
```

`START.sh` changes to its own directory, exports every variable from `.env` when present, runs `npm install --omit=dev` if `node_modules` is missing, creates `logs/`, then launches the API detached:

```
nohup node server/index.js > logs/api.log 2>&1 &
```

and prints the resulting PID plus the health URL `https://streetclothing-api.arx-app.com:4117/health`.

### Production (PM2)

`ecosystem.config.js` is pre-configured for the deploy host:

```bash
npm install --omit=dev
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 logs streetclothing
```

The app entry is `server/index.js`, `cwd` is `/home/arx-app/backends/streetclothing`, and the environment block sets `NODE_ENV=production` and `PORT=4117`. Adjust `cwd` if you deploy elsewhere.

### Verifying the deployment

```bash
curl -k https://streetclothing-api.arx-app.com:4117/health
# {"status":"ok"}

curl -k https://streetclothing-api.arx-app.com:4117/api/health
# {"status":"ok","database":true}

curl -k https://streetclothing-api.arx-app.com:4117/api/products?featured=1&limit=6
```

`/health` is dependency-free (useful for load balancers); `/api/health` additionally calls `checkDatabaseConnection()` from `server/config/db.js` inside a try/catch.

### Middleware order (do not reorder)

`server/index.js` mounts middleware in a deliberate sequence:

1. `payments.attachPaymentWebhooks(app)` — **before any body parser**, so provider webhooks can verify raw-body signatures.
2. `cors({ origin: <callback>, credentials: true })`
3. `express.json()`
4. `sessionMiddleware`
5. `/health`, `/api/health`
6. `/api/auth`, `/api/products`, `/api/orders`
7. `payments.attachPaymentRoutes(app, { getUser })`
8. `payments.on('payment.succeeded', ...)` → `markOrderPaid()` for `itemId`s beginning `order:`
9. `notFound`, then `errorHandler`

`app.set('trust proxy', 1)` is set early so secure cookies work behind a reverse proxy.

## Project Structure

```
streetclothing/
├── package.json              Single manifest: Next + Express deps, 3 scripts, engines.node >=18
├── next.config.js            reactStrictMode, NEXT_PUBLIC_API_BASE_URL fallback, images.unoptimized
├── ecosystem.config.js       PM2 app definition (name streetclothing, port 4117)
├── START.sh                  Bash launcher: env export, install, nohup background API, prints PID
├── schema.sql                MySQL 8 schema + 12 seeded products + demo user
├── .env.example              Every env var with placeholder values
├── .gitignore                node_modules, .next, out, logs, .env*, certs
├── README.md                 Full docs: design system, endpoints, demo login, troubleshooting
│
├── server/
│   ├── index.js              Express entry point; TLS/HTTP server construction; listen on 0.0.0.0
│   ├── config/
│   │   ├── db.js             mysql2/promise pool (limit 10, keepalive, utf8mb4) + checkDatabaseConnection
│   │   └── session.js        express-session + memorystore; cookie 'sc.sid', 7-day rolling
│   ├── middleware/
│   │   ├── auth.js           getUserFromSession, requireAuth (401), attachUser
│   │   └── errorHandler.js   notFound, errorHandler, asyncHandler
│   ├── controllers/
│   │   ├── authController.js signup / login / logout / me (bcrypt cost 10, session regenerate)
│   │   ├── productController.js  listProducts (?category,?featured,?search,?limit), getProductBySlug, listCategories
│   │   └── orderController.js    createCartCheckout (server-side totals), markOrderPaid, listOrders
│   ├── routes/
│   │   ├── auth.js           → /api/auth
│   │   ├── products.js       → /api/products
│   │   └── orders.js         → /api/orders
│   └── payments/             Pre-built multi-provider module (documented separately)
│       └── plans.js          street-pass-monthly $9/mo, street-pass-yearly $90/yr, gift-card-50, drop-preorder-deposit
│
├── app/                      Next.js App Router
│   ├── globals.css           THE single stylesheet: reset, :root tokens, typography, layout + components
│   ├── layout.jsx            Imports globals.css once; AuthProvider → CartProvider → SiteShell
│   ├── page.jsx              Home: hero, featured drop strip, value grid, membership teaser
│   ├── shop/page.jsx         Catalogue: CategoryFilter + debounced search + ProductGrid
│   ├── product/[slug]/page.jsx  Product detail + AddToCartForm
│   ├── cart/page.jsx         Cart table, summary, provider checkout
│   ├── login/ · signup/ · account/    Auth screens and order history
│   ├── pricing/page.jsx      Membership plans + one-off products (exact path /pricing)
│   ├── billing/page.jsx      Subscription status, cancel modal, manage-billing link
│   ├── billing/success/page.jsx  Reads ?ref=, completes + polls payment, clears cart
│   ├── billing/cancel/page.jsx   "Nothing was charged" confirmation
│   └── not-found.jsx         404 via EmptyState
│
├── components/
│   ├── layout/               SiteShell, SiteHeader (sticky, cart count, auth area), SiteFooter
│   ├── ui/                   Button, Input/Field/Select, Card, Modal (portal), Table, Badge,
│   │                         Spinner, EmptyState, StateViews (LoadingState/ErrorState/OfflineNotice)
│   ├── ProductArtwork.jsx    Deterministic inline SVG/gradient placeholder (no remote images)
│   ├── ProductCard.jsx · ProductGrid.jsx · CategoryFilter.jsx
│   ├── AddToCartForm.jsx     Size selector, quantity stepper, aria-live confirmation
│   └── ProviderButtons.jsx   One button per available payment provider
│
├── context/
│   ├── AuthContext.jsx       useAuth(); getMe() in useEffect, network errors → ready/user:null
│   └── CartContext.jsx       useCart(); localStorage key 'streetclothing.cart', qty clamped 1–10
│
├── lib/
│   ├── api.js                API_BASE_URL, request() with credentials:'include', ApiError, all endpoints
│   └── format.js             formatPrice (zero-decimal aware), formatDate, formatInterval, titleCase
│
└── public/favicon.svg        Local S/P monogram in the token palette
```

### REST surface at a glance

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness, no DB |
| GET | `/api/health` | Includes `database` boolean |
| POST | `/api/auth/signup` | email, password (>=8), fullName; 409 on duplicate |
| POST | `/api/auth/login` | Regenerates session |
| POST | `/api/auth/logout` | Destroys session, clears `sc.sid` |
| GET | `/api/auth/me` | `{ user }` or `{ user: null }` |
| GET | `/api/products` | `?category=`, `?featured=1`, `?search=`, `?limit=` |
| GET | `/api/products/categories` | Aggregated counts |
| GET | `/api/products/:slug` | 404 `{ error: 'Product not found' }` |
| POST | `/api/orders/checkout` | Server recomputes totals; returns `{ reference, redirectUrl }` |
| GET | `/api/orders` | Requires auth |
| — | `/api/payments/*` | providers, plans, checkout, `:ref/complete`, subscription, subscription/cancel, subscription/manage |

## Next Steps / Production Considerations

1. **Replace the session store.** `server/config/session.js` uses `memorystore`, which is per-process and lost on restart. Before running more than one PM2 instance (or cluster mode), swap in a shared store such as `express-mysql-session` or Redis — otherwise users will be logged out at random.
2. **Rotate `SESSION_SECRET`.** Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and store it outside the repo. Never ship the `.env.example` placeholder.
3. **Move off placeholder payment keys.** Swap the `sk_test_*` / `FLWSECK_TEST-*` values for live credentials, register the webhook endpoints with each provider, and confirm `PAYMENTS_PUBLIC_URL` matches the exact public origin so `/billing/success?ref=` returns cleanly. Verify signature checks by replaying a test event per provider.
4. **Front the API with a reverse proxy.** In-process TLS on port 4117 is convenient for the deploy script, but nginx/Caddy termination gives you HTTP/2, automatic certificate renewal, request buffering and easier rate limiting. If you switch, set `SSL_ENABLED=false` and keep `app.set('trust proxy', 1)`.
5. **Tighten CORS.** The origin callback currently allows any `*.arx-app.com` host. In production, narrow it to the exact value of `CLIENT_ORIGIN` plus any deliberately whitelisted subdomains.
6. **Serve the built frontend.** `npm run build` produces `.next/`; run it behind `next start` (or a static/edge host) on the storefront domain while `server/index.js` serves only the API on 4117. Rebuild whenever `NEXT_PUBLIC_API_BASE_URL` changes, since it is inlined at build time.
7. **Add rate limiting and brute-force protection** on `POST /api/auth/login` and `POST /api/auth/signup` (e.g. `express-rate-limit`), and consider account lockout after repeated failures.
8. **Inventory correctness.** `product_sizes.stock` is read for display but checkout does not decrement it. Before real trading, wrap order insertion in a transaction that locks and decrements stock, and reject oversold lines with a 409.
9. **Order lifecycle hardening.** `markOrderPaid(reference)` is driven by the `payment.succeeded` event. Add idempotency (ignore repeat events for an already-`paid` order) and a reconciliation job that sweeps `pending` orders older than N hours into `canceled`.
10. **Backups and migrations.** Schedule `mysqldump` for the `streetclothing` database and adopt a migration tool rather than re-running `schema.sql`, which contains seed `INSERT`s. Delete the seeded demo user before going live.
11. **Logging and monitoring.** `START.sh` writes to `logs/api.log` with no rotation — add `logrotate` or use `pm2-logrotate`. Point uptime monitoring at `/api/health` so database outages surface, not just process liveness.
12. **Accessibility and performance passes.** The design system already enforces 44×44px hit areas, visible `:focus-visible` rings, reserved skeleton space and a `prefers-reduced-motion` block. Confirm with axe/Lighthouse at 360px, 768px and 1280px, particularly the mobile nav toggle in `components/layout/SiteHeader.jsx` and the portalled `components/ui/Modal.jsx` focus trap.
13. **Images.** `images.unoptimized` is `true` because all artwork is locally generated SVG/CSS gradient (`components/ProductArtwork.jsx`). If you later introduce real photography, add a remote pattern allowlist in `next.config.js` and turn optimisation back on.

## Database Provisioning

A mysql database has been automatically provisioned for this app.

- **Database:** app_streetclothing
- **Host:** testdb.gridiron-app.com
- **Port:** 3306
- **User:** streetclothing
- **Credentials stored in Vault at:** `secret/data/mysql/streetclothing`

Retrieve the password securely from Vault and set it as an environment variable (e.g. `DB_PASSWORD`) in your deployment settings — do not commit it to source control.


## Payments

This app takes payments through Flutterwave, PayPal, Paystack, Stripe in USD. The pre-built module is in `server/payments/`; what the app sells is defined in `server/payments/plans.js`.

**Before going live:**

1. Enter your payment keys in the **Payments** section of the Deploy dialog. They are stored in Vault and written to the backend's environment at deploy time, never into the code. Start with test keys.
2. **Flutterwave:** In the Flutterwave Dashboard open Settings → Webhooks, paste this URL, enter the secret hash shown below, and save. The Deploy dialog shows the URL to use.
3. **Paystack:** In the Paystack Dashboard open Settings → API Keys & Webhooks and paste this URL into the Webhook URL field for the mode you are using (test or live). The Deploy dialog shows the URL to use.
4. **Stripe:** save the Customer Portal settings once in the Stripe dashboard (Settings → Billing → Customer portal) so the "Manage subscription" button works.