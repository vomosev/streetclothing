require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const payments = require('./payments');

const { checkDatabaseConnection } = require('./config/db');
const { sessionMiddleware } = require('./config/session');
const { getUserFromSession } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const { markOrderPaid } = require('./controllers/orderController');

const app = express();

// Behind a reverse proxy / TLS terminator — required for secure cookies.
app.set('trust proxy', 1);

// Payment webhooks MUST be attached before any body parser.
payments.attachPaymentWebhooks(app);

const STATIC_ORIGINS = new Set([
  'https://streetclothing.arx-app.com',
  'http://localhost:3000',
  'http://localhost:4117',
]);

if (process.env.CLIENT_ORIGIN) {
  String(process.env.CLIENT_ORIGIN)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => STATIC_ORIGINS.add(value));
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (STATIC_ORIGINS.has(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    if (hostname === 'arx-app.com' || hostname.endsWith('.arx-app.com')) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return false;
  } catch (err) {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', async (req, res) => {
  try {
    const database = await checkDatabaseConnection();
    res.json({ status: 'ok', database });
  } catch (err) {
    console.error('[health] database check failed:', err.message);
    res.status(200).json({ status: 'degraded', database: false, error: 'Database unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

payments.attachPaymentRoutes(app, {
  getUser: (req) => {
    try {
      return getUserFromSession(req);
    } catch (err) {
      console.error('[payments] getUser failed:', err.message);
      return null;
    }
  },
});

/**
 * The payments module does not necessarily expose an EventEmitter interface.
 * Depending on the version it may expose `on`, an `events`/`emitter` emitter,
 * or a dedicated `onPaymentSucceeded` hook. Resolve whichever is available and
 * degrade gracefully (with a warning) instead of crashing at boot.
 */
function subscribeToPaymentEvent(eventName, handler) {
  const candidates = [
    payments,
    payments && payments.events,
    payments && payments.emitter,
    payments && payments.bus,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate.on === 'function') {
      candidate.on(eventName, handler);
      return true;
    }
  }

  if (typeof payments.subscribe === 'function') {
    payments.subscribe(eventName, handler);
    return true;
  }

  if (eventName === 'payment.succeeded' && typeof payments.onPaymentSucceeded === 'function') {
    payments.onPaymentSucceeded(handler);
    return true;
  }

  return false;
}

async function handlePaymentSucceeded(event) {
  try {
    const itemId = event && event.itemId ? String(event.itemId) : '';
    if (!itemId.startsWith('order:')) return;
    await markOrderPaid(event.reference);
  } catch (err) {
    console.error('[payments] failed to fulfil order:', err.message);
  }
}

if (!subscribeToPaymentEvent('payment.succeeded', handlePaymentSucceeded)) {
  console.warn(
    '[payments] no event subscription API available (payments.on/events/subscribe missing) — ' +
      'orders will not be auto-fulfilled from payment events'
  );
}

app.use(notFound);
app.use(errorHandler);

function buildServer() {
  if (String(process.env.SSL_ENABLED).toLowerCase() === 'true') {
    try {
      const certPath = process.env.SSL_CERT_PATH;
      const keyPath = process.env.SSL_KEY_PATH;
      if (!certPath || !keyPath) {
        throw new Error('SSL_CERT_PATH and SSL_KEY_PATH must be set when SSL_ENABLED=true');
      }
      const options = {
        cert: fs.readFileSync(path.resolve(certPath)),
        key: fs.readFileSync(path.resolve(keyPath)),
      };
      if (process.env.SSL_CA_PATH && fs.existsSync(path.resolve(process.env.SSL_CA_PATH))) {
        options.ca = fs.readFileSync(path.resolve(process.env.SSL_CA_PATH));
      }
      console.log('[server] TLS enabled — terminating HTTPS in-process');
      return https.createServer(options, app);
    } catch (err) {
      console.error('[server] Failed to start HTTPS, falling back to HTTP:', err.message);
      return http.createServer(app);
    }
  }
  return http.createServer(app);
}

const PORT = Number(process.env.PORT) || 4117;
const server = buildServer();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] streetclothing API listening on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('[server] fatal listen error:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception:', err);
});

module.exports = app;