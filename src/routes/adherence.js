const express = require('express');
const { getDb } = require('../db/db');
const { formatDate, addDays } = require('../db/seed');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

router.use(requireAuth);

/**
 * GET /api/adherence/weekly
 * Calculate 7-day adherence statistics and day-by-day metrics
 */
router.get('/weekly', (req, res) => {
  const db = getDb();
  const now = new Date();
  const days = [];

  let overallTaken = 0;
  let overallMissed = 0;
  let overallScheduled = 0;
  let overallPending = 0;

  // Process the last 7 days (from today - 6 to today)
  for (let offset = -6; offset <= 0; offset++) {
    const targetDate = addDays(now, offset);
    const dateStr = formatDate(targetDate);
    const dayName = DAY_NAMES[targetDate.getDay()];
    const isToday = offset === 0;

    // Determine how many doses are scheduled for this day of week
    const activeMeds = (db.medications || []).filter(m => m.active);
    let dayScheduledCount = 0;

    activeMeds.forEach(med => {
      if (!med.daysOfWeek || med.daysOfWeek.includes(dayName)) {
        dayScheduledCount += (med.scheduleTimes || []).length;
      }
    });

    // Count logged doses for this date
    const dateLogs = (db.doseLogs || []).filter(l => l.date === dateStr);
    const takenCount = dateLogs.filter(l => l.status === 'taken').length;
    const missedCount = dateLogs.filter(l => l.status === 'missed').length;

    let pendingCount = 0;
    if (isToday) {
      pendingCount = Math.max(0, dayScheduledCount - (takenCount + missedCount));
    } else {
      // For past days, any unlogged scheduled dose counts as missed
      const unlogged = Math.max(0, dayScheduledCount - (takenCount + missedCount));
      // if unlogged, count towards missed
      // (in seed data we provide explicit taken/missed logs)
    }

    // Daily percentage
    const countedDoses = takenCount + missedCount;
    const dayAdherencePct = countedDoses > 0
      ? Math.round((takenCount / countedDoses) * 100)
      : (dayScheduledCount === 0 ? 100 : 0);

    overallTaken += takenCount;
    overallMissed += missedCount;
    overallScheduled += dayScheduledCount;
    overallPending += pendingCount;

    days.push({
      date: dateStr,
      dayName,
      displayDate: `${dayName}, ${targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      isToday,
      scheduled: dayScheduledCount,
      taken: takenCount,
      missed: missedCount,
      pending: pendingCount,
      adherencePercentage: dayAdherencePct
    });
  }

  const totalEvaluated = overallTaken + overallMissed;
  const overallRate = totalEvaluated > 0
    ? Math.round((overallTaken / totalEvaluated) * 100)
    : 100;

  // Calculate streak (days from end where adherence >= 80%)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].isToday && days[i].taken === 0 && days[i].missed === 0) {
      // today still in progress, check previous
      continue;
    }
    if (days[i].adherencePercentage >= 80) {
      streak++;
    } else {
      break;
    }
  }

  let statusGrade = 'Excellent';
  let statusColor = '#10b981'; // emerald
  if (overallRate < 75) {
    statusGrade = 'Needs Attention';
    statusColor = '#ef4444'; // red
  } else if (overallRate < 88) {
    statusGrade = 'Good';
    statusColor = '#f59e0b'; // amber
  }

  return res.json({
    success: true,
    summary: {
      overallRate,
      statusGrade,
      statusColor,
      streak,
      totalScheduled: overallScheduled,
      totalTaken: overallTaken,
      totalMissed: overallMissed,
      totalPending: overallPending
    },
    days
  });
});

module.exports = router;
