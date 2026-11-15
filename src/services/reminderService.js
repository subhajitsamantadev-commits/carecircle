const { getDb, logReminder, hasReminderBeenSent, addActivityLog } = require('../db/db');
const { formatDate, addDays } = require('../db/seed');
const { sendEmail, buildReminderHtml } = require('./emailService');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Execute cron reminder cycle
 * Checks for upcoming doses, missed doses (sent to caretaker & family), and appointments.
 */
async function runReminders() {
  const db = getDb();
  const now = new Date();
  const todayStr = formatDate(now);
  const currentDayName = DAY_NAMES[now.getDay()];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  const profile = db.profile;
  const caretakerEmail = profile.emergencyContact?.email || 'caretaker@example.com';
  const familyEmail = profile.familyContact?.email || 'family@example.com';
  const results = [];

  // ==========================================
  // 1. UPCOMING DOSES (Within next 90 minutes)
  // ==========================================
  const activeMeds = (db.medications || []).filter(m => m.active);
  for (const med of activeMeds) {
    if (!med.daysOfWeek || !med.daysOfWeek.includes(currentDayName)) {
      continue;
    }

    for (const timeSlot of (med.scheduleTimes || [])) {
      const [slotH, slotM] = timeSlot.split(':').map(Number);
      const slotTotalMinutes = slotH * 60 + slotM;
      const diffMinutes = slotTotalMinutes - currentTotalMinutes;

      // Check if dose is scheduled in the next 90 mins (or within current hour)
      if (diffMinutes >= -15 && diffMinutes <= 90) {
        // Check if dose was already taken today
        const alreadyTaken = (db.doseLogs || []).some(
          d => d.medicationId === med.id && d.date === todayStr && d.scheduledTime === timeSlot && d.status === 'taken'
        );
        if (alreadyTaken) continue;

        // Check deduplication in reminderLogs
        if (hasReminderBeenSent('upcoming_dose', med.id, todayStr, timeSlot)) {
          continue;
        }

        const subject = `💊 Upcoming Dose: ${med.name} (${med.dosage}) at ${timeSlot}`;
        const html = buildReminderHtml({
          title: 'Upcoming Medication Dose',
          heading: `Time for ${med.name} (${med.dosage})`,
          message: `Hello! A scheduled dose for <strong>${profile.name}</strong> is coming up at <strong>${timeSlot}</strong>.`,
          details: `
            <strong>Medication:</strong> ${med.name}<br>
            <strong>Dosage:</strong> ${med.dosage}<br>
            <strong>Scheduled Time:</strong> ${timeSlot}<br>
            <strong>Instructions:</strong> ${med.instructions || 'Take as prescribed'}
          `
        });

        // Send to Caretaker
        const sendResult = await sendEmail({
          toEmail: caretakerEmail,
          toName: profile.emergencyContact?.name || 'Caretaker',
          subject,
          htmlContent: html
        });

        logReminder({
          reminderType: 'upcoming_dose',
          targetId: med.id,
          date: todayStr,
          timeSlot,
          recipient: caretakerEmail,
          channel: 'brevo_email',
          simulated: sendResult.simulated,
          subject
        });

        addActivityLog(
          'REMINDER_SENT',
          `Upcoming dose reminder dispatched for ${med.name} (${timeSlot}) to ${caretakerEmail}`,
          'system',
          'reminder'
        );

        results.push({
          type: 'upcoming_dose',
          medication: med.name,
          timeSlot,
          recipient: caretakerEmail,
          simulated: sendResult.simulated
        });
      }
    }
  }

  // ========================================================
  // 2. MISSED DOSES (Past due doses -> Caretaker & Family!)
  // ========================================================
  for (const med of activeMeds) {
    if (!med.daysOfWeek || !med.daysOfWeek.includes(currentDayName)) {
      continue;
    }

    for (const timeSlot of (med.scheduleTimes || [])) {
      const [slotH, slotM] = timeSlot.split(':').map(Number);
      const slotTotalMinutes = slotH * 60 + slotM;
      const isPastDue = currentTotalMinutes > slotTotalMinutes + 30; // 30 mins grace period

      const doseEntry = (db.doseLogs || []).find(
        d => d.medicationId === med.id && d.date === todayStr && d.scheduledTime === timeSlot
      );

      const isMarkedMissed = doseEntry && doseEntry.status === 'missed';
      const isUnloggedPastDue = !doseEntry && isPastDue;

      if (isMarkedMissed || isUnloggedPastDue) {
        // Check deduplication
        if (hasReminderBeenSent('missed_dose_alert', med.id, todayStr, timeSlot)) {
          continue;
        }

        const subject = `⚠️ Missed Dose Alert: ${med.name} for ${profile.name}`;
        const html = buildReminderHtml({
          title: 'Missed Dose Alert',
          heading: `Alert: Missed Dose for ${profile.name}`,
          message: `<div class="alert-box"><strong>Important:</strong> The scheduled dose of <strong>${med.name} (${med.dosage})</strong> at <strong>${timeSlot}</strong> has not been confirmed as taken.</div>`,
          details: `
            <strong>Elder:</strong> ${profile.name} (Age ${profile.age})<br>
            <strong>Medication:</strong> ${med.name} (${med.dosage})<br>
            <strong>Prescribed Time:</strong> ${timeSlot}<br>
            <strong>Physician:</strong> ${med.prescribedBy || 'N/A'}<br>
            <strong>Emergency Contact:</strong> ${profile.emergencyContact?.phone || 'N/A'}
          `
        });

        // Send to both Caretaker and Family as required!
        const recipients = [
          { email: caretakerEmail, name: profile.emergencyContact?.name || 'Caretaker' },
          { email: familyEmail, name: profile.familyContact?.name || 'Family Member' }
        ];

        for (const recipient of recipients) {
          const sendResult = await sendEmail({
            toEmail: recipient.email,
            toName: recipient.name,
            subject,
            htmlContent: html
          });

          logReminder({
            reminderType: 'missed_dose_alert',
            targetId: med.id,
            date: todayStr,
            timeSlot,
            recipient: recipient.email,
            channel: 'brevo_email',
            simulated: sendResult.simulated,
            subject
          });
        }

        addActivityLog(
          'MISSED_DOSE_ALERT',
          `Missed dose alert for ${med.name} (${timeSlot}) dispatched to caretaker and family`,
          'system',
          'alert'
        );

        results.push({
          type: 'missed_dose_alert',
          medication: med.name,
          timeSlot,
          recipients: [caretakerEmail, familyEmail]
        });
      }
    }
  }

  // ==========================================
  // 3. UPCOMING DOCTOR APPOINTMENTS (Next 48h)
  // ==========================================
  const tomorrowStr = formatDate(addDays(now, 1));
  const twoDaysStr = formatDate(addDays(now, 2));
  const upcomingApts = (db.appointments || []).filter(
    apt => apt.status === 'upcoming' && (apt.date === todayStr || apt.date === tomorrowStr || apt.date === twoDaysStr)
  );

  for (const apt of upcomingApts) {
    if (hasReminderBeenSent('upcoming_appointment', apt.id, apt.date)) {
      continue;
    }

    const subject = `🗓️ Appointment Reminder: ${apt.doctorName} on ${apt.date} at ${apt.time}`;
    const html = buildReminderHtml({
      title: 'Doctor Appointment Reminder',
      heading: `Upcoming Appointment for ${profile.name}`,
      message: `You have an upcoming medical consultation scheduled.`,
      details: `
        <strong>Doctor:</strong> ${apt.doctorName} (${apt.specialty || 'General'})<br>
        <strong>Purpose:</strong> ${apt.title}<br>
        <strong>Date & Time:</strong> ${apt.date} at ${apt.time}<br>
        <strong>Location:</strong> ${apt.location || 'Consultation Office'}<br>
        <strong>Notes:</strong> ${apt.notes || 'None'}
      `
    });

    const sendResult = await sendEmail({
      toEmail: caretakerEmail,
      toName: profile.emergencyContact?.name || 'Caretaker',
      subject,
      htmlContent: html
    });

    logReminder({
      reminderType: 'upcoming_appointment',
      targetId: apt.id,
      date: apt.date,
      timeSlot: apt.time,
      recipient: caretakerEmail,
      channel: 'brevo_email',
      simulated: sendResult.simulated,
      subject
    });

    addActivityLog(
      'APPOINTMENT_REMINDER_SENT',
      `Upcoming appointment reminder for ${apt.doctorName} sent to ${caretakerEmail}`,
      'system',
      'reminder'
    );

    results.push({
      type: 'upcoming_appointment',
      doctor: apt.doctorName,
      date: apt.date,
      time: apt.time,
      recipient: caretakerEmail
    });
  }

  return {
    processed: true,
    timestamp: now.toISOString(),
    sentCount: results.length,
    reminders: results
  };
}

/**
 * Send an on-demand test reminder triggered from the UI
 */
async function sendTestReminder(recipientEmail) {
  const db = getDb();
  const profile = db.profile;
  const targetEmail = recipientEmail || profile.emergencyContact?.email || 'caretaker@example.com';
  const targetName = profile.emergencyContact?.name || 'CareCircle Caretaker';

  const subject = `🔔 [Test Reminder] CareCircle Health Notification for ${profile.name}`;
  const html = buildReminderHtml({
    title: 'Test Health Reminder',
    heading: `CareCircle Automated Reminder System Test`,
    message: `This is a live test notification generated from the CareCircle dashboard. All email and alert dispatch pipelines are operating normally.`,
    details: `
      <strong>Elder Patient:</strong> ${profile.name} (Age ${profile.age})<br>
      <strong>Primary Physician:</strong> ${profile.primaryDoctor}<br>
      <strong>Active Prescriptions:</strong> ${(db.medications || []).length} active medications<br>
      <strong>Next Appointment:</strong> ${(db.appointments || [])[0]?.title || 'None'} (${(db.appointments || [])[0]?.date || ''})<br>
      <strong>Timestamp:</strong> ${new Date().toLocaleString()}
    `
  });

  const sendResult = await sendEmail({
    toEmail: targetEmail,
    toName: targetName,
    subject,
    htmlContent: html
  });

  logReminder({
    reminderType: 'manual_test_reminder',
    targetId: 'test-trigger',
    date: formatDate(new Date()),
    timeSlot: new Date().toLocaleTimeString(),
    recipient: targetEmail,
    channel: 'brevo_email',
    simulated: sendResult.simulated,
    subject
  });

  addActivityLog(
    'TEST_REMINDER_SENT',
    `Manual test reminder triggered and dispatched to ${targetEmail} (${sendResult.simulated ? 'Simulated Console' : 'Brevo Delivery'})`,
    'user',
    'reminder'
  );

  return {
    success: true,
    simulated: sendResult.simulated,
    recipient: targetEmail,
    subject,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  runReminders,
  sendTestReminder
};
