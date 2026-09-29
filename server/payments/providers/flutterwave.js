'use strict';

// Flutterwave v3 (hosted "Standard" checkout). Env: FLUTTERWAVE_SECRET_KEY,
// FLUTTERWAVE_SECRET_HASH (the secret hash entered in the Flutterwave
// dashboard, sent back on every webhook in the verif-hash header).
// Flutterwave amounts are in major units, unlike the rest of this module.

const { requestJson, ProviderError } = require('../http');
const { safeEqual, PaymentsError } = require('../util');
const { toMajor, fromMajor } = require('../money');

const API = 'https://api.flutterwave.com/v3';

const INTERVALS = {
  'day:1': 'daily',
  'week:1': 'weekly',
  'month:1': 'monthly',
  'month:3': 'quarterly',
  'month:6': 'bi-annually',
  'year:1': 'yearly',
};

function secretKey() {
  return process.env.FLUTTERWAVE_SECRET_KEY || '';
}

async function call(pathname, { method = 'GET', body } = {}) {
  const res = await requestJson('flutterwave', API + pathname, {
    method,
    body,
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  return res?.data;
}

function normaliseSubscription(s) {
  return {
    status: s.status === 'active' ? 'active' : s.status === 'cancelled' ? 'canceled' : 'pending',
    providerSubscriptionId: s.id,
    providerCustomerId: s.customer?.id ?? null,
    // v3 subscriptions don't report the next billing date.
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    providerData: null,
  };
}

async function startPayment({ reference, amount, currency, email, description, successUrl, paymentPlan }) {
  const data = await call('/payments', {
    method: 'POST',
    body: {
      tx_ref: reference,
      amount: toMajor(amount, currency),
      currency,
      redirect_url: successUrl,
      customer: { email },
      customizations: { title: description },
      meta: { reference },
      ...(paymentPlan ? { payment_plan: paymentPlan } : {}),
    },
  });
  return { providerRef: reference, redirectUrl: data.link };
}

module.exports = {
  id: 'flutterwave',
  label: 'Flutterwave',
  currencies: ['NGN', 'GHS', 'KES', 'ZAR', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF', 'USD', 'EUR', 'GBP'],

  isConfigured() {
    return Boolean(secretKey() && process.env.FLUTTERWAVE_SECRET_HASH);
  },

  mode() {
    return secretKey().startsWith('FLWSECK_TEST') ? 'test' : 'live';
  },

  // Flutterwave has no separate cancel URL: a cancelled payment returns to the
  // success URL with status=cancelled, and verification reports it as pending.
  createCheckout(options) {
    return startPayment(options);
  },

  async ensurePlan(plan, { currency }) {
    const interval = INTERVALS[`${plan.interval}:${plan.intervalCount}`];
    if (!interval) {
      throw new PaymentsError(400, `Flutterwave does not support billing every ${plan.intervalCount} ${plan.interval}(s)`);
    }
    const data = await call('/payment-plans', {
      method: 'POST',
      body: { name: plan.name, amount: toMajor(plan.amount, currency), interval, currency },
    });
    return String(data.id);
  },

  createSubscriptionCheckout({ plan, providerPlanId, ...options }) {
    return startPayment({ ...options, description: plan.name, paymentPlan: providerPlanId });
  },

  async completeCheckout(payment) {
    let data;
    try {
      data = await call(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(payment.provider_ref)}`);
    } catch (err) {
      // No transaction yet: the customer hasn't finished paying.
      if (err instanceof ProviderError && (err.status === 400 || err.status === 404)) return { status: 'pending' };
      throw err;
    }
    let status = 'pending';
    if (data.status === 'successful') status = 'paid';
    else if (data.status === 'failed') status = 'failed';

    return {
      status,
      amount: data.amount != null ? fromMajor(data.amount, data.currency) : null,
      currency: data.currency,
      providerCustomerId: data.customer?.id ?? null,
    };
  },

  async getSubscription(sub) {
    const params = new URLSearchParams({ email: sub.email });
    if (sub.provider_plan_id) params.set('plan', sub.provider_plan_id);
    const list = (await call(`/subscriptions?${params}`)) || [];
    const match = sub.provider_subscription_id
      ? list.find((s) => String(s.id) === String(sub.provider_subscription_id))
      : list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    return match ? normaliseSubscription(match) : null;
  },

  async cancelSubscription(sub) {
    await call(`/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}/cancel`, { method: 'PUT' });
  },

  async getManageUrl() {
    return null;
  },

  async verifyWebhook(rawBody, headers) {
    const expected = process.env.FLUTTERWAVE_SECRET_HASH;
    if (!expected || !safeEqual(headers['verif-hash'], expected)) return null;

    const event = JSON.parse(rawBody.toString('utf8'));
    const type = event.event || event['event.type'] || '';
    const data = event.data || event;
    const email = data.customer?.email || data.customer?.customer_email;
    const eventId = [type, data.id || data.tx_ref || data.txRef, data.status || ''].join(':');

    if (type.startsWith('subscription.')) {
      return { eventId, email };
    }
    if (type === 'charge.completed' || data.tx_ref || data.txRef) {
      // Renewal charges carry a Flutterwave-generated tx_ref, so they fall
      // through to the per-email subscription check.
      return { eventId, reference: data.tx_ref || data.txRef, email };
    }
    return { eventId };
  },
};
