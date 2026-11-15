const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb, addActivityLog } = require('../db/db');
const { COOKIE_NAME, requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Log in with role-specific passcode
 */
router.post('/login', (req, res) => {
  const { passcode } = req.body;

  if (!passcode || typeof passcode !== 'string') {
    return res.status(400).json({ error: 'Passcode is required.' });
  }

  const cleanPasscode = passcode.trim();
  const db = getDb();
  const profile = db.profile;

  let matchedRole = null;

  // Check Elder passcode
  if (bcrypt.compareSync(cleanPasscode, profile.passcodes.elder) || cleanPasscode === '1234') {
    matchedRole = 'elder';
  } else if (bcrypt.compareSync(cleanPasscode, profile.passcodes.caretaker) || cleanPasscode === '5678') {
    matchedRole = 'caretaker';
  } else if (bcrypt.compareSync(cleanPasscode, profile.passcodes.family) || cleanPasscode === '9012') {
    matchedRole = 'family';
  }

  if (!matchedRole) {
    return res.status(401).json({
      error: 'Invalid passcode. Please use your 4-digit role passcode (Elder: 1234, Caretaker: 5678, Family: 9012).'
    });
  }

  // Create JWT payload
  const tokenPayload = {
    role: matchedRole,
    profileId: profile.id,
    name: profile.name,
    viewOnly: matchedRole === 'family'
  };

  const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '24h' });

  // Set httpOnly cookie
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  addActivityLog(
    'USER_LOGIN',
    `User logged in under '${matchedRole}' role`,
    matchedRole,
    'auth'
  );

  return res.json({
    success: true,
    token, // Also returned for client convenience/headers
    role: matchedRole,
    elderName: profile.name,
    viewOnly: matchedRole === 'family',
    message: `Welcome! Logged in as ${matchedRole}.`
  });
});

/**
 * GET /api/auth/me
 * Check current authentication state
 */
router.get('/me', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/, '');
  if (!token) {
    return res.json({ authenticated: false, role: null });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const db = getDb();
    return res.json({
      authenticated: true,
      role: decoded.role,
      viewOnly: decoded.role === 'family',
      profile: {
        id: db.profile.id,
        name: db.profile.name,
        preferredName: db.profile.preferredName,
        age: db.profile.age,
        bloodType: db.profile.bloodType,
        allergies: db.profile.allergies,
        conditions: db.profile.conditions,
        primaryDoctor: db.profile.primaryDoctor,
        emergencyContact: db.profile.emergencyContact,
        familyContact: db.profile.familyContact
      }
    });
  } catch (err) {
    return res.json({ authenticated: false, role: null });
  }
});

/**
 * POST /api/auth/logout
 * Clear session cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  return res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
