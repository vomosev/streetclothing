'use strict';

// PayPal REST API (Orders v2 + Subscriptions v1). Env: PAYPAL_CLIENT_ID,
// PAYPAL_CLIENT_SECRET, PAYPAL_MODE (sandbox | live), PAYPAL_WEBHOOK_ID.
// Unlike the other providers, an approved PayPal order must be captured by
// the server before any money moves — completeCheckout() does that.

const crypto = require('crypto');
const { requestJson, ProviderError } = require('../http');
const { toMajorString, fromMajor } = require('../money');

// PayPal only accepts whole amounts in these currencies.
const WHOLE_AMOUNT_CURRENCIES = new Set(['HUF', 'JPY', 'TWD']);

const INTERVAL_UNITS = { day: 'DAY', week: 'WEEK', month: 'MONTH', year: 'YEAR' };

const SUBSCRIPTION_STATUS = {
  APPROVAL_PENDING: 'pending',
  APPROVED: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'past_due',
  CANCELLED: 'canceled',
  EXPIRED: 'expired',
};

let tokenCache = null;

function baseUrl() {
  return process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function money(amountMinor, currency) {
  const value = toMajorString(amountMinor, currency);
  return {
    currency_code: currency,
    value: WHOLE_AMOUNT_CURRENCIES.has(currency) ? String(Math.round(Number(value))) : value,
  };
}

// Request ids make retries of the same create/capture call safe.
function requestId(...parts) {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex');
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.token;
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const data = await requestJson('paypal', `${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
    form: { grant_type: 'client_credentials' },
  });
  tokenCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 0) * 1000 };
  return tokenCache.token;
}

async function call(pathname, { method = 'GET', body, headers = {} } = {}) {
  const token = await accessToken();
  return requestJson('paypal', baseUrl() + pathname, {
    method,
    body,
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
}

function approveLink(resource) {
  return (resource.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
}

function normaliseSubscription(s) {
  const next = s.billing_info?.next_billing_time;
  return {
    status: SUBSCRIPTION_STATUS[s.status] || 'pending',
    providerSubscriptionId: s.id,
    providerCustomerId: s.subscriber?.payer_id || null,
    currentPeriodEnd: next ? new Date(next) : null,
    cancelAtPeriodEnd: s.status === 'CANCELLED',
    providerData: null,
  };
}

function captureOutcome(order) {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (order.status === 'VOIDED') return { status: 'canceled' };
  if (order.status !== 'COMPLETED' || !capture) return { status: 'pending' };
  const status = capture.status === 'COMPLETED' ? 'paid'
    : ['DECLINED', 'FAILED'].includes(capture.status) ? 'failed'
      : 'pending';
  return {
    status,
    amount: fromMajor(capture.amount.value, capture.amount.currency_code),
    currency: capture.amount.currency_code,
  };
}

module.exports = {
  id: 'paypal',
  label: 'PayPal',
  currencies: [
    'AUD', 'BRL', 'CAD', 'CNY', 'CZK', 'DKK', 'EUR', 'HKD', 'HUF', 'ILS', 'JPY', 'MYR',
    'MXN', 'TWD', 'NZD', 'NOK', 'PHP', 'PLN', 'GBP', 'SGD', 'SEK', 'CHF', 'THB', 'USD',
  ],

  isConfigured() {
    return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  },

  mode() {
    return process.env.PAYPAL_MODE === 'live' ? 'live' : 'test';
  },

  async createCheckout({ reference, amount, currency, description, successUrl, cancelUrl }) {
    const order = await call('/v2/checkout/orders', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': requestId('order', reference) },
      body: {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: reference,
          custom_id: reference,
          description: String(description || 'Payment').slice(0, 127),
          amount: money(amount, currency),
        }],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: successUrl,
              cancel_url: cancelUrl,
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
            },
          },
        },
      },
    });
    return { providerRef: order.id, redirectUrl: approveLink(order) };
  },

  async ensurePlan(plan, { currency }) {
    const product = await call('/v1/catalogs/products', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': requestId('product', plan.key) },
      body: { name: plan.name, type: 'SERVICE' },
    });
    const created = await call('/v1/billing/plans', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': requestId('plan', plan.key) },
      body: {
        product_id: product.id,
        name: plan.name,
        billing_cycles: [{
          frequency: { interval_unit: INTERVAL_UNITS[plan.interval], interval_count: plan.intervalCount },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: money(plan.amount, currency) },
        }],
        payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
      },
    });
    return created.id;
  },

  async createSubscriptionCheckout({ reference, providerPlanId, email, successUrl, cancelUrl }) {
    const sub = await call('/v1/billing/subscriptions', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': requestId('subscription', reference) },
      body: {
        plan_id: providerPlanId,
        custom_id: reference,
        subscriber: { email_address: email },
        application_context: {
          return_url: successUrl,
          cancel_url: cancelUrl,
          user_action: 'SUBSCRIBE_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      },
    });
    return { providerRef: sub.id, providerSubscriptionId: sub.id, redirectUrl: approveLink(sub) };
  },

  async completeCheckout(payment) {
    if (payment.kind === 'subscription') {
      const sub = await call(`/v1/billing/subscriptions/${encodeURIComponent(payment.provider_ref)}`);
      const normalised = normaliseSubscription(sub);
      const status = normalised.status === 'active' ? 'paid'
        : ['canceled', 'expired'].includes(normalised.status) ? 'canceled'
          : 'pending';
      return { status, providerSubscriptionId: sub.id, providerCustomerId: normalised.providerCustomerId, subscription: normalised };
    }

    const orderPath = `/v2/checkout/orders/${encodeURIComponent(payment.provider_ref)}`;
    let order = await call(orderPath);
    if (order.status === 'APPROVED') {
      try {
        order = await call(`${orderPath}/capture`, {
          method: 'POST',
          headers: { 'PayPal-Request-Id': requestId('capture', payment.reference) },
          body: {},
        });
      } catch (err) {
        // 422 = already captured (e.g. by a concurrent webhook); re-read it.
        if (!(err instanceof ProviderError && err.status === 422)) throw err;
        order = await call(orderPath);
      }
    }
    return captureOutcome(order);
  },

  async getSubscription(sub) {
    if (!sub.provider_subscription_id) return null;
    return normaliseSubscription(await call(`/v1/billing/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`));
  },

  async cancelSubscription(sub) {
    await call(`/v1/billing/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}/cancel`, {
      method: 'POST',
      body: { reason: 'Cancelled by the customer' },
    });
  },

  // Subscribers manage PayPal subscriptions from their own PayPal account.
  async getManageUrl() {
    return null;
  },

  async verifyWebhook(rawBody, headers) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId || !headers['paypal-transmission-sig']) return null;

    const event = JSON.parse(rawBody.toString('utf8'));
    const result = await call('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: event,
      },
    });
    if (result?.verification_status !== 'SUCCESS') return null;

    const type = event.event_type || '';
    const resource = event.resource || {};

    if (type === 'CHECKOUT.ORDER.APPROVED' || type === 'CHECKOUT.ORDER.COMPLETED') {
      return { eventId: event.id, providerRef: resource.id };
    }
    if (type.startsWith('PAYMENT.CAPTURE.')) {
      return { eventId: event.id, providerRef: resource.supplementary_data?.related_ids?.order_id };
    }
    if (type.startsWith('BILLING.SUBSCRIPTION.')) {
      return { eventId: event.id, providerSubscriptionId: resource.id };
    }
    if (type.startsWith('PAYMENT.SALE.')) {
      return { eventId: event.id, providerSubscriptionId: resource.billing_agreement_id };
    }
    return { eventId: event.id };
  },
};
