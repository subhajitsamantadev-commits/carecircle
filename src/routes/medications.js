const express = require('express');
const { getDb, saveDb, addActivityLog } = require('../db/db');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');

const router = express.Router();

// All medication routes require authentication
router.use(requireAuth);

/**
 * GET /api/medications
 * List all medications
 */
router.get('/', (req, res) => {
  const db = getDb();
  return res.json({
    success: true,
    medications: db.medications || []
  });
});

/**
 * GET /api/medications/:id
 * Get single medication by ID
 */
router.get('/:id', (req, res) => {
  const db = getDb();
  const med = (db.medications || []).find(m => m.id === req.params.id);
  if (!med) {
    return res.status(404).json({ error: 'Medication not found.' });
  }
  return res.json({ success: true, medication: med });
});

/**
 * POST /api/medications
 * Add a new medication (Caretaker or Elder only; Family is view-only)
 */
router.post('/', requireWriteAccess, (req, res) => {
  const { name, dosage, instructions, purpose, scheduleTimes, daysOfWeek, prescribedBy, refillRemaining } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Medication name is required.' });
  }
  if (!dosage || typeof dosage !== 'string' || dosage.trim().length === 0) {
    return res.status(400).json({ error: 'Dosage is required (e.g., 500mg, 1 tablet).' });
  }

  // Sanitize schedule times
  let times = Array.isArray(scheduleTimes) && scheduleTimes.length > 0 ? scheduleTimes : ['08:00'];
  times = times.map(t => {
    // Validate HH:MM
    const match = String(t).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    return match ? t : '08:00';
  });

  // Sanitize days of week
  const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let days = Array.isArray(daysOfWeek) && daysOfWeek.length > 0
    ? daysOfWeek.filter(d => validDays.includes(d))
    : validDays;
  if (days.length === 0) days = validDays;

  const db = getDb();
  const newMed = {
    id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim(),
    dosage: dosage.trim(),
    instructions: (instructions || 'Take as prescribed').trim(),
    purpose: (purpose || 'Maintenance').trim(),
    scheduleTimes: times.sort(),
    daysOfWeek: days,
    prescribedBy: (prescribedBy || db.profile.primaryDoctor || 'Primary Care Physician').trim(),
    refillRemaining: Number.isInteger(Number(refillRemaining)) ? Math.max(0, Number(refillRemaining)) : 30,
    active: true,
    color: '#3b82f6',
    createdAt: new Date().toISOString()
  };

  db.medications.push(newMed);
  saveDb(db);

  addActivityLog(
    'MEDICATION_ADDED',
    `Added prescription '${newMed.name}' (${newMed.dosage})`,
    req.user.role,
    'medication'
  );

  return res.status(201).json({
    success: true,
    medication: newMed,
    message: `Medication '${newMed.name}' added successfully.`
  });
});

/**
 * PUT /api/medications/:id
 * Edit existing medication (Caretaker or Elder only)
 */
router.put('/:id', requireWriteAccess, (req, res) => {
  const db = getDb();
  const index = (db.medications || []).findIndex(m => m.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Medication not found.' });
  }

  const existing = db.medications[index];
  const { name, dosage, instructions, purpose, scheduleTimes, daysOfWeek, prescribedBy, refillRemaining, active } = req.body;

  if (name !== undefined) existing.name = String(name).trim();
  if (dosage !== undefined) existing.dosage = String(dosage).trim();
  if (instructions !== undefined) existing.instructions = String(instructions).trim();
  if (purpose !== undefined) existing.purpose = String(purpose).trim();
  if (prescribedBy !== undefined) existing.prescribedBy = String(prescribedBy).trim();
  if (refillRemaining !== undefined) existing.refillRemaining = Math.max(0, parseInt(refillRemaining, 10) || 0);
  if (active !== undefined) existing.active = Boolean(active);

  if (Array.isArray(scheduleTimes) && scheduleTimes.length > 0) {
    existing.scheduleTimes = scheduleTimes.sort();
  }

  if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
    existing.daysOfWeek = daysOfWeek;
  }

  existing.updatedAt = new Date().toISOString();
  db.medications[index] = existing;
  saveDb(db);

  addActivityLog(
    'MEDICATION_UPDATED',
    `Updated prescription '${existing.name}' (${existing.dosage})`,
    req.user.role,
    'medication'
  );

  return res.json({
    success: true,
    medication: existing,
    message: `Medication '${existing.name}' updated successfully.`
  });
});

/**
 * DELETE /api/medications/:id
 * Delete medication (Caretaker or Elder only)
 */
router.delete('/:id', requireWriteAccess, (req, res) => {
  const db = getDb();
  const index = (db.medications || []).findIndex(m => m.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Medication not found.' });
  }

  const [removed] = db.medications.splice(index, 1);
  saveDb(db);

  addActivityLog(
    'MEDICATION_DELETED',
    `Removed prescription '${removed.name}'`,
    req.user.role,
    'medication'
  );

  return res.json({
    success: true,
    message: `Medication '${removed.name}' deleted successfully.`
  });
});

module.exports = router;
