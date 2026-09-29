'use strict';

// Loads the providers chosen for this app (config.json, written by the builder).
// Adding a provider = a new file in providers/ plus its id in config.json.

const config = require('./config.json');
const { PaymentsError } = require('./util');

const PROVIDERS = {};
for (const id of config.providers || []) {
  if (!/^[a-z0-9-]+$/.test(id)) continue;
  try {
    PROVIDERS[id] = require(`./providers/${id}`);
  } catch (err) {
    console.error(`[payments] Could not load provider "${id}": ${err.message}`);
  }
}

function currency() {
  return String(process.env.PAYMENTS_CURRENCY || config.currency || 'USD').toUpperCase();
}

function supportsCurrency(provider, code) {
  return !provider.currencies || provider.currencies.includes(code);
}

function isUsable(provider) {
  return Boolean(provider && provider.isConfigured() && supportsCurrency(provider, currency()));
}

// For checkouts: the provider must exist, have keys and support the currency.
function getProvider(id) {
  const provider = PROVIDERS[id];
  if (!provider) throw new PaymentsError(400, `Unknown payment provider "${id}"`);
  if (!provider.isConfigured()) throw new PaymentsError(503, `${provider.label} payments are not set up for this app yet`);
  if (!supportsCurrency(provider, currency())) throw new PaymentsError(400, `${provider.label} does not support ${currency()}`);
  return provider;
}

// For webhooks and syncing existing records: only needs keys.
function getConfiguredProvider(id) {
  const provider = PROVIDERS[id];
  return provider && provider.isConfigured() ? provider : null;
}

function enabledProviders() {
  return Object.values(PROVIDERS)
    .filter(isUsable)
    .map((p) => ({ id: p.id, label: p.label, mode: p.mode() }));
}

module.exports = { currency, getProvider, getConfiguredProvider, enabledProviders };
