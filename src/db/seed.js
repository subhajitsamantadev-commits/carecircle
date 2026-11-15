const bcrypt = require('bcryptjs');

/**
 * Format a Date object to YYYY-MM-DD
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add days to a Date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Auto-seeds demo data with dynamic dates relative to today
 */
function generateDemoData() {
  const now = new Date();
  const todayStr = formatDate(now);

  // Hash passcodes for the three roles:
  // Elder: '1234'
  // Caretaker: '5678'
  // Family: '9012'
  const salt = bcrypt.genSaltSync(10);
  const elderPasscodeHash = bcrypt.hashSync('1234', salt);
  const caretakerPasscodeHash = bcrypt.hashSync('5678', salt);
  const familyPasscodeHash = bcrypt.hashSync('9012', salt);

  const profile = {
    id: 'prof-eleanor-vance',
    name: 'Eleanor Vance',
    preferredName: 'Ellie',
    age: 78,
    dateOfBirth: '1948-04-12',
    gender: 'Female',
    bloodType: 'O+',
    allergies: ['Penicillin', 'Sulfa drugs'],
    conditions: ['Hypertension', 'Type 2 Diabetes', 'Mild Osteoarthritis'],
    primaryDoctor: 'Dr. Sarah Jenkins (Cardiology & Internal Medicine)',
    emergencyContact: {
      name: 'Marcus Vance',
      relation: 'Son & Primary Caretaker',
      phone: '+1 (555) 234-5678',
      email: 'caretaker@example.com'
    },
    familyContact: {
      name: 'Sophia Vance',
      relation: 'Granddaughter',
      phone: '+1 (555) 876-5432',
      email: 'family@example.com'
    },
    passcodes: {
      elder: elderPasscodeHash,
      caretaker: caretakerPasscodeHash,
      family: familyPasscodeHash
    },
    elderModeDefault: true,
    updatedAt: now.toISOString()
  };

  const medications = [
    {
      id: 'med-1',
      name: 'Metformin',
      dosage: '500mg',
      instructions: 'Take 1 tablet twice daily with meals to regulate blood sugar',
      purpose: 'Type 2 Diabetes',
      scheduleTimes: ['08:00', '20:00'],
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      prescribedBy: 'Dr. Sarah Jenkins',
      refillRemaining: 45,
      active: true,
      color: '#3b82f6',
      icon: 'pill',
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString()
    },
    {
      id: 'med-2',
      name: 'Lisinopril',
      dosage: '10mg',
      instructions: 'Take 1 tablet every morning with a full glass of water',
      purpose: 'Hypertension (Blood Pressure)',
      scheduleTimes: ['08:00'],
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      prescribedBy: 'Dr. Sarah Jenkins',
      refillRemaining: 20,
      active: true,
      color: '#10b981',
      icon: 'tablet',
      createdAt: new Date(now.getTime() - 40 * 86400000).toISOString()
    },
    {
      id: 'med-3',
      name: 'Glipizide',
      dosage: '5mg',
      instructions: 'Take 1 tablet 30 minutes before breakfast',
      purpose: 'Insulin sensitivity',
      scheduleTimes: ['07:30'],
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      prescribedBy: 'Dr. Sarah Jenkins',
      refillRemaining: 15,
      active: true,
      color: '#f59e0b',
      icon: 'capsule',
      createdAt: new Date(now.getTime() - 25 * 86400000).toISOString()
    },
    {
      id: 'med-4',
      name: 'Calcium & Vitamin D3',
      dosage: '600mg / 400IU',
      instructions: 'Take 1 tablet at lunchtime with food',
      purpose: 'Bone Density & Joint Support',
      scheduleTimes: ['12:30'],
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      prescribedBy: 'Dr. Robert Chen',
      refillRemaining: 60,
      active: true,
      color: '#8b5cf6',
      icon: 'sun',
      createdAt: new Date(now.getTime() - 60 * 86400000).toISOString()
    },
    {
      id: 'med-5',
      name: 'Atorvastatin',
      dosage: '20mg',
      instructions: 'Take 1 tablet at bedtime',
      purpose: 'Cholesterol Regulation',
      scheduleTimes: ['21:00'],
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      prescribedBy: 'Dr. Sarah Jenkins',
      refillRemaining: 30,
      active: true,
      color: '#ec4899',
      icon: 'moon',
      createdAt: new Date(now.getTime() - 50 * 86400000).toISOString()
    }
  ];

  // Generate 7-day adherence dose logs
  const doseLogs = [];
  let logIdCounter = 1;

  for (let offset = -6; offset <= 0; offset++) {
    const targetDate = addDays(now, offset);
    const dateStr = formatDate(targetDate);
    const isToday = offset === 0;

    medications.forEach((med) => {
      med.scheduleTimes.forEach((timeSlot) => {
        // Decide status for realistic adherence:
        // Past days: ~90% taken, occasional missed
        // Today: morning doses taken, later pending (or can be marked)
        let status = 'taken';
        let loggedBy = 'elder';

        if (isToday) {
          const hour = parseInt(timeSlot.split(':')[0], 10);
          const currentHour = now.getHours();
          if (hour <= currentHour) {
            status = 'taken';
            loggedBy = 'elder';
          } else {
            // Still pending today
            return;
          }
        } else {
          // A couple of missed doses for visual adherence variety
          if (offset === -4 && med.id === 'med-4') {
            status = 'missed';
            loggedBy = 'system';
          } else if (offset === -2 && med.id === 'med-5') {
            status = 'missed';
            loggedBy = 'system';
          } else if (offset === -5 && med.id === 'med-1' && timeSlot === '20:00') {
            status = 'missed';
            loggedBy = 'caretaker';
          }
        }

        const logTime = new Date(`${dateStr}T${timeSlot}:00`);
        doseLogs.push({
          id: `dose-${logIdCounter++}`,
          medicationId: med.id,
          medicationName: med.name,
          dosage: med.dosage,
          scheduledTime: timeSlot,
          date: dateStr,
          status: status,
          loggedAt: logTime.toISOString(),
          loggedBy: loggedBy,
          notes: status === 'missed' ? 'Elder was resting away from home' : 'Taken with water'
        });
      });
    });
  }

  // Demo Appointments
  const appointments = [
    {
      id: 'apt-1',
      doctorName: 'Dr. Sarah Jenkins',
      specialty: 'Cardiology & Internal Medicine',
      title: 'Quarterly Cardiovascular & Diabetes Checkup',
      date: formatDate(addDays(now, 1)),
      time: '10:30',
      location: 'St. Jude Health Pavilion, Suite 402, 100 Main St.',
      notes: 'Bring current glucose logs and medication list. Fasting required after midnight.',
      phone: '+1 (555) 901-2345',
      status: 'upcoming',
      createdAt: new Date(now.getTime() - 7 * 86400000).toISOString()
    },
    {
      id: 'apt-2',
      doctorName: 'Dr. Robert Chen',
      specialty: 'Orthopedics & Joint Health',
      title: 'Knee Mobility Assessment & Physical Therapy Review',
      date: formatDate(addDays(now, 4)),
      time: '14:00',
      location: 'City Center Orthopedic Wing, Room 215',
      notes: 'Discuss mild right knee stiffness during morning walks.',
      phone: '+1 (555) 432-1098',
      status: 'upcoming',
      createdAt: new Date(now.getTime() - 5 * 86400000).toISOString()
    },
    {
      id: 'apt-3',
      doctorName: 'Dr. Emily Walsh',
      specialty: 'Ophthalmology',
      title: 'Annual Diabetic Retinopathy & Vision Screening',
      date: formatDate(addDays(now, 12)),
      time: '11:15',
      location: 'ClearVision Eye Center, 45 West Oak Ave',
      notes: 'Pupil dilation test will be performed. Caretaker transportation arranged.',
      phone: '+1 (555) 678-9012',
      status: 'upcoming',
      createdAt: new Date(now.getTime() - 2 * 86400000).toISOString()
    }
  ];

  // Activity Log
  const activityLogs = [
    {
      id: 'act-1',
      timestamp: new Date(now.getTime() - 3600000 * 3).toISOString(),
      action: 'SYSTEM_BOOT',
      description: 'CareCircle platform initialized and demo data auto-seeded',
      performedBy: 'system',
      category: 'system'
    },
    {
      id: 'act-2',
      timestamp: new Date(now.getTime() - 3600000 * 2).toISOString(),
      action: 'DOSE_TAKEN',
      description: 'Marked Lisinopril 10mg (08:00) as TAKEN',
      performedBy: 'elder',
      category: 'medication'
    },
    {
      id: 'act-3',
      timestamp: new Date(now.getTime() - 3600000 * 2).toISOString(),
      action: 'DOSE_TAKEN',
      description: 'Marked Metformin 500mg (08:00) as TAKEN',
      performedBy: 'elder',
      category: 'medication'
    },
    {
      id: 'act-4',
      timestamp: new Date(now.getTime() - 3600000 * 1).toISOString(),
      action: 'APPOINTMENT_SCHEDULED',
      description: 'Scheduled Cardiology appointment with Dr. Sarah Jenkins',
      performedBy: 'caretaker',
      category: 'appointment'
    }
  ];

  // Reminder Logs (used for deduplication)
  const reminderLogs = [
    {
      id: 'rem-init-1',
      reminderType: 'morning_dose_reminder',
      targetId: 'med-1',
      date: todayStr,
      timeSlot: '08:00',
      recipient: 'caretaker@example.com',
      sentAt: new Date(now.getTime() - 3600000 * 2.5).toISOString(),
      channel: 'brevo_email',
      simulated: true,
      subject: 'Morning Medication Reminder: Eleanor Vance'
    }
  ];

  return {
    profile,
    medications,
    doseLogs,
    appointments,
    activityLogs,
    reminderLogs,
    metadata: {
      seededAt: now.toISOString(),
      version: '1.0.0'
    }
  };
}

module.exports = {
  generateDemoData,
  formatDate,
  addDays
};
