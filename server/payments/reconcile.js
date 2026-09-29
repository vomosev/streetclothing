'use strict';

// Periodic safety net for missed webhooks. Some providers allow only one
// webhook URL per account, so an owner running several apps on one account
// would otherwise never hear about renewals or cancellations.

const store = require('./store');
const service = require('./service');

const INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;
let started = false;

async function reconcileOnce() {
  const pending = await store.listPendingPayments({ olderThanMinutes: 10, newerThanHours: 72 });
  for (const payment of pending) {
    await service.completePayment(payment.reference).catch((err) =>
      console.warn(`[payments] Reconcile: could not check payment ${payment.reference}: ${err.message}`)
    );
  }

  await store.expireStalePayments(72);

  const subs = await store.listSubscriptionsToReconcile();
  for (const sub of subs) {
    await service.syncSubscription(sub).catch((err) =>
      console.warn(`[payments] Reconcile: could not sync subscription ${sub.id}: ${err.message}`)
    );
  }
}

function startReconciler() {
  if (started) return;
  started = true;
  const run = () =>
    reconcileOnce().catch((err) => console.error(`[payments] Reconcile run failed: ${err.message}`));
  setTimeout(run, FIRST_RUN_DELAY_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
}

module.exports = { reconcileOnce, startReconciler };
