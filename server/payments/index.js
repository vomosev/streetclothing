'use strict';

/**
 * Payments module (Stripe, Paystack, Flutterwave, PayPal — whichever were
 * chosen when the app was built; see config.json).
 *
 * This file IS the entry point of the payments directory: server/payments/index.js.
 * It must be required from server/index.js — i.e. one directory up — and the
 * "index" segment should be spelled out so Node never resolves the require to
 * the legacy server/payments.js shim that sits next to this folder:
 *
 *   // in server/index.js (which lives in server/, one level above this file)
 *   const path = require('path');
 *   const payments = require(path.join(__dirname, 'payments', 'index.js')); // -> server/payments/index.js
 *   const app = express();
 *   payments.attachPaymentWebhooks(app);   // before express.json() or any body parser
 *   // ...cors, express.json(), sessions, auth...
 *   payments.attachPaymentRoutes(app, { getUser: (req) => req.session.user || null });
 *   payments.on('payment.succeeded', (event) => { ... });
 *
 * The exported value is an EventEmitter, so `payments.on(...)`,
 * `payments.once(...)` and `payments.off(...)` all work directly on it; every
 * event emitted on the internal service bus is re-emitted here.
 *
 * Sibling modules of this file are required with plain './<name>' paths (see
 * below): './routes', './service', './store', './reconcile', './util'.
 *
 * getUser must return { id, email } for the signed-in user, or null.
 * Keys are read from the environment at runtime (written at deploy time),
 * so a provider without keys is simply hidden from the pricing page.
 */

const { EventEmitter } = require('events');

const routes = require('./routes');
const service = require('./service');
const store = require('./store');
const { startReconciler } = require('./reconcile');
const { PaymentsError } = require('./util');

/**
 * The module itself is the public event bus. Anything emitted on the internal
 * service bus is forwarded here, so consumers only ever deal with `payments`.
 */
const payments = new EventEmitter();
payments.setMaxListeners(0);

const serviceEmit = service.events.emit.bind(service.events);
service.events.emit = function forwardToPayments(eventName, ...args) {
  const handled = serviceEmit(eventName, ...args);
  // Never let a re-emitted 'error' with no listener crash the process.
  if (eventName !== 'error' || payments.listenerCount('error') > 0) {
    payments.emit(eventName, ...args);
  }
  return handled;
};

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

Object.assign(payments, {
  attachPaymentWebhooks,
  attachPaymentRoutes,
  requireSubscription,
  getActiveSubscription: service.getActiveSubscription,
  createCheckout: service.createCheckout,
  events: payments,
});

module.exports = payments;