const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { initDb } = require('./db/db');

// Route imports
const authRoutes = require('./routes/auth');
const medicationRoutes = require('./routes/medications');
const doseRoutes = require('./routes/doses');
const adherenceRoutes = require('./routes/adherence');
const appointmentRoutes = require('./routes/appointments');
const activityRoutes = require('./routes/activityLogs');
const cronRoutes = require('./routes/cron');
const aiRoutes = require('./routes/ai');

// Initialize database with fresh demo data on every start as required
initDb();

const app = express();

// Security Headers with Helmet
// Allow inline styles and local scripts for single-page dashboard functionality
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Body and Cookie Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 login attempts per 15 min
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);

// Health Check Endpoint
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CareCircle',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/doses', doseRoutes);
app.use('/api/adherence', adherenceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/activity-logs', activityRoutes);
app.use('/api', cronRoutes);
app.use('/api/ai', aiRoutes);

// Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.stack || err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(config.nodeEnv === 'development' ? { stack: err.stack } : {})
  });
});

// Start Server when run directly
let server = null;
if (require.main === module) {
  server = app.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`💙 CareCircle Elderly Care Platform is running!`);
    console.log(`📡 URL: http://localhost:${config.port}`);
    console.log(`🏥 Health Check: http://localhost:${config.port}/healthz`);
    console.log(`🔑 Demo Passcodes:`);
    console.log(`   - Elder:     1234  (Full dose tracking & dashboard)`);
    console.log(`   - Caretaker: 5678  (Full management access)`);
    console.log(`   - Family:    9012  (View-Only dashboard)`);
    console.log(`======================================================\n`);
  });
}

module.exports = { app, server };
