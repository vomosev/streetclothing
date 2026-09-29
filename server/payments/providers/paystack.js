'use strict';

// Paystack via its REST API (hosted checkout). Env: PAYSTACK_SECRET_KEY.
// Webhooks are signed with the secret key itself; the webhook URL is set in
// the Paystack dashboard (one per account and mode).

const crypto = require('crypto');
const { requestJson, ProviderError } = require('../http');
const { safeEqual, PaymentsError } = require('../util');

const API = 'https://api.paystack.co';

const INTERVALS = {
  'day:1': 'daily',
  'week:1': 'weekly',
  'month:1': 'monthly',
  'month:3': 'quarterly',
  'month:6': 'biannually',
  'year:1': 'annually',
};

const SUBSCRIPTION_STATUS = {
  active: 'active',
  'non-renewing': 'active',
  attention: 'past_due',
  completed: 'expired',
  cancelled: 'canceled',
};

function secretKey() {
  return process.env.PAYSTACK_SECRET_KEY || '';
}

async function call(pathname, { method = 'GET', body } = {}) {
  const res = await requestJson('paystack', API + pathname, {
    method,
    body,
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  return res?.data;
}

function planCode(plan) {
  return plan && typeof plan === 'object' ? plan.plan_code : plan;
}

function normaliseSubscription(s) {
  return {
    status: SUBSCRIPTION_STATUS[s.status] || 'pending',
    providerSubscriptionId: s.subscription_code,
    providerCustomerId: s.customer?.id ?? s.customer ?? null,
    currentPeriodEnd: s.next_payment_date ? new Date(s.next_payment_date) : null,
    cancelAtPeriodEnd: s.status === 'non-renewing',
    providerData: s.email_token ? { email_token: s.email_token } : null,
  };
}

module.exports = {
  id: 'paystack',
  label: 'Paystack',
  currencies: ['NGN', 'GHS', 'ZAR', 'KES', 'USD'],

  isConfigured() {
    return Boolean(secretKey());
  },

  mode() {
    return secretKey().startsWith('sk_live_') ? 'live' : 'test';
  },

  async createCheckout({ reference, amount, currency, email, successUrl, cancelUrl }) {
    const data = await call('/transaction/initialize', {
      method: 'POST',
      body: {
        email,
        amount, // Paystack amounts are already in the subunit
        currency,
        reference,
        callback_url: successUrl,
        metadata: { reference, cancel_action: cancelUrl },
      },
    });
    return { providerRef: data.reference || reference, redirectUrl: data.authorization_url };
  },

  async ensurePlan(plan, { currency }) {
    const interval = INTERVALS[`${plan.interval}:${plan.intervalCount}`];
    if (!interval) {
      throw new PaymentsError(400, `Paystack does not support billing every ${plan.intervalCount} ${plan.interval}(s)`);
    }
    const data = await call('/plan', {
      method: 'POST',
      body: { name: plan.name, amount: plan.amount, interval, currency, description: plan.key },
    });
    return data.plan_code;
  },

  async createSubscriptionCheckout({ reference, providerPlanId, amount, currency, email, successUrl, cancelUrl }) {
    const data = await call('/transaction/initialize', {
      method: 'POST',
      body: {
        email,
        amount, // required by the API; the plan's amount is what is charged
        currency,
        plan: providerPlanId,
        reference,
        callback_url: successUrl,
        metadata: { reference, cancel_action: cancelUrl },
      },
    });
    return { providerRef: data.reference || reference, redirectUrl: data.authorization_url };
  },

  async completeCheckout(payment) {
    let data;
    try {
      data = await call(`/transaction/verify/${encodeURIComponent(payment.provider_ref)}`);
    } catch (err) {
      if (err instanceof ProviderError && (err.status === 400 || err.status === 404)) return { status: 'pending' };
      throw err;
    }
    let status = 'pending';
    if (data.status === 'success') status = 'paid';
    else if (data.status === 'failed' || data.status === 'reversed') status = 'failed';

    return {
      status,
      amount: data.amount,
      currency: data.currency,
      providerCustomerId: data.customer?.id ?? null,
    };
  },

  async getSubscription(sub) {
    let s = null;
    if (sub.provider_subscription_id) {
      s = await call(`/subscription/${encodeURIComponent(sub.provider_subscription_id)}`);
    } else if (sub.provider_customer_id) {
      // Paystack creates the subscription shortly after the first charge.
      const list = await call(`/subscription?customer=${encodeURIComponent(sub.provider_customer_id)}&perPage=100`);
      s = (list || [])
        .filter((item) => planCode(item.plan) === sub.provider_plan_id)
        .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))[0] || null;
    }
    return s ? normaliseSubscription(s) : null;
  },

  async cancelSubscription(sub) {
    const s = await call(`/subscription/${encodeURIComponent(sub.provider_subscription_id)}`);
    await call('/subscription/disable', {
      method: 'POST',
      body: { code: s.subscription_code, token: s.email_token },
    });
  },

  async getManageUrl(sub) {
    if (!sub.provider_subscription_id) return null;
    const data = await call(`/subscription/${encodeURIComponent(sub.provider_subscription_id)}/manage/link`);
    return data?.link || null;
  },

  async verifyWebhook(rawBody, headers) {
    const signature = headers['x-paystack-signature'];
    if (!secretKey() || !signature) return null;
    const expected = crypto.createHmac('sha512', secretKey()).update(rawBody).digest('hex');
    if (!safeEqual(signature, expected)) return null;

    const event = JSON.parse(rawBody.toString('utf8'));
    const data = event.data || {};
    const email = data.customer?.email;
    // Paystack events carry no id of their own.
    const eventId = [event.event, data.reference || data.invoice_code || data.subscription_code || data.id, data.status || ''].join(':');

    if (event.event === 'charge.success') {
      return { eventId, reference: data.reference, email };
    }
    if (event.event?.startsWith('subscription.')) {
      return { eventId, providerSubscriptionId: data.subscription_code, email };
    }
    if (event.event?.startsWith('invoice.')) {
      return { eventId, providerSubscriptionId: data.subscription?.subscription_code, email };
    }
    return { eventId };
  },
};
