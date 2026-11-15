const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE_NAME = 'carecircle_token';

/**
 * Extract token from httpOnly cookie or Authorization header
 */
function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Middleware: Verify user is authenticated
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please log in with a valid passcode.'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // { role: 'elder' | 'caretaker' | 'family', profileId, name }
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired session. Please log in again.'
    });
  }
}

/**
 * Middleware: Require specific role(s)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not authorized for this action.`
      });
    }
    next();
  };
}

/**
 * Middleware: Enforce write permission
 * Family is strictly view-only!
 */
function requireWriteAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.role === 'family') {
    return res.status(403).json({
      error: 'Access denied: Family role is strictly view-only. Adding, editing, or logging is reserved for elder and caretaker roles.'
    });
  }
  next();
}

/**
 * Middleware: Optional authentication (attaches user if present)
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, config.jwtSecret);
    } catch {
      // Ignore invalid optional token
    }
  }
  next();
}

module.exports = {
  COOKIE_NAME,
  requireAuth,
  requireRole,
  requireWriteAccess,
  optionalAuth,
  extractToken
};
