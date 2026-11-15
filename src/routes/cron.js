const express = require('express');
const config = require('../config');
const { runReminders, sendTestReminder } = require('../services/reminderService');
const { getDb } = require('../db/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/cron/run-reminders
 * Trigger reminder dispatch job.
 * Protected by secret header 'x-cron-secret' or caretaker JWT.
 */
router.post('/cron/run-reminders', optionalAuth, async (req, res) => {
  const incomingSecret = req.headers['x-cron-secret'] || req.headers['x-api-key'];
  const isCaretaker = req.user && req.user.role === 'caretaker';
  const isAuthorizedSecret = incomingSecret && incomingSecret === config.cronSecret;

  if (!isAuthorizedSecret && !isCaretaker) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing x-cron-secret header. Access is restricted.'
    });
  }

  try {
    const result = await runReminders();
    return res.json({
      success: true,
      message: `Cron job executed. ${result.sentCount} notifications processed.`,
      ...result
    });
  } catch (err) {
    console.error('[Cron] Error running reminder job:', err);
    return res.status(500).json({
      error: 'Failed to execute reminder job',
      details: err.message
    });
  }
});

/**
 * POST /api/reminders/send-test
 * Trigger manual test reminder from the UI button
 */
router.post('/reminders/send-test', optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const recipient = req.body?.recipient || db.profile.emergencyContact?.email;
    const result = await sendTestReminder(recipient);

    return res.json({
      success: true,
      simulated: result.simulated,
      recipient: result.recipient,
      message: result.simulated
        ? `Test notification simulated and logged to server console (BREVO_API_KEY is not set). Check server logs.`
        : `Live test email dispatched successfully via Brevo to ${result.recipient}.`,
      timestamp: result.timestamp
    });
  } catch (err) {
    console.error('[Reminders] Error sending test reminder:', err);
    return res.status(500).json({
      error: 'Failed to send test reminder',
      details: err.message
    });
  }
});

/**
 * GET /api/reminders/logs
 * View history of sent/simulated reminders
 */
router.get('/reminders/logs', requireAuth, (req, res) => {
  const db = getDb();
  return res.json({
    success: true,
    reminderLogs: db.reminderLogs || []
  });
});

module.exports = router;
