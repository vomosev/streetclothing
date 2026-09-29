'use strict';

// MySQL persistence for payments. Tables are created on first use, so the
// module works without any step in the app's own schema.sql.

const { pool } = require('../config/db');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS payments (
    reference        VARCHAR(64)  NOT NULL PRIMARY KEY,
    kind             VARCHAR(16)  NOT NULL,
    provider         VARCHAR(32)  NOT NULL,
    provider_ref     VARCHAR(191) NULL,
    user_id          VARCHAR(191) NOT NULL,
    email            VARCHAR(191) NOT NULL,
    item_id          VARCHAR(191) NULL,
    description      VARCHAR(255) NULL,
    amount           BIGINT       NOT NULL,
    currency         CHAR(3)      NOT NULL,
    status           VARCHAR(16)  NOT NULL DEFAULT 'pending',
    failure_reason   VARCHAR(255) NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payments_provider_ref (provider, provider_ref),
    INDEX idx_payments_user (user_id),
    INDEX idx_payments_status (status, created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id                        BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id                   VARCHAR(191) NOT NULL,
    email                     VARCHAR(191) NOT NULL,
    provider                  VARCHAR(32)  NOT NULL,
    plan_id                   VARCHAR(191) NOT NULL,
    initial_reference         VARCHAR(64)  NOT NULL,
    provider_plan_id          VARCHAR(191) NULL,
    provider_subscription_id  VARCHAR(191) NULL,
    provider_customer_id      VARCHAR(191) NULL,
    status                    VARCHAR(16)  NOT NULL DEFAULT 'pending',
    current_period_end        DATETIME     NULL,
    cancel_at_period_end      TINYINT(1)   NOT NULL DEFAULT 0,
    provider_data             TEXT         NULL,
    last_synced_at            DATETIME     NULL,
    created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subscriptions_user (user_id),
    INDEX idx_subscriptions_provider_id (provider, provider_subscription_id),
    INDEX idx_subscriptions_email (provider, email),
    INDEX idx_subscriptions_initial (initial_reference)
  )`,
  `CREATE TABLE IF NOT EXISTS payment_plans (
    provider          VARCHAR(32)  NOT NULL,
    plan_key          VARCHAR(191) NOT NULL,
    provider_plan_id  VARCHAR(191) NOT NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider, plan_key)
  )`,
  `CREATE TABLE IF NOT EXISTS payment_events (
    provider     VARCHAR(32)  NOT NULL,
    event_id     VARCHAR(191) NOT NULL,
    received_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider, event_id)
  )`,
];

const PAYMENT_COLUMNS = new Set(['provider_ref', 'status', 'failure_reason']);
const SUBSCRIPTION_COLUMNS = new Set([
  'provider_plan_id', 'provider_subscription_id', 'provider_customer_id', 'status',
  'current_period_end', 'cancel_at_period_end', 'provider_data', 'last_synced_at',
]);

let tablesReady = null;

function ensureTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      for (const sql of TABLES) await pool.query(sql);
    })().catch((err) => {
      tablesReady = null; // retry on the next call
      throw err;
    });
  }
  return tablesReady;
}

async function query(sql, params = []) {
  await ensureTables();
  const [rows] = await pool.query(sql, params);
  return rows;
}

function buildSet(fields, allowed) {
  const entries = Object.entries(fields).filter(([key, value]) => allowed.has(key) && value !== undefined);
  if (!entries.length) return null;
  return {
    clause: entries.map(([key]) => `${key} = ?`).join(', '),
    values: entries.map(([, value]) => value),
  };
}

// ── payments ──────────────────────────────────────────────

async function insertPayment(p) {
  await query(
    `INSERT INTO payments (reference, kind, provider, user_id, email, item_id, description, amount, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.reference, p.kind, p.provider, String(p.userId), p.email, p.itemId || null, p.description || null, p.amount, p.currency]
  );
}

async function getPayment(reference) {
  const rows = await query('SELECT * FROM payments WHERE reference = ?', [reference]);
  return rows[0] || null;
}

async function findPaymentByProviderRef(provider, providerRef) {
  const rows = await query(
    'SELECT * FROM payments WHERE provider = ? AND provider_ref = ? ORDER BY created_at DESC LIMIT 1',
    [provider, String(providerRef)]
  );
  return rows[0] || null;
}

async function updatePayment(reference, fields) {
  const set = buildSet(fields, PAYMENT_COLUMNS);
  if (!set) return;
  await query(`UPDATE payments SET ${set.clause} WHERE reference = ?`, [...set.values, reference]);
}

// Changes status only if it is still `fromStatus`, so a webhook and the return
// page completing the same payment at once can't both fire payment.succeeded.
async function transitionPayment(reference, fromStatus, fields) {
  const set = buildSet(fields, PAYMENT_COLUMNS);
  if (!set) return false;
  const result = await query(
    `UPDATE payments SET ${set.clause} WHERE reference = ? AND status = ?`,
    [...set.values, reference, fromStatus]
  );
  return result.affectedRows > 0;
}

async function listPendingPayments({ olderThanMinutes, newerThanHours, limit = 200 }) {
  return query(
    `SELECT * FROM payments
     WHERE status = 'pending' AND provider_ref IS NOT NULL
       AND created_at < (NOW() - INTERVAL ? MINUTE)
       AND created_at > (NOW() - INTERVAL ? HOUR)
     ORDER BY created_at ASC LIMIT ?`,
    [olderThanMinutes, newerThanHours, limit]
  );
}

async function expireStalePayments(olderThanHours) {
  await query(
    `UPDATE payments SET status = 'canceled', failure_reason = 'Checkout was not completed'
     WHERE status = 'pending' AND created_at < (NOW() - INTERVAL ? HOUR)`,
    [olderThanHours]
  );
  await query(
    `UPDATE subscriptions s JOIN payments p ON p.reference = s.initial_reference
     SET s.status = 'expired'
     WHERE s.status = 'pending' AND p.status IN ('canceled', 'failed')`
  );
}

// ── subscriptions ─────────────────────────────────────────

async function insertSubscription(s) {
  const result = await query(
    `INSERT INTO subscriptions
       (user_id, email, provider, plan_id, initial_reference, provider_plan_id, provider_subscription_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [String(s.userId), s.email, s.provider, s.planId, s.initialReference, s.providerPlanId || null, s.providerSubscriptionId || null]
  );
  return result.insertId;
}

async function getSubscription(id) {
  const rows = await query('SELECT * FROM subscriptions WHERE id = ?', [id]);
  return rows[0] || null;
}

async function findSubscriptionByInitialReference(reference) {
  const rows = await query('SELECT * FROM subscriptions WHERE initial_reference = ? LIMIT 1', [reference]);
  return rows[0] || null;
}

async function findSubscriptionByProviderId(provider, providerSubscriptionId) {
  const rows = await query(
    'SELECT * FROM subscriptions WHERE provider = ? AND provider_subscription_id = ? LIMIT 1',
    [provider, String(providerSubscriptionId)]
  );
  return rows[0] || null;
}

async function listOpenSubscriptionsByEmail(provider, email) {
  return query(
    `SELECT * FROM subscriptions
     WHERE provider = ? AND email = ? AND status IN ('pending', 'active', 'past_due')`,
    [provider, email]
  );
}

async function listSubscriptionsForUser(userId) {
  return query(
    `SELECT * FROM subscriptions WHERE user_id = ? AND status <> 'expired' ORDER BY created_at DESC`,
    [String(userId)]
  );
}

// A subscription grants access while active or past due (the provider is still
// retrying the charge), and after cancellation until the paid period runs out.
async function findAccessSubscription(userId, planIds) {
  const planFilter = planIds && planIds.length ? `AND plan_id IN (${planIds.map(() => '?').join(', ')})` : '';
  const rows = await query(
    `SELECT * FROM subscriptions
     WHERE user_id = ?
       AND (status IN ('active', 'past_due') OR (status = 'canceled' AND current_period_end > NOW()))
       ${planFilter}
     ORDER BY (status = 'active') DESC, current_period_end DESC
     LIMIT 1`,
    [String(userId), ...(planIds || [])]
  );
  return rows[0] || null;
}

async function updateSubscription(id, fields) {
  const set = buildSet(fields, SUBSCRIPTION_COLUMNS);
  if (!set) return;
  await query(`UPDATE subscriptions SET ${set.clause} WHERE id = ?`, [...set.values, id]);
}

async function listSubscriptionsToReconcile(limit = 200) {
  return query(
    `SELECT s.* FROM subscriptions s
     LEFT JOIN payments p ON p.reference = s.initial_reference
     WHERE s.status IN ('pending', 'active', 'past_due')
       AND (s.status <> 'pending' OR p.status = 'paid')
       AND (s.last_synced_at IS NULL
            OR s.last_synced_at < (NOW() - INTERVAL 1 DAY)
            OR (s.current_period_end IS NOT NULL AND s.current_period_end < NOW()))
     ORDER BY s.last_synced_at ASC
     LIMIT ?`,
    [limit]
  );
}

// ── plan cache + webhook de-duplication ───────────────────

async function getCachedPlan(provider, planKey) {
  const rows = await query('SELECT provider_plan_id FROM payment_plans WHERE provider = ? AND plan_key = ?', [provider, planKey]);
  return rows[0]?.provider_plan_id || null;
}

async function cachePlan(provider, planKey, providerPlanId) {
  await query(
    `INSERT INTO payment_plans (provider, plan_key, provider_plan_id) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE provider_plan_id = VALUES(provider_plan_id)`,
    [provider, planKey, String(providerPlanId)]
  );
}

// Returns false when the event was already recorded (a provider retry).
async function recordEvent(provider, eventId) {
  const result = await query('INSERT IGNORE INTO payment_events (provider, event_id) VALUES (?, ?)', [provider, String(eventId).slice(0, 191)]);
  return result.affectedRows > 0;
}

async function forgetEvent(provider, eventId) {
  await query('DELETE FROM payment_events WHERE provider = ? AND event_id = ?', [provider, String(eventId).slice(0, 191)]);
}

module.exports = {
  ensureTables,
  insertPayment, getPayment, findPaymentByProviderRef, updatePayment, transitionPayment,
  listPendingPayments, expireStalePayments,
  insertSubscription, getSubscription, findSubscriptionByInitialReference, findSubscriptionByProviderId,
  listOpenSubscriptionsByEmail, listSubscriptionsForUser, findAccessSubscription, updateSubscription,
  listSubscriptionsToReconcile,
  getCachedPlan, cachePlan, recordEvent, forgetEvent,
};
