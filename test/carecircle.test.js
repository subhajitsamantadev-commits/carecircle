const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app } = require('../src/server');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    // Listen on random port for testing
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => {
    server.close(resolve);
  });
});

// Helper for fetch with cookies
async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, options);
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  return { status: response.status, headers: response.headers, data };
}

test('1. Health Check Endpoint /healthz', async () => {
  const res = await request('/healthz');
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'ok');
  assert.equal(res.data.app, 'CareCircle');
  assert.ok(res.data.uptimeSeconds >= 0);
});

test('2. Authentication: Passcode validation and JWT cookie', async () => {
  // Test invalid passcode
  const invalidRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: '0000' })
  });
  assert.equal(invalidRes.status, 401);
  assert.match(invalidRes.data.error, /invalid passcode/i);

  // Test Elder login (1234)
  const elderRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: '1234' })
  });
  assert.equal(elderRes.status, 200);
  assert.equal(elderRes.data.role, 'elder');
  assert.equal(elderRes.data.viewOnly, false);
  assert.ok(elderRes.data.token);

  // Test Caretaker login (5678)
  const caretakerRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: '5678' })
  });
  assert.equal(caretakerRes.status, 200);
  assert.equal(caretakerRes.data.role, 'caretaker');
  assert.equal(caretakerRes.data.viewOnly, false);

  // Test Family login (9012)
  const familyRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: '9012' })
  });
  assert.equal(familyRes.status, 200);
  assert.equal(familyRes.data.role, 'family');
  assert.equal(familyRes.data.viewOnly, true);
});

test('3. Role Authorization: Family view-only restriction', async () => {
  // Log in as Family (view-only)
  const famLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: '9012' })
  });
  const familyToken = famLogin.data.token;

  // Family attempt to add medication should return 403 Forbidden
  const addMedRes = await request('/api/medications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${familyToken}`
    },
    body: JSON.stringify({
      name: 'Unauthorized Drug',
      dosage: '100mg'
    })
  });
  assert.equal(addMedRes.status, 403);
  assert.match(addMedRes.data.error, /view-only/i);

  // Family attempt to mark dose should return 403 Forbidden
  const markDoseRes = await request('/api/doses/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${familyToken}`
    },
    body: JSON.stringify({
      medicationId: 'med-1',
      scheduledTime: '08:00',
      status: 'taken'
    })
  });
  assert.equal(markDoseRes.status, 403);
});

test('4. Medication Management: Caretaker CRUD', async () => {
  // Caretaker login
  const careLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: '5678' })
  });
  const caretakerToken = careLogin.data.token;

  // Add Medication
  const createRes = await request('/api/medications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${caretakerToken}`
    },
    body: JSON.stringify({
      name: 'Omega-3 Fish Oil',
      dosage: '1000mg',
      instructions: 'Take 1 capsule with breakfast',
      purpose: 'Cardiovascular Support',
      scheduleTimes: ['08:30'],
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      refillRemaining: 60
    })
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.data.medication.name, 'Omega-3 Fish Oil');
  const newMedId = createRes.data.medication.id;

  // Edit Medication
  const updateRes = await request(`/api/medications/${newMedId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${caretakerToken}`
    },
    body: JSON.stringify({
      dosage: '1200mg'
    })
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.medication.dosage, '1200mg');

  // Delete Medication
  const delRes = await request(`/api/medications/${newMedId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${caretakerToken}` }
  });
  assert.equal(delRes.status, 200);
});

test('5. Doses & Adherence: Schedule & Marking Dose', async () => {
  // Elder login
  const elderLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: '1234' })
  });
  const elderToken = elderLogin.data.token;

  // GET today schedule
  const schedRes = await request('/api/doses/today', {
    headers: { 'Authorization': `Bearer ${elderToken}` }
  });
  assert.equal(schedRes.status, 200);
  assert.ok(Array.isArray(schedRes.data.schedule));
  assert.ok(schedRes.data.schedule.length > 0);

  const firstDose = schedRes.data.schedule[0];

  // Mark first dose as taken
  const logRes = await request('/api/doses/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${elderToken}`
    },
    body: JSON.stringify({
      medicationId: firstDose.medicationId,
      scheduledTime: firstDose.scheduledTime,
      status: 'taken'
    })
  });
  assert.equal(logRes.status, 200);
  assert.equal(logRes.data.log.status, 'taken');

  // Verify Weekly Adherence calculation
  const adhRes = await request('/api/adherence/weekly', {
    headers: { 'Authorization': `Bearer ${elderToken}` }
  });
  assert.equal(adhRes.status, 200);
  assert.ok(adhRes.data.summary.overallRate >= 0);
  assert.equal(adhRes.data.days.length, 7);
});

test('6. Doctor Appointments: CRUD', async () => {
  const careLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: '5678' })
  });
  const token = careLogin.data.token;

  // List appointments
  const listRes = await request('/api/appointments', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.data.appointments));

  // Add appointment
  const addRes = await request('/api/appointments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      doctorName: 'Dr. Gregory House',
      specialty: 'Diagnostics',
      title: 'Annual Comprehensive Medical Review',
      date: '2026-12-01',
      time: '14:30',
      location: 'Princeton Plainsboro Suite 101'
    })
  });
  assert.equal(addRes.status, 201);
  assert.equal(addRes.data.appointment.doctorName, 'Dr. Gregory House');
});

test('7. Cron Reminders & Test Alerts', async () => {
  // Test unauthorized cron call without header
  const unauthorizedCron = await request('/api/cron/run-reminders', {
    method: 'POST'
  });
  assert.equal(unauthorizedCron.status, 401);

  // Test authorized cron call with secret header
  const authorizedCron = await request('/api/cron/run-reminders', {
    method: 'POST',
    headers: {
      'x-cron-secret': 'carecircle-cron-secret-token'
    }
  });
  assert.equal(authorizedCron.status, 200);
  assert.equal(authorizedCron.data.success, true);
  assert.ok(authorizedCron.data.processed);

  // Test test reminder button endpoint
  const testRemRes = await request('/api/reminders/send-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(testRemRes.status, 200);
  assert.equal(testRemRes.data.success, true);
  assert.ok(testRemRes.data.message);
});

test('8. AI Natural Language Prescription Parsing', async () => {
  const elderLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: '1234' })
  });
  const token = elderLogin.data.token;

  const aiRes = await request('/api/ai/parse-medication', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      prompt: 'Metformin 500mg twice daily after meals'
    })
  });

  assert.equal(aiRes.status, 200);
  assert.equal(aiRes.data.success, true);
  assert.ok(aiRes.data.medication);
  assert.match(aiRes.data.medication.name, /Metformin/i);
  assert.match(aiRes.data.medication.dosage, /500\s*mg/i);
  assert.ok(Array.isArray(aiRes.data.medication.scheduleTimes));
  assert.ok(aiRes.data.medication.scheduleTimes.length >= 2);
  assert.match(aiRes.data.disclaimer, /Not medical advice/i);
});
