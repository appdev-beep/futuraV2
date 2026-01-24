// backend/tools/test_email_send.js
// Usage:
//  node backend/tools/test_email_send.js [recipient@example.com]
// If no recipient provided, the script will only require the email service to trigger transporter.verify logs.

const recipient = process.argv[2] || process.env.SMTP_TEST_RECIPIENT || null;

console.log('[TEST EMAIL] Starting test script. Recipient:', recipient || '(none)');

// Require the email service which performs transporter.verify on import
const emailService = require('../services/email.service');

if (!recipient) {
  console.log('[TEST EMAIL] No recipient provided; transporter verify should have printed above. Exiting.');
  process.exit(0);
}

(async () => {
  try {
    const res = await emailService.sendEmail({
      to: recipient,
      subject: 'Test email from Futura dev script',
      text: 'This is a test email to verify SMTP connectivity.',
      html: '<p>This is a test email to verify SMTP connectivity.</p>'
    });

    if (res) console.log('[TEST EMAIL] sendEmail returned:', res.messageId || res);
    else console.error('[TEST EMAIL] sendEmail returned null or failed');
  } catch (e) {
    console.error('[TEST EMAIL] sendEmail threw:', e && e.message ? e.message : e);
  }
})();
