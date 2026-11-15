const express = require('express');
const { getDb } = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/activity-logs
 * Fetch audit activity stream
 */
router.get('/', (req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit, 10) || 50;
  const logs = (db.activityLogs || []).slice(0, limit);

  return res.json({
    success: true,
    count: logs.length,
    logs
  });
});

module.exports = router;
