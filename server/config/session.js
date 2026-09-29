'use strict';

/**
 * Session configuration for the STREET/PLATINUM API.
 *
 * NOTE: the frontend and the API live on different hosts
 * (https://streetclothing.arx-app.com and https://streetclothing-api.arx-app.com:4117),
 * so the session cookie has to be a cross-site cookie:
 *   sameSite: 'none' + secure: true
 *
 * Because the cookie is marked `secure`, the Express app MUST be told it sits
 * behind / terminates TLS, otherwise express-session refuses to set it:
 *
 *   app.set('trust proxy', 1);   // <- already done in server/index.js
 *
 * The browser must also send `credentials: 'include'` on every fetch (see lib/api.js)
 * and CORS must be configured with `credentials: true` and an explicit origin.
 */

const session = require('express-session');
const MemoryStoreFactory = require('memorystore');

const MemoryStore = MemoryStoreFactory(session);

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET) {
  // Never hard-fail boot in development, but make the risk obvious.
  // eslint-disable-next-line no-console
  console.warn(
    '[session] SESSION_SECRET is not set — falling back to an insecure development secret. ' +
      'Set SESSION_SECRET in your environment (see .env.example).'
  );
}

let store;
try {
  store = new MemoryStore({
    // Prune expired sessions once every 24 hours.
    checkPeriod: ONE_DAY_MS,
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[session] Failed to create MemoryStore, using default in-process store:', err.message);
  store = undefined;
}

const sessionMiddleware = session({
  store,
  name: 'sc.sid',
  secret: process.env.SESSION_SECRET || 'streetclothing-dev-session-secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  },
});

/**
 * Wrapper that keeps the API alive even if the session store throws:
 * a broken session should degrade to "signed out", never a 500 on every route.
 */
function safeSessionMiddleware(req, res, next) {
  try {
    sessionMiddleware(req, res, (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('[session] middleware error:', err.message);
        if (!req.session) {
          req.session = null;
        }
        return next();
      }
      return next();
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[session] unexpected failure:', err && err.message);
    return next();
  }
}

module.exports = {
  sessionMiddleware: safeSessionMiddleware,
  rawSessionMiddleware: sessionMiddleware,
  isProduction,
  SEVEN_DAYS_MS,
};