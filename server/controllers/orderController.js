'use strict';

const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { getUserFromSession } = require('../middleware/auth');
const payments = require('../payments');

const MAX_QTY = 10;

function normaliseItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const map = new Map();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const productId = Number(raw.productId);
    if (!Number.isInteger(productId) || productId <= 0) continue;
    let quantity = Number(raw.quantity);
    if (!Number.isFinite(quantity)) quantity = 1;
    quantity = Math.max(1, Math.min(MAX_QTY, Math.floor(quantity)));
    const sizeLabel =
      typeof raw.sizeLabel === 'string' && raw.sizeLabel.trim()
        ? raw.sizeLabel.trim().slice(0, 16)
        : 'OS';
    const key = `${productId}::${sizeLabel}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity);
    } else {
      map.set(key, { productId, sizeLabel, quantity });
    }
  }
  return Array.from(map.values());
}

function buildReference(orderId) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SP-${Date.now().toString(36).toUpperCase()}-${orderId}-${random}`;
}

/**
 * POST /api/orders/checkout
 * Body: { provider, items: [{ productId, sizeLabel, quantity }] }
 * The total is always recomputed from the database — the browser total is ignored.
 */
const createCartCheckout = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const provider = typeof body.provider === 'string' ? body.provider.trim() : '';

  if (!provider) {
    return res.status(400).json({ error: 'A payment provider is required' });
  }

  const items = normaliseItems(body.items);
  if (items.length === 0) {
    return res.status(400).json({ error: 'Your bag is empty' });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: 'Too many items in one order' });
  }

  const ids = Array.from(new Set(items.map((item) => item.productId)));
  const placeholders = ids.map(() => '?').join(', ');

  const [rows] = await pool.query(
    `SELECT id, slug, name, price_cents, in_stock
       FROM products
      WHERE id IN (${placeholders})`,
    ids
  );

  const products = new Map(rows.map((row) => [Number(row.id), row]));

  const lineItems = [];
  let totalCents = 0;

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) {
      return res
        .status(400)
        .json({ error: `A piece in your bag is no longer available` });
    }
    if (!product.in_stock) {
      return res.status(400).json({ error: `${product.name} is sold out` });
    }
    const unitPriceCents = Number(product.price_cents) || 0;
    if (unitPriceCents <= 0) {
      return res.status(400).json({ error: `${product.name} cannot be purchased right now` });
    }
    totalCents += unitPriceCents * item.quantity;
    lineItems.push({
      productId: item.productId,
      name: product.name,
      sizeLabel: item.sizeLabel,
      quantity: item.quantity,
      unitPriceCents,
    });
  }

  if (totalCents <= 0) {
    return res.status(400).json({ error: 'Order total must be greater than zero' });
  }

  const user = getUserFromSession(req);

  const connection = await pool.getConnection();
  let orderId;
  let reference;

  try {
    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, reference, status, total_cents, currency)
       VALUES (?, ?, 'pending', ?, 'USD')`,
      [user ? user.id : null, `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, totalCents]
    );

    orderId = orderResult.insertId;
    reference = buildReference(orderId);

    await connection.query('UPDATE orders SET reference = ? WHERE id = ?', [reference, orderId]);

    const values = lineItems.map((line) => [
      orderId,
      line.productId,
      line.sizeLabel,
      line.quantity,
      line.unitPriceCents,
    ]);

    await connection.query(
      `INSERT INTO order_items (order_id, product_id, size_label, quantity, unit_price_cents)
       VALUES ?`,
      [values]
    );

    await connection.commit();
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error('[orders] rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    connection.release();
  }

  const totalUnits = lineItems.reduce((sum, line) => sum + line.quantity, 0);
  const description = `STREET/PLATINUM order ${reference} — ${totalUnits} item${
    totalUnits === 1 ? '' : 's'
  }`;

  try {
    const checkout = await payments.createCheckout({
      provider,
      user: user ? { id: user.id, email: user.email } : null,
      amount: totalCents,
      description,
      itemId: `order:${orderId}`,
    });

    const paymentReference = checkout && checkout.reference ? checkout.reference : reference;
    const redirectUrl = checkout ? checkout.redirectUrl : null;

    if (paymentReference && paymentReference !== reference) {
      try {
        await pool.query('UPDATE orders SET reference = ? WHERE id = ?', [paymentReference, orderId]);
      } catch (updateErr) {
        console.error('[orders] could not sync payment reference:', updateErr.message);
      }
    }

    if (!redirectUrl) {
      return res.status(502).json({ error: 'The payment provider did not return a checkout link' });
    }

    return res.status(201).json({
      reference: paymentReference,
      redirectUrl,
      orderId,
      totalCents,
      currency: 'USD',
    });
  } catch (err) {
    try {
      await pool.query("UPDATE orders SET status = 'failed' WHERE id = ?", [orderId]);
    } catch (markErr) {
      console.error('[orders] could not mark order failed:', markErr.message);
    }
    const status = err && err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    const message =
      (err && err.message) || 'Could not start checkout with that payment provider';
    return res.status(status).json({ error: message });
  }
});

/**
 * Marks an order as paid. Accepts either the stored order reference or an
 * itemId of the form `order:<id>`.
 */
async function markOrderPaid(referenceOrItemId, userId) {
  if (!referenceOrItemId) return null;

  const value = String(referenceOrItemId);
  let where = 'reference = ?';
  let param = value;

  if (value.startsWith('order:')) {
    const id = Number(value.slice('order:'.length));
    if (!Number.isInteger(id) || id <= 0) return null;
    where = 'id = ?';
    param = id;
  }

  try {
    if (userId) {
      await pool.query(
        `UPDATE orders SET user_id = COALESCE(user_id, ?) WHERE ${where}`,
        [userId, param]
      );
    }
    const [result] = await pool.query(
      `UPDATE orders SET status = 'paid' WHERE ${where} AND status <> 'paid'`,
      [param]
    );
    return { updated: result.affectedRows > 0 };
  } catch (err) {
    console.error('[orders] markOrderPaid failed:', err.message);
    return null;
  }
}

/**
 * GET /api/orders — signed-in user's orders with their items.
 */
const listOrders = asyncHandler(async (req, res) => {
  const user = getUserFromSession(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const [orders] = await pool.query(
    `SELECT id, reference, status, total_cents, currency, created_at
       FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 100`,
    [user.id]
  );

  if (orders.length === 0) {
    return res.json({ orders: [] });
  }

  const orderIds = orders.map((order) => order.id);
  const placeholders = orderIds.map(() => '?').join(', ');

  const [items] = await pool.query(
    `SELECT oi.order_id, oi.product_id, oi.size_label, oi.quantity, oi.unit_price_cents,
            p.name, p.slug, p.colorway, p.accent_hex
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id IN (${placeholders})
      ORDER BY oi.id ASC`,
    orderIds
  );

  const grouped = new Map(orderIds.map((id) => [Number(id), []]));
  for (const item of items) {
    const bucket = grouped.get(Number(item.order_id));
    if (!bucket) continue;
    bucket.push({
      productId: item.product_id,
      slug: item.slug || null,
      name: item.name || 'Archived piece',
      colorway: item.colorway || null,
      accentHex: item.accent_hex || null,
      sizeLabel: item.size_label,
      quantity: Number(item.quantity),
      unitPriceCents: Number(item.unit_price_cents),
    });
  }

  return res.json({
    orders: orders.map((order) => ({
      id: order.id,
      reference: order.reference,
      status: order.status,
      totalCents: Number(order.total_cents),
      currency: order.currency || 'USD',
      createdAt: order.created_at,
      items: grouped.get(Number(order.id)) || [],
    })),
  });
});

module.exports = { createCartCheckout, markOrderPaid, listOrders };