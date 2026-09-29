'use strict';

// Loads and validates plans.js — the only file in this folder written per app.

const INTERVALS = new Set(['day', 'week', 'month', 'year']);
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function loadRaw() {
  try {
    return require('./plans');
  } catch (err) {
    console.error(`[payments] Could not load server/payments/plans.js: ${err.message}`);
    return {};
  }
}

function validateItem(item, kind, seen) {
  const problems = [];
  if (!item || typeof item !== 'object') return ['is not an object'];
  if (!ID_PATTERN.test(String(item.id || ''))) problems.push('needs an id of letters, numbers, "-" or "_"');
  if (seen.has(item.id)) problems.push(`duplicates id "${item.id}"`);
  if (!item.name || typeof item.name !== 'string') problems.push('needs a name');
  if (!Number.isInteger(item.amount) || item.amount <= 0) problems.push('needs a positive whole-number amount in the smallest currency unit');
  if (kind === 'plan') {
    if (!INTERVALS.has(item.interval)) problems.push(`needs interval "day", "week", "month" or "year"`);
    const count = item.intervalCount ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 12) problems.push('intervalCount must be a whole number from 1 to 12');
  }
  return problems;
}

function normalise(list, kind) {
  const seen = new Set();
  const valid = [];
  (Array.isArray(list) ? list : []).forEach((item, index) => {
    const problems = validateItem(item, kind, seen);
    if (problems.length) {
      console.error(`[payments] Skipping ${kind} #${index + 1} (${item?.id || 'no id'}) in plans.js: ${problems.join('; ')}`);
      return;
    }
    seen.add(item.id);
    valid.push({
      id: item.id,
      name: item.name,
      description: typeof item.description === 'string' ? item.description : '',
      amount: item.amount,
      features: Array.isArray(item.features) ? item.features.map(String) : [],
      ...(kind === 'plan' ? { interval: item.interval, intervalCount: item.intervalCount ?? 1 } : {}),
    });
  });
  return valid;
}

const raw = loadRaw();
const plans = normalise(raw.plans, 'plan');
const products = normalise(raw.products, 'product');

function getPlan(id) {
  return plans.find((p) => p.id === id) || null;
}

function getProduct(id) {
  return products.find((p) => p.id === id) || null;
}

module.exports = { plans, products, getPlan, getProduct };
