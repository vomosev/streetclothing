'use strict';

// Provider-agnostic payment logic. Providers only translate to and from their
// APIs; every decision (what to charge, whether a payment counts, who has
// access) is made here, so all providers behave the same way.

const { EventEmitter } = require('events');
const store = require('./store');
const registry = require('./registry');
const catalogue = require('./catalogue');
const { PaymentsError, newReference, sha256 } = require('./util');

const events = new EventEmitter();
const FINAL_PAYMENT_STATUSES = new Set(['paid', 'failed', 'canceled']);

function appUrl(pathname) {
  const base = String(process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!base) throw new PaymentsError(500, 'APP_PUBLIC_URL is not set, so checkout return URLs cannot be built');
  return base + pathname;
}

function returnUrls(providerId, reference) {
  return {
    successUrl: appUrl(`/billing/success?provider=${encodeURIComponent(providerId)}&ref=${reference}`),
    cancelUrl: appUrl(`/billing/cancel?ref=${reference}`),
  };
}

function requireUser(user) {
  if (!user || user.id === undefined || user.id === null || !user.email) {
    throw new PaymentsError(401, 'Sign in to continue');
  }
}

function emit(name, payload) {
  // Listener errors must not break payment processing.
  for (const listener of events.listeners(name)) {
    Promise.resolve()
      .then(() => listener(payload))
      .catch((err) => console.error(`[payments] "${name}" listener failed: ${err.message}`));
  }
}

function publicPayment(p) {
  return {
    reference: p.reference,
    kind: p.kind,
    provider: p.provider,
    itemId: p.item_id,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
  };
}

function publicSubscription(s) {
  if (!s) return null;
  return {
    id: s.id,
    planId: s.plan_id,
    provider: s.provider,
    status: s.status,
    currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end).toISOString() : null,
    cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
  };
}

// Plan IDs are cached per provider, mode and price, so changing a price in
// plans.js or switching from test to live keys creates a fresh provider plan.
async function ensureProviderPlan(provider, plan, currency) {
  const key = [provider.mode(), plan.id, plan.amount, currency, plan.interval, plan.intervalCount].join(':');
  const cached = await store.getCachedPlan(provider.id, key);
  if (cached) return cached;
  const providerPlanId = await provider.ensurePlan({ ...plan, key }, { currency });
  await store.cachePlan(provider.id, key, providerPlanId);
  return providerPlanId;
}

// ── checkout ──────────────────────────────────────────────

async function startOneTime({ provider, user, amount, itemId, description }) {
  const currency = registry.currency();
  const reference = newReference();
  await store.insertPayment({
    reference, kind: 'one_time', provider: provider.id, userId: user.id, email: user.email,
    itemId, description, amount, currency,
  });
  try {
    const { providerRef, redirectUrl } = await provider.createCheckout({
      reference, amount, currency, email: user.email, description, ...returnUrls(provider.id, reference),
    });
    await store.updatePayment(reference, { provider_ref: providerRef });
    return { reference, redirectUrl };
  } catch (err) {
    await store.updatePayment(reference, { status: 'failed', failure_reason: String(err.message).slice(0, 255) });
    throw err;
  }
}

async function startSubscription({ provider, user, plan }) {
  const currency = registry.currency();
  const existing = await store.findAccessSubscription(user.id, [plan.id]);
  if (existing && existing.status === 'active' && !existing.cancel_at_period_end) {
    throw new PaymentsError(409, 'You already have an active subscription to this plan');
  }

  const providerPlanId = await ensureProviderPlan(provider, plan, currency);
  const reference = newReference();
  await store.insertPayment({
    reference, kind: 'subscription', provider: provider.id, userId: user.id, email: user.email,
    itemId: plan.id, description: plan.name, amount: plan.amount, currency,
  });
  try {
    const result = await provider.createSubscriptionCheckout({
      reference, plan, providerPlanId, amount: plan.amount, currency, email: user.email,
      ...returnUrls(provider.id, reference),
    });
    await store.updatePayment(reference, { provider_ref: result.providerRef });
    await store.insertSubscription({
      userId: user.id, email: user.email, provider: provider.id, planId: plan.id,
      initialReference: reference, providerPlanId, providerSubscriptionId: result.providerSubscriptionId,
    });
    return { reference, redirectUrl: result.redirectUrl };
  } catch (err) {
    await store.updatePayment(reference, { status: 'failed', failure_reason: String(err.message).slice(0, 255) });
    throw err;
  }
}

/** Used by POST /api/payments/checkout — only accepts items defined in plans.js. */
async function startCheckout({ providerId, user, planId, productId }) {
  requireUser(user);
  const provider = registry.getProvider(providerId);
  if (planId) {
    const plan = catalogue.getPlan(planId);
    if (!plan) throw new PaymentsError(404, `Unknown plan "${planId}"`);
    return startSubscription({ provider, user, plan });
  }
  if (productId) {
    const product = catalogue.getProduct(productId);
    if (!product) throw new PaymentsError(404, `Unknown product "${productId}"`);
    return startOneTime({ provider, user, amount: product.amount, itemId: product.id, description: product.name });
  }
  throw new PaymentsError(400, 'Send a planId or a productId');
}

/**
 * For server code that works out its own total (e.g. a cart). Never pass an
 * amount taken straight from the browser.
 */
async function createCheckout({ provider: providerId, user, amount, description, itemId }) {
  requireUser(user);
  if (!Number.isInteger(amount) || amount <= 0) throw new PaymentsError(400, 'amount must be a positive whole number in the smallest currency unit');
  const provider = registry.getProvider(providerId);
  return startOneTime({ provider, user, amount, itemId: itemId || null, description: description || 'Payment' });
}

// ── completion ────────────────────────────────────────────

function checkResult(payment, result) {
  if (result.status !== 'paid') return { status: result.status, failure: null };
  if (result.currency && String(result.currency).toUpperCase() !== payment.currency) {
    return { status: 'failed', failure: `Paid in ${result.currency}, expected ${payment.currency}` };
  }
  // Subscription amounts are enforced by the provider plan itself.
  if (payment.kind === 'one_time' && result.amount != null && Number(result.amount) < Number(payment.amount)) {
    return { status: 'failed', failure: `Paid ${result.amount}, expected ${payment.amount}` };
  }
  return { status: 'paid', failure: null };
}

/**
 * Confirms a payment with its provider. Safe to call repeatedly and
 * concurrently: from the return page, webhooks and the reconciler.
 *
 * @param {string} reference
 * @param {Object} [options]
 * @param {string|number} [options.userId] - when set, the payment must belong to this user
 */
async function completePayment(reference, { userId } = {}) {
  const payment = await store.getPayment(reference);
  if (!payment || (userId !== undefined && String(payment.user_id) !== String(userId))) {
    throw new PaymentsError(404, 'Payment not found');
  }
  if (FINAL_PAYMENT_STATUSES.has(payment.status) || !payment.provider_ref) return publicPayment(payment);

  const provider = registry.getConfiguredProvider(payment.provider);
  if (!provider) throw new PaymentsError(503, `${payment.provider} is not configured for this app`);

  const result = await provider.completeCheckout(payment);
  const { status, failure } = checkResult(payment, result);

  if (status !== payment.status) {
    const changed = await store.transitionPayment(reference, payment.status, { status, failure_reason: failure });
    if (changed) {
      payment.status = status;
      if (failure) console.error(`[payments] ${reference} rejected: ${failure}`);
      const payload = { ...publicPayment(payment), userId: payment.user_id, email: payment.email };
      if (status === 'paid') emit('payment.succeeded', payload);
      if (status === 'failed') emit('payment.failed', payload);
    }
  }

  if (payment.kind === 'subscription') {
    const sub = await store.findSubscriptionByInitialReference(reference);
    if (sub) {
      const patch = {};
      if (result.providerCustomerId && !sub.provider_customer_id) patch.provider_customer_id = String(result.providerCustomerId);
      if (result.providerSubscriptionId && !sub.provider_subscription_id) patch.provider_subscription_id = String(result.providerSubscriptionId);
      await store.updateSubscription(sub.id, patch);
      if (status === 'paid') await syncSubscription({ ...sub, ...patch }, result.subscription || null);
      if (status === 'failed' || status === 'canceled') await store.updateSubscription(sub.id, { status: 'expired' });
    }
  }

  return publicPayment(payment);
}

// ── subscriptions ─────────────────────────────────────────

async function syncSubscription(sub, known = null) {
  const provider = registry.getConfiguredProvider(sub.provider);
  if (!provider) return sub;

  const n = known || (await provider.getSubscription(sub));
  if (!n) {
    await store.updateSubscription(sub.id, { last_synced_at: new Date() });
    return sub;
  }

  const patch = {
    status: n.status,
    provider_subscription_id: n.providerSubscriptionId ? String(n.providerSubscriptionId) : sub.provider_subscription_id,
    provider_customer_id: n.providerCustomerId ? String(n.providerCustomerId) : sub.provider_customer_id,
    current_period_end: n.currentPeriodEnd || sub.current_period_end,
    cancel_at_period_end: n.cancelAtPeriodEnd ? 1 : 0,
    provider_data: n.providerData ? JSON.stringify(n.providerData) : sub.provider_data,
    last_synced_at: new Date(),
  };
  await store.updateSubscription(sub.id, patch);

  const updated = { ...sub, ...patch };
  if (patch.status !== sub.status || patch.cancel_at_period_end !== Number(sub.cancel_at_period_end)) {
    emit('subscription.updated', { ...publicSubscription(updated), userId: sub.user_id, email: sub.email });
  }
  return updated;
}

async function getActiveSubscription(userId, planIds) {
  return publicSubscription(await store.findAccessSubscription(userId, planIds));
}

async function getSubscriptionForUser(user) {
  requireUser(user);
  const access = await store.findAccessSubscription(user.id);
  if (access) return publicSubscription(access);
  // Show a just-paid subscription that the provider hasn't activated yet.
  const [latest] = await store.listSubscriptionsForUser(user.id);
  return latest && latest.status === 'pending' ? publicSubscription(latest) : null;
}

async function getOwnedAccessSubscription(user, subscriptionId) {
  requireUser(user);
  const sub = subscriptionId ? await store.getSubscription(subscriptionId) : await store.findAccessSubscription(user.id);
  if (!sub || String(sub.user_id) !== String(user.id)) throw new PaymentsError(404, 'No active subscription found');
  return sub;
}

async function cancelSubscription(user, subscriptionId) {
  const sub = await getOwnedAccessSubscription(user, subscriptionId);
  if (!['active', 'past_due'].includes(sub.status) || sub.cancel_at_period_end) {
    return publicSubscription(sub);
  }
  const provider = registry.getConfiguredProvider(sub.provider);
  if (!provider) throw new PaymentsError(503, `${sub.provider} is not configured for this app`);
  await provider.cancelSubscription(sub);
  await store.updateSubscription(sub.id, { cancel_at_period_end: 1 });
  return publicSubscription(await syncSubscription({ ...sub, cancel_at_period_end: 1 }));
}

async function getManageUrl(user, subscriptionId) {
  const sub = await getOwnedAccessSubscription(user, subscriptionId);
  const provider = registry.getConfiguredProvider(sub.provider);
  if (!provider) return null;
  try {
    return await provider.getManageUrl(sub, appUrl('/billing'));
  } catch (err) {
    console.warn(`[payments] Could not create a manage link for subscription ${sub.id}: ${err.message}`);
    return null;
  }
}

// ── webhooks ──────────────────────────────────────────────

async function applyEvent(provider, event) {
  let handled = false;

  if (event.reference) {
    const payment = await store.getPayment(event.reference);
    if (payment && payment.provider === provider.id) {
      await completePayment(payment.reference);
      handled = true;
    }
  }

  if (!handled && event.providerRef) {
    const payment = await store.findPaymentByProviderRef(provider.id, event.providerRef);
    if (payment) {
      await completePayment(payment.reference);
      handled = true;
    }
  }

  if (event.providerSubscriptionId) {
    // PayPal uses the subscription id as the checkout reference too.
    const payment = await store.findPaymentByProviderRef(provider.id, event.providerSubscriptionId);
    if (payment && !FINAL_PAYMENT_STATUSES.has(payment.status)) await completePayment(payment.reference);

    const sub = await store.findSubscriptionByProviderId(provider.id, event.providerSubscriptionId);
    if (sub) {
      await syncSubscription(sub);
      handled = true;
    }
  }

  // Renewal charges and newly created subscriptions can arrive with ids we
  // haven't stored yet: re-check every open subscription for that customer.
  if (!handled && event.email) {
    const subs = await store.listOpenSubscriptionsByEmail(provider.id, event.email);
    for (const sub of subs) await syncSubscription(sub);
  }
}

async function handleWebhook(providerId, rawBody, headers) {
  const provider = registry.getConfiguredProvider(providerId);
  if (!provider) throw new PaymentsError(404, 'Unknown payment provider');

  const event = await provider.verifyWebhook(rawBody, headers);
  if (!event) throw new PaymentsError(400, 'Invalid webhook signature');

  const eventId = event.eventId || sha256(rawBody);
  const isNew = await store.recordEvent(provider.id, eventId);
  if (!isNew) return { duplicate: true };

  try {
    await applyEvent(provider, event);
  } catch (err) {
    // Let the provider's retry process it again.
    await store.forgetEvent(provider.id, eventId).catch(() => {});
    throw err;
  }
  return { duplicate: false };
}

module.exports = {
  events,
  startCheckout,
  createCheckout,
  completePayment,
  syncSubscription,
  getActiveSubscription,
  getSubscriptionForUser,
  cancelSubscription,
  getManageUrl,
  handleWebhook,
  publicSubscription,
};
