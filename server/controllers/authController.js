'use strict';

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 10;

function normaliseEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: row.email,
    fullName: row.full_name || '',
  };
}

function setSessionUser(req, user) {
  req.session.user = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
  };
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.save !== 'function') {
      resolve();
      return;
    }
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.regenerate !== 'function') {
      resolve();
      return;
    }
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

const signup = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = normaliseEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = String(body.fullName || body.full_name || '').trim();

  if (!fullName || fullName.length < 2) {
    return res.status(400).json({ error: 'Please enter your full name' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  let insertId;
  try {
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
      [email, passwordHash, fullName]
    );
    insertId = result.insertId;
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    throw err;
  }

  const user = { id: Number(insertId), email, fullName };

  await regenerateSession(req);
  setSessionUser(req, user);
  await saveSession(req);

  return res.status(201).json({ user });
});

const login = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = normaliseEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const [rows] = await pool.query(
    'SELECT id, email, password_hash, full_name FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const row = rows[0];
  let matches = false;
  try {
    matches = await bcrypt.compare(password, row.password_hash || '');
  } catch (err) {
    matches = false;
  }

  if (!matches) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = toPublicUser(row);

  await regenerateSession(req);
  setSessionUser(req, user);
  await saveSession(req);

  return res.json({ user });
});

const logout = asyncHandler(async (req, res) => {
  const clear = () => {
    try {
      res.clearCookie('sc.sid', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
        path: '/',
      });
    } catch (err) {
      /* ignore cookie clearing issues */
    }
  };

  if (!req.session || typeof req.session.destroy !== 'function') {
    clear();
    return res.json({ ok: true });
  }

  return new Promise((resolve) => {
    req.session.destroy((err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] Failed to destroy session:', err.message);
      }
      clear();
      res.json({ ok: true });
      resolve();
    });
  });
});

const me = asyncHandler(async (req, res) => {
  const sessionUser = req.session && req.session.user ? req.session.user : null;
  if (!sessionUser || !sessionUser.id) {
    return res.json({ user: null });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name FROM users WHERE id = ? LIMIT 1',
      [sessionUser.id]
    );
    if (rows.length === 0) {
      return res.json({ user: null });
    }
    return res.json({ user: toPublicUser(rows[0]) });
  } catch (err) {
    // Database may be unavailable — fall back to the session copy.
    return res.json({
      user: {
        id: Number(sessionUser.id),
        email: sessionUser.email,
        fullName: sessionUser.fullName || '',
      },
    });
  }
});

module.exports = { signup, login, logout, me };