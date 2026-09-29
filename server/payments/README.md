# Payments

This folder was added by the AI builder. It handles one-off payments and subscriptions through the providers listed in `config.json`, using each provider's hosted checkout page, so card details never touch this app.

## What to edit

- `plans.js`: the subscription plans and one-off products the app sells. Amounts are whole numbers in the smallest unit of the currency in `config.json`.
- Nothing else in this folder should need changing. To add another provider, add `providers/<name>.js` implementing the same methods as the existing providers and add its id to `config.json`.

## Wiring (server/index.js)

```js
const payments = require('./payments');
const app = express();
payments.attachPaymentWebhooks(app);   // before express.json() or any body parser
// ...cors, express.json(), sessions, auth...
payments.attachPaymentRoutes(app, { getUser: (req) => req.session.user || null });

app.get('/api/reports', payments.requireSubscription(), handler);          // any active plan
app.get('/api/export', payments.requireSubscription(['pro-yearly']), handler);

payments.on('payment.succeeded', ({ reference, userId, itemId, amount, currency }) => { /* fulfil order */ });
```

## HTTP API

| Method | Path | Body / response |
|---|---|---|
| GET | `/api/payments/providers` | `{ currency, providers: [{ id, label, mode }] }` |
| GET | `/api/payments/plans` | `{ currency, plans, products }` |
| POST | `/api/payments/checkout` | `{ provider, planId }` or `{ provider, productId }` → `{ reference, redirectUrl }` |
| POST | `/api/payments/:reference/complete` | → `{ reference, status, kind, itemId, amount, currency }` |
| GET | `/api/payments/subscription` | → `{ subscription }` |
| POST | `/api/payments/subscription/cancel` | → `{ subscription }` |
| GET | `/api/payments/subscription/manage` | → `{ url }` (may be `null`) |
| POST | `/api/payments/webhook/:provider` | Provider webhooks |

Providers return customers to `/billing/success?provider=…&ref=…` and `/billing/cancel?ref=…` on `APP_PUBLIC_URL`.

## Environment (written at deploy time, never committed)

| Provider | Variables |
|---|---|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Paystack | `PAYSTACK_SECRET_KEY` |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH` |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID` |
| All | `APP_PUBLIC_URL`, optional `PAYMENTS_CURRENCY` |

Payment records live in the `payments`, `subscriptions`, `payment_plans` and `payment_events` tables, which are created automatically. A background check every 6 hours re-verifies pending payments and subscriptions in case a webhook was missed.
