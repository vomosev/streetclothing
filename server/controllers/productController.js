'use strict';

const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

const VALID_CATEGORIES = ['tees', 'hoodies', 'outerwear', 'pants', 'accessories'];

function titleCase(value) {
  if (!value) return '';
  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function mapProductRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || '',
    description: row.description || '',
    priceCents: Number(row.price_cents) || 0,
    category: row.category || '',
    dropName: row.drop_name || '',
    colorway: row.colorway || '',
    accentHex: row.accent_hex || '#C7CAD1',
    inStock: Number(row.in_stock) === 1,
    featured: Number(row.featured) === 1,
    createdAt: row.created_at || null,
    sizes: [],
  };
}

async function attachSizes(products) {
  if (!products.length) return products;
  const ids = products.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const [sizeRows] = await pool.query(
    `SELECT id, product_id, label, stock
       FROM product_sizes
      WHERE product_id IN (${placeholders})
      ORDER BY id ASC`,
    ids
  );

  const byProduct = new Map();
  for (const row of sizeRows) {
    const list = byProduct.get(row.product_id) || [];
    list.push({
      id: row.id,
      label: row.label,
      stock: Number(row.stock) || 0,
    });
    byProduct.set(row.product_id, list);
  }

  for (const product of products) {
    product.sizes = byProduct.get(product.id) || [];
  }

  return products;
}

/**
 * GET /api/products
 * Query params: category, featured, search, limit
 */
const listProducts = asyncHandler(async (req, res) => {
  const { category, featured, search } = req.query || {};

  const where = [];
  const params = [];

  if (category && String(category).toLowerCase() !== 'all') {
    const cat = String(category).toLowerCase().trim();
    if (!VALID_CATEGORIES.includes(cat)) {
      return res.json({ products: [] });
    }
    where.push('category = ?');
    params.push(cat);
  }

  if (featured === '1' || featured === 'true' || featured === 1 || featured === true) {
    where.push('featured = 1');
  }

  if (search && String(search).trim()) {
    const term = `%${String(search).trim().slice(0, 80)}%`;
    where.push('(name LIKE ? OR tagline LIKE ? OR colorway LIKE ? OR drop_name LIKE ?)');
    params.push(term, term, term, term);
  }

  let limit = 60;
  const rawLimit = Number.parseInt(req.query && req.query.limit, 10);
  if (Number.isFinite(rawLimit) && rawLimit > 0) {
    limit = Math.min(rawLimit, 100);
  }

  const sql = `
    SELECT id, slug, name, tagline, description, price_cents, category,
           drop_name, colorway, accent_hex, in_stock, featured, created_at
      FROM products
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY featured DESC, created_at DESC, id DESC
     LIMIT ${limit}
  `;

  const [rows] = await pool.query(sql, params);
  const products = await attachSizes(rows.map(mapProductRow));

  return res.json({ products });
});

/**
 * GET /api/products/categories
 */
const listCategories = asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT category AS id, COUNT(*) AS count
       FROM products
      WHERE category IS NOT NULL AND category <> ''
      GROUP BY category
      ORDER BY category ASC`
  );

  const categories = rows.map((row) => ({
    id: row.id,
    label: titleCase(row.id),
    count: Number(row.count) || 0,
  }));

  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return res.json({
    categories: [{ id: 'all', label: 'All', count: total }, ...categories],
  });
});

/**
 * GET /api/products/:slug
 */
const getProductBySlug = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();

  if (!slug) {
    return res.status(400).json({ error: 'A product slug is required' });
  }

  const [rows] = await pool.query(
    `SELECT id, slug, name, tagline, description, price_cents, category,
            drop_name, colorway, accent_hex, in_stock, featured, created_at
       FROM products
      WHERE slug = ?
      LIMIT 1`,
    [slug]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const product = mapProductRow(rows[0]);
  await attachSizes([product]);

  return res.json({ product });
});

module.exports = {
  listProducts,
  listCategories,
  getProductBySlug,
};