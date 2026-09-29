'use strict';

const express = require('express');
const service = require('./service');
const registry = require('./registry');
const catalogue = require('./catalogue');
const { PaymentsError, isReference } = require('./util');
const { ProviderError } = require('./http');

let getUserFn = null;

function setGetUser(fn) {
  getUserFn = fn;
}

async function currentUser(req) {
  if (!getUserFn) throw new PaymentsError(500, 'attachPaymentRoutes(app, { getUser }) has not been called');
  const user = await getUserFn(req);
  if (!user || user.id === undefined || user.id === null || !user.email) return null;
  return { id: user.id, email: String(user.email) };
}

function sendError(res, err) {
  if (err instanceof PaymentsError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof ProviderError) {
    console.error(err.message);
    return res.status(502).json({ error: 'The payment provider could not complete the request. Please try again.' });
  }
  console.error('[payments] Unexpected error:', err);
  return res.status(500).json({ error: 'Payment request failed' });
}

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    sendError(res, err);
  }
};

function createWebhookRouter() {
  const router = express.Router();

  // Signatures are computed over the exact bytes received, so this route must
  // see the raw body — which is why attachPaymentWebhooks() runs before any
  // JSON parser is registered on the app.
  router.post('/:provider', express.raw({ type: '*/*', limit: '1mb' }), handle(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      console.error('[payments] Webhook body was already parsed. Call payments.attachPaymentWebhooks(app) BEFORE app.use(express.json()).');
      return res.status(500).json({ error: 'Webhook endpoint is misconfigured' });
    }
    await service.handleWebhook(req.params.provider, req.body, req.headers);
    res.json({ received: true });
  }));

  return router;
}

function createApiRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '100kb' }));

  const authed = (fn) => handle(async (req, res) => {
    const user = await currentUser(req);
    if (!user) throw new PaymentsError(401, 'Sign in to continue');
    await fn(req, res, user);
  });

  router.get('/providers', handle(async (req, res) => {
    res.json({ currency: registry.currency(), providers: registry.enabledProviders() });
  }));

  router.get('/plans', handle(async (req, res) => {
    res.json({ currency: registry.currency(), plans: catalogue.plans, products: catalogue.products });
  }));

  router.post('/checkout', authed(async (req, res, user) => {
    const { provider, planId, productId } = req.body || {};
    const result = await service.startCheckout({ providerId: provider, user, planId, productId });
    res.json(result);
  }));

  router.get('/subscription', authed(async (req, res, user) => {
    res.json({ subscription: await service.getSubscriptionForUser(user) });
  }));

  router.post('/subscription/cancel', authed(async (req, res, user) => {
    res.json({ subscription: await service.cancelSubscription(user, req.body?.subscriptionId) });
  }));

  router.get('/subscription/manage', authed(async (req, res, user) => {
    res.json({ url: await service.getManageUrl(user, req.query.subscriptionId) });
  }));

  router.post('/:reference/complete', authed(async (req, res, user) => {
    if (!isReference(req.params.reference)) throw new PaymentsError(404, 'Payment not found');
    res.json(await service.completePayment(req.params.reference, { userId: user.id }));
  }));

  return router;
}

module.exports = { createWebhookRouter, createApiRouter, setGetUser, currentUser, sendError };
