const express = require('express');
const { getDb, saveDb, addActivityLog } = require('../db/db');
const { formatDate } = require('../db/seed');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');

const router = express.Router();

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

router.use(requireAuth);

/**
 * GET /api/doses/today
 * Compute today's scheduled doses and merge with log status
 */
router.get('/today', (req, res) => {
  const db = getDb();
  const now = new Date();
  const todayStr = formatDate(now);
  const currentDayName = DAY_NAMES[now.getDay()];

  const activeMeds = (db.medications || []).filter(m => m.active);
  const todaySchedule = [];

  for (const med of activeMeds) {
    if (!med.daysOfWeek || med.daysOfWeek.includes(currentDayName)) {
      for (const timeSlot of (med.scheduleTimes || [])) {
        // Find if this dose has already been logged today
        const existingLog = (db.doseLogs || []).find(
          l => l.medicationId === med.id && l.date === todayStr && l.scheduledTime === timeSlot
        );

        todaySchedule.push({
          medicationId: med.id,
          medicationName: med.name,
          dosage: med.dosage,
          instructions: med.instructions,
          purpose: med.purpose,
          scheduledTime: timeSlot,
          date: todayStr,
          status: existingLog ? existingLog.status : 'pending',
          loggedAt: existingLog ? existingLog.loggedAt : null,
          loggedBy: existingLog ? existingLog.loggedBy : null,
          notes: existingLog ? existingLog.notes : '',
          logId: existingLog ? existingLog.id : null
        });
      }
    }
  }

  // Sort schedule by scheduled time
  todaySchedule.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  return res.json({
    success: true,
    date: todayStr,
    day: currentDayName,
    schedule: todaySchedule,
    summary: {
      total: todaySchedule.length,
      taken: todaySchedule.filter(s => s.status === 'taken').length,
      missed: todaySchedule.filter(s => s.status === 'missed').length,
      pending: todaySchedule.filter(s => s.status === 'pending').length
    }
  });
});

/**
 * POST /api/doses/log
 * Mark dose as 'taken' or 'missed' (Elder or Caretaker only; Family is view-only)
 */
router.post('/log', requireWriteAccess, (req, res) => {
  const { medicationId, scheduledTime, date, status, notes } = req.body;

  if (!medicationId) {
    return res.status(400).json({ error: 'medicationId is required.' });
  }
  if (!scheduledTime || !scheduledTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
    return res.status(400).json({ error: 'Valid scheduledTime (HH:MM) is required.' });
  }
  if (!['taken', 'missed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be either "taken" or "missed".' });
  }

  const db = getDb();
  const med = (db.medications || []).find(m => m.id === medicationId);
  const medName = med ? med.name : 'Medication';
  const medDosage = med ? med.dosage : '';

  const targetDate = date || formatDate(new Date());

  // Check if an existing log exists for this specific slot
  const existingIndex = (db.doseLogs || []).findIndex(
    l => l.medicationId === medicationId && l.date === targetDate && l.scheduledTime === scheduledTime
  );

  let updatedLog = null;

  if (existingIndex !== -1) {
    db.doseLogs[existingIndex].status = status;
    db.doseLogs[existingIndex].loggedAt = new Date().toISOString();
    db.doseLogs[existingIndex].loggedBy = req.user.role;
    if (notes !== undefined) db.doseLogs[existingIndex].notes = notes;
    updatedLog = db.doseLogs[existingIndex];
  } else {
    updatedLog = {
      id: `dose-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      medicationId,
      medicationName: medName,
      dosage: medDosage,
      scheduledTime,
      date: targetDate,
      status,
      loggedAt: new Date().toISOString(),
      loggedBy: req.user.role,
      notes: notes || ''
    };
    db.doseLogs.unshift(updatedLog);
  }

  // Decrement refill count if taken and refill > 0
  if (status === 'taken' && med && med.refillRemaining > 0) {
    med.refillRemaining = Math.max(0, med.refillRemaining - 1);
  }

  saveDb(db);

  addActivityLog(
    status === 'taken' ? 'DOSE_TAKEN' : 'DOSE_MISSED',
    `Marked ${medName} (${medDosage}) at ${scheduledTime} as ${status.toUpperCase()}`,
    req.user.role,
    'medication'
  );

  return res.json({
    success: true,
    log: updatedLog,
    message: `${medName} marked as ${status} successfully.`
  });
});

/**
 * GET /api/doses/history
 * Query past dose logs
 */
router.get('/history', (req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit, 10) || 50;
  const logs = (db.doseLogs || []).slice(0, limit);
  return res.json({ success: true, history: logs });
});

module.exports = router;
