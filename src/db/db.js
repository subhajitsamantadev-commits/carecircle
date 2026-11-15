const fs = require('fs');
const path = require('path');
const { generateDemoData } = require('./seed');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'carecircle-db.json');

let inMemoryDb = null;

/**
 * Ensure data directory exists
 */
function ensureDirectoryExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    // Ignore transient mkdir error if directory already exists
    if (!fs.existsSync(DATA_DIR)) {
      console.warn('[DB] Warning ensuring directory:', err.message);
    }
  }
}

/**
 * Initialize and AUTO-SEED demo data on every start
 */
function initDb() {
  ensureDirectoryExists();
  console.log('[DB] Initializing database: Auto-seeding fresh demo data on startup...');
  const seedData = generateDemoData();
  inMemoryDb = seedData;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData, null, 2), 'utf8');
    console.log('[DB] Database seeded successfully at', DB_FILE);
  } catch (err) {
    console.warn('[DB] Warning writing DB to disk (running in memory):', err.message);
  }
  return inMemoryDb;
}

/**
 * Read DB from memory or file
 */
function getDb() {
  if (!inMemoryDb) {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        inMemoryDb = JSON.parse(raw);
      } catch (err) {
        console.error('[DB] Failed reading DB file, re-seeding:', err.message);
        return initDb();
      }
    } else {
      return initDb();
    }
  }
  return inMemoryDb;
}

/**
 * Save DB state to file
 */
function saveDb(data) {
  ensureDirectoryExists();
  inMemoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryDb, null, 2), 'utf8');
  } catch (err) {
    console.warn('[DB] Persistent disk write warning (operating in-memory):', err.message);
  }
  return inMemoryDb;
}

/**
 * Append an activity audit entry
 */
function addActivityLog(action, description, performedBy = 'system', category = 'general') {
  const db = getDb();
  if (!db.activityLogs) {
    db.activityLogs = [];
  }
  const entry = {
    id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    action,
    description,
    performedBy,
    category
  };
  db.activityLogs.unshift(entry);
  // Keep last 150 items to manage file size
  if (db.activityLogs.length > 150) {
    db.activityLogs = db.activityLogs.slice(0, 150);
  }
  saveDb(db);
  return entry;
}

/**
 * Check if a reminder has already been logged to avoid duplicates
 */
function hasReminderBeenSent(reminderType, targetId, date, timeSlot = '') {
  const db = getDb();
  if (!db.reminderLogs) return false;
  return db.reminderLogs.some((log) => {
    return (
      log.reminderType === reminderType &&
      log.targetId === targetId &&
      log.date === date &&
      (timeSlot ? log.timeSlot === timeSlot : true)
    );
  });
}

/**
 * Record a sent/simulated reminder
 */
function logReminder(reminderData) {
  const db = getDb();
  if (!db.reminderLogs) {
    db.reminderLogs = [];
  }
  const entry = {
    id: `rem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    sentAt: new Date().toISOString(),
    ...reminderData
  };
  db.reminderLogs.unshift(entry);
  saveDb(db);
  return entry;
}

module.exports = {
  initDb,
  getDb,
  saveDb,
  addActivityLog,
  hasReminderBeenSent,
  logReminder,
  DB_FILE
};
