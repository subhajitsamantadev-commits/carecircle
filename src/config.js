require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'carecircle-super-secret-key-hackathon-2026',
  cronSecret: process.env.CRON_SECRET || 'carecircle-cron-secret-token',
  
  // Brevo API settings
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || 'alerts@carecircle.health',
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'CareCircle Health',

  // Google Gemini API settings
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  // Demo passcodes (plain text reference, hashed in DB)
  demoPasscodes: {
    elder: '1234',
    caretaker: '5678',
    family: '9012'
  }
};

module.exports = config;
