'use strict';

/**
 * Auth helpers shared by the API routes and the payments module.
 *
 * The session shape written by server/controllers/authController.js is:
 *   req.session.user = { id, email, fullName }
 */

/**
 * Read the signed-in user from the session.
 * @param {import('express').Request} req
 * @returns {{ id: number|string, email: string, fullName: string }|null}
 */
function getUserFromSession(req) {
  try {
    if (!req || !req.session || !req.session.user) return null;
    const { id, email, fullName, full_name: fullNameSnake } = req.session.user;
    if (id === undefined || id === null || !email) return null;
    return {
      id,
      email: String(email),
      fullName: fullName || fullNameSnake || '',
    };
  } catch (err) {
    return null;
  }
}

/**
 * Guard for routes that require a signed-in user.
 */
function requireAuth(req, res, next) {
  const user = getUserFromSession(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  return next();
}

/**
 * Non-blocking middleware: attaches req.user when a session exists.
 * Also used as the getUser source for the payments module.
 */
function attachUser(req, _res, next) {
  req.user = getUserFromSession(req);
  return next();
}

module.exports = { getUserFromSession, requireAuth, attachUser };