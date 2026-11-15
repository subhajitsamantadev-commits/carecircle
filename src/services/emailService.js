const config = require('../config');

/**
 * Send an email via Brevo HTTP API or gracefully simulate in console
 */
async function sendEmail({ toEmail, toName, subject, htmlContent, textContent }) {
  const plainText = textContent || htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // If no Brevo API key is configured, log to console
  if (!config.brevoApiKey) {
    console.log('\n================== [BREVO EMAIL SIMULATOR] ==================');
    console.log(`[Status] Simulated (BREVO_API_KEY is not set)`);
    console.log(`[To]     ${toName || 'User'} <${toEmail}>`);
    console.log(`[From]   ${config.brevoSenderName} <${config.brevoSenderEmail}>`);
    console.log(`[Subject] ${subject}`);
    console.log(`[Date]   ${new Date().toISOString()}`);
    console.log('--------------------------- Body ---------------------------');
    console.log(plainText);
    console.log('============================================================\n');

    return {
      success: true,
      simulated: true,
      recipient: toEmail,
      subject,
      timestamp: new Date().toISOString()
    };
  }

  // Attempt real Brevo API delivery
  try {
    const payload = {
      sender: {
        name: config.brevoSenderName,
        email: config.brevoSenderEmail
      },
      to: [
        {
          email: toEmail,
          name: toName || toEmail
        }
      ],
      subject: subject,
      htmlContent: htmlContent,
      textContent: plainText
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': config.brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`[Brevo] API responded with ${response.status}: ${errorBody}. Falling back to console simulation.`);
      return {
        success: true,
        simulated: true,
        warning: `Brevo API error: ${response.status}`,
        recipient: toEmail,
        subject,
        timestamp: new Date().toISOString()
      };
    }

    const data = await response.json();
    console.log(`[Brevo] Email successfully delivered to ${toEmail}. Message ID: ${data.messageId}`);
    return {
      success: true,
      simulated: false,
      messageId: data.messageId,
      recipient: toEmail,
      subject,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error(`[Brevo] Network error sending email: ${err.message}. Logging to console.`);
    return {
      success: true,
      simulated: true,
      warning: err.message,
      recipient: toEmail,
      subject,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Generate formatted HTML template for CareCircle reminders
 */
function buildReminderHtml({ title, heading, message, details, actionUrl }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
    .logo { font-size: 20px; font-weight: 800; color: #1e40af; text-decoration: none; }
    .badge { background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; }
    .title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; }
    .content { font-size: 16px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .details-box { background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin: 20px 0; font-size: 15px; }
    .footer { font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 32px; text-align: center; }
    .alert-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 6px; margin: 20px 0; color: #991b1b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="logo">💊 CareCircle Health</span>
      <span class="badge">${title || 'Notice'}</span>
    </div>
    <h2 class="title">${heading}</h2>
    <div class="content">${message}</div>
    ${details ? `<div class="details-box">${details}</div>` : ''}
    <div class="footer">
      This is an automated health reminder for Eleanor Vance from CareCircle.<br>
      Please do not reply directly to this automated email.
    </div>
  </div>
</body>
</html>
  `.trim();
}

module.exports = {
  sendEmail,
  buildReminderHtml
};
