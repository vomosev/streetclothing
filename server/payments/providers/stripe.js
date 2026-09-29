'use strict';

// Stripe via its REST API (hosted Checkout). Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.

const crypto = require('crypto');
const { requestJson } = require('../http');
const { safeEqual } = require('../util');

const API = 'https://api.stripe.com/v1';
const WEBHOOK_TOLERANCE_SECONDS = 300;

const SUBSCRIPTION_STATUS = {
  active: 'active',
  trialing: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  paused: 'past_due',
  incomplete: 'pending',
  incomplete_expired: 'expired',
  canceled: 'canceled',
};

function secretKey() {
  return process.env.STRIPE_SECRET_KEY || '';
}

// Stripe takes nested form fields: line_items[0][price_data][currency]=usd
function encodeForm(value, prefix = '', out = new URLSearchParams()) {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => encodeForm(item, `${prefix}[${i}]`, out));
  } else if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => encodeForm(item, prefix ? `${prefix}[${key}]` : key, out));
  } else {
    out.append(prefix, String(value));
  }
  return out;
}

function call(pathname, { method = 'GET', params } = {}) {
  const url = new URL(API + pathname);
  const options = { method, headers: { Authorization: `Bearer ${secretKey()}` } };
  if (params) {
    const encoded = encodeForm(params).toString();
    if (method === 'GET') url.search = encoded;
    else options.form = encoded;
  }
  return requestJson('stripe', url.toString(), options);
}

function idOf(value) {
  return value && typeof value === 'object' ? value.id : value || null;
}

function normaliseSubscription(sub) {
  // Newer API versions moved current_period_end from the subscription onto its items.
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return {
    status: SUBSCRIPTION_STATUS[sub.status] || 'pending',
    providerSubscriptionId: sub.id,
    providerCustomerId: idOf(sub.customer),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    providerData: null,
  };
}

module.exports = {
  id: 'stripe',
  label: 'Stripe',
  currencies: null, // Stripe accepts most currencies; see its dashboard for limits

  isConfigured() {
    return Boolean(secretKey());
  },

  mode() {
    return secretKey().startsWith('sk_live_') ? 'live' : 'test';
  },

  async createCheckout({ reference, amount, currency, email, description, successUrl, cancelUrl }) {
    const session = await call('/checkout/sessions', {
      method: 'POST',
      params: {
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: reference,
        customer_email: email,
        line_items: [{
          quantity: 1,
          price_data: { currency: currency.toLowerCase(), unit_amount: amount, product_data: { name: description } },
        }],
        metadata: { reference },
        payment_intent_data: { metadata: { reference } },
      },
    });
    return { providerRef: session.id, redirectUrl: session.url };
  },

  async ensurePlan(plan, { currency }) {
    const found = await call('/prices', { params: { lookup_keys: [plan.key], active: 'true', limit: 1 } });
    if (found.data?.[0]) return found.data[0].id;

    const price = await call('/prices', {
      method: 'POST',
      params: {
        currency: currency.toLowerCase(),
        unit_amount: plan.amount,
        recurring: { interval: plan.interval, interval_count: plan.intervalCount },
        product_data: { name: plan.name },
        lookup_key: plan.key,
        metadata: { plan_id: plan.id },
      },
    });
    return price.id;
  },

  async createSubscriptionCheckout({ reference, providerPlanId, email, successUrl, cancelUrl }) {
    const session = await call('/checkout/sessions', {
      method: 'POST',
      params: {
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: reference,
        customer_email: email,
        line_items: [{ price: providerPlanId, quantity: 1 }],
        metadata: { reference },
        subscription_data: { metadata: { reference } },
      },
    });
    return { providerRef: session.id, redirectUrl: session.url };
  },

  async completeCheckout(payment) {
    const session = await call(`/checkout/sessions/${encodeURIComponent(payment.provider_ref)}`, {
      params: { expand: ['subscription'] },
    });
    let status = 'pending';
    if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') status = 'paid';
    else if (session.status === 'expired') status = 'canceled';

    const subscription = session.subscription && typeof session.subscription === 'object'
      ? normaliseSubscription(session.subscription)
      : null;

    return {
      status,
      amount: session.amount_total,
      currency: session.currency ? session.currency.toUpperCase() : null,
      providerCustomerId: idOf(session.customer),
      providerSubscriptionId: subscription ? subscription.providerSubscriptionId : idOf(session.subscription),
      subscription,
    };
  },

  async getSubscription(sub) {
    if (!sub.provider_subscription_id) return null;
    return normaliseSubscription(await call(`/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`));
  },

  async cancelSubscription(sub) {
    await call(`/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`, {
      method: 'POST',
      params: { cancel_at_period_end: 'true' },
    });
  },

  // Needs the Customer Portal to have been saved once in the Stripe dashboard.
  async getManageUrl(sub, returnUrl) {
    if (!sub.provider_customer_id) return null;
    const session = await call('/billing_portal/sessions', {
      method: 'POST',
      params: { customer: sub.provider_customer_id, return_url: returnUrl },
    });
    return session.url || null;
  },

  async verifyWebhook(rawBody, headers) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const header = headers['stripe-signature'];
    if (!secret || !header) return null;

    const parts = header.split(',').map((p) => p.split('='));
    const timestamp = parts.find(([k]) => k === 't')?.[1];
    const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
    if (!timestamp || !signatures.length) return null;
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return null;

    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
    if (!signatures.some((sig) => safeEqual(sig, expected))) return null;

    const event = JSON.parse(rawBody.toString('utf8'));
    const obj = event.data?.object || {};

    if (event.type?.startsWith('checkout.session.')) {
      return { eventId: event.id, reference: obj.client_reference_id || obj.metadata?.reference, providerRef: obj.id };
    }
    if (event.type?.startsWith('customer.subscription.')) {
      return { eventId: event.id, providerSubscriptionId: obj.id };
    }
    if (event.type?.startsWith('invoice.')) {
      // Newer API versions nest the subscription under invoice.parent.
      const subId = idOf(obj.subscription) || idOf(obj.parent?.subscription_details?.subscription);
      return { eventId: event.id, providerSubscriptionId: subId || undefined };
    }
    return { eventId: event.id };
  },
};
