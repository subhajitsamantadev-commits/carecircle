const express = require('express');
const { getDb, saveDb, addActivityLog } = require('../db/db');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/appointments
 * List doctor appointments, sorted upcoming first
 */
router.get('/', (req, res) => {
  const db = getDb();
  const list = [...(db.appointments || [])];

  list.sort((a, b) => {
    // Upcoming first
    if (a.status === 'upcoming' && b.status !== 'upcoming') return -1;
    if (a.status !== 'upcoming' && b.status === 'upcoming') return 1;
    // Compare dates
    const dateComp = (a.date || '').localeCompare(b.date || '');
    if (dateComp !== 0) return dateComp;
    return (a.time || '').localeCompare(b.time || '');
  });

  return res.json({
    success: true,
    appointments: list
  });
});

/**
 * POST /api/appointments
 * Create new doctor appointment (Elder or Caretaker only; Family is view-only)
 */
router.post('/', requireWriteAccess, (req, res) => {
  const { doctorName, specialty, title, date, time, location, notes, phone } = req.body;

  if (!doctorName || typeof doctorName !== 'string' || doctorName.trim().length === 0) {
    return res.status(400).json({ error: 'Doctor name is required.' });
  }
  if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return res.status(400).json({ error: 'Valid appointment date (YYYY-MM-DD) is required.' });
  }
  if (!time || !time.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
    return res.status(400).json({ error: 'Valid appointment time (HH:MM) is required.' });
  }

  const db = getDb();
  const newAppointment = {
    id: `apt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    doctorName: doctorName.trim(),
    specialty: (specialty || 'General Consultation').trim(),
    title: (title || `Consultation with ${doctorName}`).trim(),
    date,
    time,
    location: (location || 'Clinic / Doctor Office').trim(),
    notes: (notes || '').trim(),
    phone: (phone || '').trim(),
    status: 'upcoming',
    createdAt: new Date().toISOString()
  };

  db.appointments.push(newAppointment);
  saveDb(db);

  addActivityLog(
    'APPOINTMENT_SCHEDULED',
    `Scheduled appointment with ${newAppointment.doctorName} for ${newAppointment.date} at ${newAppointment.time}`,
    req.user.role,
    'appointment'
  );

  return res.status(201).json({
    success: true,
    appointment: newAppointment,
    message: `Appointment with ${newAppointment.doctorName} scheduled successfully.`
  });
});

/**
 * PUT /api/appointments/:id
 * Edit appointment (Elder or Caretaker only)
 */
router.put('/:id', requireWriteAccess, (req, res) => {
  const db = getDb();
  const index = (db.appointments || []).findIndex(a => a.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }

  const existing = db.appointments[index];
  const { doctorName, specialty, title, date, time, location, notes, phone, status } = req.body;

  if (doctorName !== undefined) existing.doctorName = String(doctorName).trim();
  if (specialty !== undefined) existing.specialty = String(specialty).trim();
  if (title !== undefined) existing.title = String(title).trim();
  if (date !== undefined) existing.date = String(date).trim();
  if (time !== undefined) existing.time = String(time).trim();
  if (location !== undefined) existing.location = String(location).trim();
  if (notes !== undefined) existing.notes = String(notes).trim();
  if (phone !== undefined) existing.phone = String(phone).trim();
  if (status !== undefined && ['upcoming', 'completed', 'cancelled'].includes(status)) {
    existing.status = status;
  }

  existing.updatedAt = new Date().toISOString();
  db.appointments[index] = existing;
  saveDb(db);

  addActivityLog(
    'APPOINTMENT_UPDATED',
    `Updated appointment with ${existing.doctorName} (${existing.date})`,
    req.user.role,
    'appointment'
  );

  return res.json({
    success: true,
    appointment: existing,
    message: `Appointment updated successfully.`
  });
});

/**
 * DELETE /api/appointments/:id
 * Delete appointment (Elder or Caretaker only)
 */
router.delete('/:id', requireWriteAccess, (req, res) => {
  const db = getDb();
  const index = (db.appointments || []).findIndex(a => a.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }

  const [removed] = db.appointments.splice(index, 1);
  saveDb(db);

  addActivityLog(
    'APPOINTMENT_CANCELLED',
    `Removed appointment with ${removed.doctorName} on ${removed.date}`,
    req.user.role,
    'appointment'
  );

  return res.json({
    success: true,
    message: `Appointment removed successfully.`
  });
});

module.exports = router;
