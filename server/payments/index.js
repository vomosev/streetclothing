'use strict';

/**
 * Payments module (Stripe, Paystack, Flutterwave, PayPal — whichever were
 * chosen when the app was built; see config.json).
 *
 * Wiring in server/index.js:
 *
 *   const payments = require('./payments');
 *   const app = express();
 *   payments.attachPaymentWebhooks(app);   // before express.json() or any body parser
 *   // ...cors, express.json(), sessions, auth...
 *   payments.attachPaymentRoutes(app, { getUser: (req) => req.session.user || null });
 *
 * getUser must return { id, email } for the signed-in user, or null.
 * Keys are read from the environment at runtime (written at deploy time),
 * so a provider without keys is simply hidden from the pricing page.
 */

const routes = require('./routes');
const service = require('./service');
const store = require('./store');
const { startReconciler } = require('./reconcile');
const { PaymentsError } = require('./util');

function attachPaymentWebhooks(app, { path = '/api/payments/webhook' } = {}) {
  app.use(path, routes.createWebhookRouter());
}

function attachPaymentRoutes(app, { getUser, path = '/api/payments' } = {}) {
  if (typeof getUser !== 'function') {
    throw new Error('attachPaymentRoutes(app, { getUser }) needs a getUser(req) function returning { id, email } or null');
  }
  routes.setGetUser(getUser);
  app.use(path, routes.createApiRouter());

  store.ensureTables()
    .then(() => startReconciler())
    .catch((err) => console.error(`[payments] Could not create the payment tables: ${err.message}`));
}

/**
 * Express middleware: lets the request through only for users with an active
 * subscription (to any plan, or to one of `planIds`).
 */
function requireSubscription(planIds) {
  const ids = planIds ? [].concat(planIds) : undefined;
  return async (req, res, next) => {
    try {
      const user = await routes.currentUser(req);
      if (!user) throw new PaymentsError(401, 'Sign in to continue');
      const subscription = await service.getActiveSubscription(user.id, ids);
      if (!subscription) throw new PaymentsError(402, 'An active subscription is required');
      req.subscription = subscription;
      next();
    } catch (err) {
      routes.sendError(res, err);
    }
  };
}

module.exports = {
  attachPaymentWebhooks,
  attachPaymentRoutes,
  requireSubscription,
  getActiveSubscription: service.getActiveSubscription,
  createCheckout: service.createCheckout,
  on: (eventName, listener) => service.events.on(eventName, listener),
};
