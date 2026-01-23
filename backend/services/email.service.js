// backend/services/email.service.js
const nodemailer = require('nodemailer');
const { db } = require('../config/db');

// Use a real mailbox as sender (Gmail requires authenticated "from" to be valid)
const notifier = process.env.NOTIFIER_EMAIL || process.env.SMTP_USER || 'notification.alert@equicomservices.com';

// -----------------------------
// Helpers
// -----------------------------
const toBool = (val, defaultVal = false) => {
  if (val === undefined || val === null) return defaultVal;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  return defaultVal;
};

const toInt = (val, defaultVal) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : defaultVal;
};

// -----------------------------
// Configure transporter
// -----------------------------
const smtpOptions = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: toInt(process.env.SMTP_PORT, 587),
  secure: toBool(process.env.SMTP_SECURE, false), // false for 587 (STARTTLS)
  requireTLS: true, // force STARTTLS on 587 (recommended for Gmail)
  pool: toBool(process.env.SMTP_POOL, true),
  maxConnections: toInt(process.env.SMTP_MAX_CONNECTIONS, 1),
  maxMessages: toInt(process.env.SMTP_MAX_MESSAGES, 10),
  // Optional: avoid IPv6 issues in some networks
  // family: 4,
};

// Optional rate limiting supported by Nodemailer SMTP transport
if (process.env.SMTP_RATE_DELTA) smtpOptions.rateDelta = toInt(process.env.SMTP_RATE_DELTA, 1000);
if (process.env.SMTP_RATE_LIMIT) smtpOptions.rateLimit = toInt(process.env.SMTP_RATE_LIMIT, 5);

// Auth (Gmail app password)
if (process.env.SMTP_USER) {
  smtpOptions.auth = {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || '',
  };
}

const transporter = nodemailer.createTransport(smtpOptions);

// Optional: verify connection on startup (won't crash app if fails)
transporter.verify((err) => {
  if (err) {
    console.log('[EMAIL] Transport verify failed:', err.message);
  } else {
    console.log('[EMAIL] Transport ready');
  }
});

// Utility delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// =====================================================
// SEND EMAIL HELPER WITH RETRY LOGIC
// =====================================================
async function sendEmail({ to, subject, text, html }, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s

  try {
    if (retryCount === 0) await delay(500);

    const info = await transporter.sendMail({
      from: `Futura System <${notifier}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('[EMAIL] Sent:', info.messageId);
    return info;
  } catch (error) {
    console.error(
      `[EMAIL] Failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`,
      error.message
    );

    // Retryable: connection + temporary SMTP failures
    const isRetryable =
      error.code === 'ECONNECTION' ||
      error.code === 'ETIMEDOUT' ||
      error.responseCode === 421 ||
      error.responseCode === 450 ||
      error.responseCode === 451 ||
      error.responseCode === 452;

    if (isRetryable && retryCount < MAX_RETRIES) {
      const wait = RETRY_DELAYS[retryCount] || 5000;
      console.log(`[EMAIL] Retrying in ${wait}ms...`);
      await delay(wait);
      return sendEmail({ to, subject, text, html }, retryCount + 1);
    }

    console.error('[EMAIL] Send failed after retries:', error);
    return null;
  }
}

// =====================================================
// GET USER EMAIL BY ID
// =====================================================
async function getUserEmail(userId) {
  const [rows] = await db.query(
    `SELECT email, name FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  return rows.length ? rows[0] : null;
}

// =====================================================
// GET SUPERVISOR EMAIL FROM CL
// =====================================================
async function getSupervisorEmail(clId) {
  const [rows] = await db.query(
    `SELECT u.id, u.email, u.name
     FROM cl_headers h
     JOIN users u ON h.supervisor_id = u.id
     WHERE h.id = ? LIMIT 1`,
    [clId]
  );
  return rows.length ? rows[0] : null;
}

// =====================================================
// GET HR EMAILS (ALL HR USERS)
// =====================================================
async function getHREmails() {
  const [rows] = await db.query(
    `SELECT id, email, name FROM users WHERE role = 'HR'`
  );
  return rows || [];
}

// =====================================================
// SEND CL NOTIFICATION EMAIL TO EMPLOYEE (AND SUPERVISOR FOR FINAL APPROVAL)
// =====================================================
async function sendCLNotificationEmail({
  clId,
  employeeId,
  actionType,
  actorName,
  actorRole,
  employeeName,
  employeeCode,
  remarks = null,
  requiresEmployeeAction = false,
}) {
  try {
    console.log(`[EMAIL] CL #${clId} | ActionType: ${actionType} | EmployeeId: ${employeeId}`);

    const employee = await getUserEmail(employeeId);
    if (!employee) {
      console.error(`[EMAIL] Employee user ${employeeId} not found`);
      return;
    }

    const supervisor = await getSupervisorEmail(clId);

    let hrUsers = [];
    if (actionType === 'CREATED') {
      hrUsers = await getHREmails();
      if (hrUsers.length > 0) console.log(`[EMAIL] Also notifying ${hrUsers.length} HR user(s)`);
    }

    let subject = '';
    let htmlContent = '';
    let textContent = '';

    const employeeInfo = `${employeeName} (${employeeCode})`;
    const currentDateTime = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    switch (actionType) {
      case 'CREATED':
        subject = `Your Competency Leveling Form Has Been Created - CL #${clId}`;
        htmlContent = `
              <h3 style="color: #0b61ff;">Competency Leveling Form Created</h3>
              <p style="color: #0b2b5f;">Hello <strong>${employee.name}</strong>,</p>
              <p style="color: #0b2b5f;">Your Competency Leveling form <strong>#${clId}</strong> has been successfully created by your supervisor.</p>
              <p style="color: #0b2b5f;"><strong>Employee:</strong> ${employeeInfo}</p>
              <p style="color: #0b2b5f;"><strong>Created by:</strong> ${actorName} (${actorRole})</p>
              <p style="color: #0b2b5f;"><strong>Date & Time:</strong> ${currentDateTime}</p>
              <p style="color: #0b2b5f;"><strong>Status:</strong> The form is now under review process.</p>
              <p style="color: #0b2b5f;">You will receive notifications as your form progresses through the approval workflow.</p>
              <hr/>
              <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
            `;
        textContent =
          `Your Competency Leveling Form Has Been Created\n\n` +
          `Hello ${employee.name},\n\n` +
          `Your Competency Leveling form #${clId} has been successfully created by your supervisor.\n\n` +
          `Created by: ${actorName} (${actorRole})\n` +
          `Date & Time: ${currentDateTime}\n` +
          `Status: The form is now under review process.\n\n` +
          `You will receive notifications as your form progresses through the approval workflow.`;
        break;

      case 'RESUBMITTED':
        subject = `Your CL Form #${clId} Has Been Resubmitted for Review`;
        htmlContent = `
          <h3 style="color: #0b61ff;">CL Form Resubmitted</h3>
          <p style="color: #0b2b5f;">Hello <strong>${employee.name}</strong>,</p>
          <p style="color: #0b2b5f;">Your CL form <strong>#${clId}</strong> has been revised and resubmitted by your supervisor.</p>
          <p style="color: #0b2b5f;"><strong>Resubmitted by:</strong> ${actorName} (${actorRole})</p>
          <p style="color: #0b2b5f;"><strong>Date & Time:</strong> ${currentDateTime}</p>
          ${remarks ? `<p style="color: #0b2b5f;"><strong>Supervisor Notes:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p style="color: #0b2b5f;"><strong>Status:</strong> The form is now back in the approval workflow.</p>
          <p style="color: #0b2b5f;">You will receive notifications as your form progresses through the approval process.</p>
          <hr/>
          <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
        `;
        textContent =
          `Your CL Form Has Been Resubmitted for Review\n\n` +
          `Hello ${employee.name},\n\n` +
          `Your CL form #${clId} has been revised and resubmitted by your supervisor.\n\n` +
          `Resubmitted by: ${actorName} (${actorRole})\n` +
          `Date & Time: ${currentDateTime}\n` +
          (remarks ? `Supervisor Notes: ${remarks}\n\n` : '\n') +
          `Status: The form is now back in the approval workflow.\n\n` +
          `You will receive notifications as your form progresses through the approval process.`;
        break;

      case 'RETURNED':
        subject = `Your CL Form #${clId} Has Been Returned for Revision`;
        htmlContent = `
          <h3 style="color: #0b61ff;">CL Form Returned for Revision</h3>
          <p style="color: #0b2b5f;">Hello <strong>${employee.name}</strong>,</p>
          <p style="color: #0b2b5f;">Your CL form <strong>#${clId}</strong> has been returned for revision.</p>
          <p style="color: #0b2b5f;"><strong>Employee:</strong> ${employeeInfo}</p>
          <p style="color: #0b2b5f;"><strong>Returned by:</strong> ${actorName} (${actorRole})</p>
          <p style="color: #0b2b5f;"><strong>Date & Time:</strong> ${currentDateTime}</p>
          ${remarks ? `<p style="color: #0b2b5f;"><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p style="color: #0b2b5f;">Your supervisor will revise the form and resubmit it.</p>
          <hr/>
          <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
        `;
        textContent =
          `Your CL Form Has Been Returned for Revision\n\n` +
          `Hello ${employee.name},\n\n` +
          `Your CL form #${clId} has been returned for revision.\n\n` +
          `Employee: ${employeeInfo}\n` +
          `Returned by: ${actorName} (${actorRole})\n` +
          `Date & Time: ${currentDateTime}\n` +
          (remarks ? `Remarks: ${remarks}\n\n` : '\n') +
          `Your supervisor will revise the form and resubmit it.`;
        break;

      case 'APPROVED':
        subject = `Your CL Form #${clId} Has Been Approved by ${actorRole}`;
        htmlContent = `
          <h3 style="color: #0b61ff;">CL Form Approved</h3>
          <p style="color: #0b2b5f;">Hello <strong>${employee.name}</strong>,</p>
          <p style="color: #0b2b5f;">Good news! Your CL form <strong>#${clId}</strong> has been approved by ${actorRole}.</p>
          <p style="color: #0b2b5f;"><strong>Approved by:</strong> ${actorName} (${actorRole})</p>
          <p style="color: #0b2b5f;"><strong>Date & Time:</strong> ${currentDateTime}</p>
          ${remarks ? `<p style="color: #0b2b5f;"><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          ${
            requiresEmployeeAction
              ? `<p style="color: #0b2b5f;"><strong>⚠️ Action Required:</strong> Your form now requires <strong>your review and approval</strong>. Please log in to the system to review and approve your CL form.</p>`
              : `<p style="color: #0b2b5f;"><strong>Status:</strong> Your form is now proceeding to the next approval stage.</p>`
          }
          <hr/>
          <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
        `;
        textContent =
          `Your CL Form Has Been Approved by ${actorRole}\n\n` +
          `Hello ${employee.name},\n\n` +
          `Good news! Your CL form #${clId} has been approved by ${actorRole}.\n\n` +
          `Approved by: ${actorName} (${actorRole})\n` +
          `Date & Time: ${currentDateTime}\n` +
          (remarks ? `Remarks: ${remarks}\n\n` : '\n') +
          (requiresEmployeeAction
            ? `Action Required: Your form now requires your review and approval. Please log in to the system to review and approve your CL form.`
            : `Status: Your form is now proceeding to the next approval stage.`);
        break;

      case 'FINAL_APPROVED':
        subject = `Congratulations! CL #${clId} Has Been Fully Approved and Locked`;
        htmlContent = `
          <h3 style="color: #0b61ff;">CL Form Final Approval</h3>
          <p style="color: #0b2b5f;">Hello <strong>${employee.name}</strong>,</p>
          <p style="color: #0b2b5f;">Congratulations! Your CL form <strong>#${clId}</strong> has been fully approved by HR and is now <strong>locked</strong>.</p>
          <p style="color: #0b2b5f;"><strong>Employee:</strong> ${employeeInfo}</p>
          <p style="color: #0b2b5f;"><strong>Approved by:</strong> ${actorName} (${actorRole})</p>
          <p style="color: #0b2b5f;"><strong>Date & Time:</strong> ${currentDateTime}</p>
          ${remarks ? `<p style="color: #0b2b5f;"><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p style="color: #0b2b5f;"><strong>✅ Status:</strong> The competency assessment is now finalized and locked. No further changes can be made.</p>
          <p style="color: #0b2b5f;"><strong>📋 Next Steps:</strong> You can now proceed to create the Individual Development Plan (IDP).</p>
          <hr/>
          <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
        `;
        textContent =
          `Congratulations! CL Form Has Been Fully Approved and Locked\n\n` +
          `Hello ${employee.name},\n\n` +
          `Your CL form #${clId} has been fully approved by HR and is now locked.\n\n` +
          `Employee: ${employeeInfo}\n` +
          `Approved by: ${actorName} (${actorRole})\n` +
          `Date & Time: ${currentDateTime}\n` +
          (remarks ? `Remarks: ${remarks}\n\n` : '\n') +
          `Status: The competency assessment is now finalized and locked. No further changes can be made.\n` +
          `Next Steps: You can now proceed to create the Individual Development Plan (IDP).`;
        break;

      default:
        console.error(`[EMAIL] Unknown action type: ${actionType}`);
        return;
    }

    // Send email to employee
    const employeeResult = await sendEmail({
      to: employee.email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    if (employeeResult) {
      console.log(`[EMAIL] Sent CL #${clId} to employee ${employee.email}`);
    } else {
      console.log(`[EMAIL] Failed CL #${clId} to employee (continuing)`);
    }

    // For CREATED, also send to all HR users
    if (actionType === 'CREATED' && hrUsers.length > 0) {
      const hrSubject = `Notification: New Competency Leveling Form Created - CL #${clId}`;

      // Send a formal, personalized email to each HR user
      hrUsers.forEach((hr) => {
        const recipientName = hr.name || 'HR Team';

        const hrHtml = `
          <h3 style="color: #0b61ff;">Notification: New Competency Leveling Form Created</h3>
          <p style="color: #0b2b5f;">Dear ${recipientName},</p>
          <p style="color: #0b2b5f;">This is to inform you that a new Competency Leveling (CL) form has been submitted and is now in the approval workflow. Please find the details below.</p>
          <table style="width:100%; border-collapse: collapse; color: #0b2b5f;">
            <tr><td style="padding:4px 8px; font-weight:600;">CL Number:</td><td style="padding:4px 8px;">#${clId}</td></tr>
            <tr><td style="padding:4px 8px; font-weight:600;">Employee:</td><td style="padding:4px 8px;">${employeeInfo}</td></tr>
            <tr><td style="padding:4px 8px; font-weight:600;">Submitted By:</td><td style="padding:4px 8px;">${actorName} (${actorRole})</td></tr>
            <tr><td style="padding:4px 8px; font-weight:600;">Date & Time:</td><td style="padding:4px 8px;">${currentDateTime}</td></tr>
            <tr><td style="padding:4px 8px; font-weight:600;">Status:</td><td style="padding:4px 8px;">In approval workflow</td></tr>
          </table>
          <p style="color: #0b2b5f;">Please review the form at your earliest convenience and take any necessary action according to HR procedures.</p>
          <p style="color: #0b2b5f;">If you require further information, please contact the supervisor listed above.</p>
          <hr/>
          <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
        `;

        const hrText =
          `Dear ${recipientName},\n\n` +
          `This is to inform you that a new Competency Leveling (CL) form (#${clId}) has been submitted for ${employeeInfo} by ${actorName} (${actorRole}) on ${currentDateTime}.\n\n` +
          `Status: In approval workflow.\n\n` +
          `Please review the form at your earliest convenience and take any necessary action according to HR procedures.\n\n` +
          `If you require further information, please contact the supervisor listed above.\n\n` +
          `Regards,\nFutura System`;

        sendEmail({
          to: hr.email,
          subject: hrSubject,
          text: hrText,
          html: hrHtml,
        })
          .then((r) => {
            if (r) console.log(`[EMAIL] Sent HR notify CL #${clId} to ${hr.email}`);
            else console.log(`[EMAIL] Failed HR notify CL #${clId} to ${hr.email}`);
          })
          .catch((e) => console.log(`[EMAIL] HR notify error ${hr.email}:`, e.message));
      });
    }

    // For RETURNED, also send to supervisor
    if (actionType === 'RETURNED' && supervisor) {
      const supervisorSubject = `CL #${clId} for ${employeeInfo} Has Been Returned`;
      const supervisorHtmlContent = `
        <h3>CL Form Returned for Revision</h3>
        <p>Hello <strong>${supervisor.name}</strong>,</p>
        <p>The CL form <strong>#${clId}</strong> for <strong>${employeeInfo}</strong> has been returned for revision.</p>
        <p><strong>Returned by:</strong> ${actorName} (${actorRole})</p>
        <p><strong>Date & Time:</strong> ${currentDateTime}</p>
        ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
        <p><strong>⚠️ Action Required:</strong> Please review the remarks and make necessary revisions to the form.</p>
        <hr/>
        <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
      `;
      const supervisorTextContent =
        `CL Form Returned for Revision\n\n` +
        `Hello ${supervisor.name},\n\n` +
        `The CL form #${clId} for ${employeeInfo} has been returned for revision.\n\n` +
        `Returned by: ${actorName} (${actorRole})\n` +
        `Date & Time: ${currentDateTime}\n` +
        (remarks ? `Remarks: ${remarks}\n\n` : '\n') +
        `Action Required: Please review the remarks and make necessary revisions to the form.`;

      await sendEmail({
        to: supervisor.email,
        subject: supervisorSubject,
        text: supervisorTextContent,
        html: supervisorHtmlContent,
      });
    }

    // For FINAL_APPROVED, also send to supervisor
    if (actionType === 'FINAL_APPROVED' && supervisor) {
      const supervisorSubject = `CL #${clId} for ${employeeInfo} Has Been Approved and Locked`;
      const supervisorHtmlContent = `
        <h3>CL Form Final Approval - Supervisor Notice</h3>
        <p>Hello <strong>${supervisor.name}</strong>,</p>
        <p>The CL form <strong>#${clId}</strong> for <strong>${employeeInfo}</strong> that you submitted has been fully approved by HR and is now <strong>locked</strong>.</p>
        <p><strong>Approved by:</strong> ${actorName} (${actorRole})</p>
        <p><strong>Date & Time:</strong> ${currentDateTime}</p>
        ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
        <p><strong>✅ Status:</strong> The competency assessment is now finalized and locked. No further changes can be made.</p>
        <p><strong>📋 Next Steps:</strong> The employee can now proceed to create their Individual Development Plan (IDP).</p>
        <hr/>
        <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
      `;
      const supervisorTextContent =
        `CL Form Final Approval - Supervisor Notice\n\n` +
        `Hello ${supervisor.name},\n\n` +
        `The CL form #${clId} for ${employeeInfo} that you submitted has been fully approved by HR and is now locked.\n\n` +
        `Approved by: ${actorName} (${actorRole})\n` +
        `Date & Time: ${currentDateTime}\n` +
        (remarks ? `Remarks: ${remarks}\n\n` : '\n') +
        `Status: Finalized and locked. No further changes can be made.\n` +
        `Next Steps: The employee can now proceed to create their Individual Development Plan (IDP).`;

      await sendEmail({
        to: supervisor.email,
        subject: supervisorSubject,
        text: supervisorTextContent,
        html: supervisorHtmlContent,
      });
    }
  } catch (error) {
    console.error('[EMAIL] Failed to send CL notification email:', error);
  }
}

// =====================================================
// SEND WELCOME EMAIL TO NEW EMPLOYEE WITH LOGIN CREDENTIALS
// =====================================================
async function sendWelcomeEmail({
  employeeId,
  name,
  email,
  password,
  departmentName,
  positionTitle,
  supervisorName,
  managerName,
  amName,
  role,
}) {
  try {
    console.log(`[EMAIL] Sending welcome email: ${name} (${email})`);

    const currentDateTime = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const subject = `Welcome to Futura - Your Account Has Been Created`;

    const htmlContent = `
      <h2 style="color: #0b61ff; text-align: center;">Welcome to Futura!</h2>
      <p style="color: #0b2b5f;">Hello <strong>${name}</strong>,</p>
      <p style="color: #0b2b5f;">Your employee account has been successfully created by HR. Below are your account details and login credentials:</p>

      <div style="background-color: #ffffff; border: 1px solid #0b61ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0b2b5f;">Account Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Employee ID:</td><td style="padding: 8px 0;">${employeeId}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Full Name:</td><td style="padding: 8px 0;">${name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Email Address:</td><td style="padding: 8px 0;">${email}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Department:</td><td style="padding: 8px 0;">${departmentName || 'Not assigned'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Position:</td><td style="padding: 8px 0;">${positionTitle || 'Not assigned'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Role:</td><td style="padding: 8px 0;">${role}</td></tr>
          ${supervisorName ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Supervisor:</td><td style="padding: 8px 0;">${supervisorName}</td></tr>` : ''}
          ${managerName ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Manager:</td><td style="padding: 8px 0;">${managerName}</td></tr>` : ''}
          ${amName ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Assistant Manager:</td><td style="padding: 8px 0;">${amName}</td></tr>` : ''}
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Account Created:</td><td style="padding: 8px 0;">${currentDateTime}</td></tr>
        </table>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #0b61ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0b61ff;">🔐 Login Credentials</h3>
        <p style="margin: 10px 0; color: #0b2b5f;"><strong>Username:</strong> ${email}</p>
        <p style="margin: 10px 0; color: #0b2b5f;"><strong>Password:</strong> <code style="background-color: #ffffff; padding: 4px 8px; border-radius: 4px; font-family: monospace; border:1px solid #e6eefb;">${password}</code></p>
        <p style="margin: 10px 0; color: #0b2b5f;"><em>Please change your password after your first login for security.</em></p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #0b61ff; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #0b61ff;">📋 Next Steps:</h4>
        <ol style="margin: 10px 0; padding-left: 20px; color: #0b2b5f;">
          <li>Log in to the system using your credentials above</li>
          <li>Complete your profile information if needed</li>
          <li>Familiarize yourself with the Competency Leveling (CL) and Individual Development Plan (IDP) systems</li>
          <li>Contact your supervisor or HR if you need assistance</li>
        </ol>
      </div>

      <p style="color: #0b2b5f;">If you have any questions or need assistance, please contact the HR department or your supervisor.</p>
      <p style="color: #0b2b5f;">Welcome to the team!</p>

      <hr/>
      <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura HR System. Please do not reply to this email.</p>
    `;

    const textContent =
      `Welcome to Futura!\n\n` +
      `Hello ${name},\n\n` +
      `Your employee account has been successfully created by HR. Below are your account details and login credentials:\n\n` +
      `Account Information:\n` +
      `- Employee ID: ${employeeId}\n` +
      `- Full Name: ${name}\n` +
      `- Email Address: ${email}\n` +
      `- Department: ${departmentName || 'Not assigned'}\n` +
      `- Position: ${positionTitle || 'Not assigned'}\n` +
      `- Role: ${role}\n` +
      (supervisorName ? `- Supervisor: ${supervisorName}\n` : '') +
      (managerName ? `- Manager: ${managerName}\n` : '') +
      (amName ? `- Assistant Manager: ${amName}\n` : '') +
      `- Account Created: ${currentDateTime}\n\n` +
      `Login Credentials:\n` +
      `- Username: ${email}\n` +
      `- Password: ${password}\n\n` +
      `Please change your password after your first login for security.\n\n` +
      `Next Steps:\n` +
      `1. Log in to the system using your credentials above\n` +
      `2. Complete your profile information if needed\n` +
      `3. Familiarize yourself with the Competency Leveling (CL) and Individual Development Plan (IDP) systems\n` +
      `4. Contact your supervisor or HR if you need assistance\n\n` +
      `Welcome to the team!`;

    const result = await sendEmail({
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    if (result) console.log(`[EMAIL] Welcome email sent to ${email}`);
    else console.log(`[EMAIL] Welcome email failed to ${email} (continuing)`);
  } catch (error) {
    console.error('[EMAIL] Failed to send welcome email:', error);
  }
}

// =====================================================
// SEND PASSWORD CHANGE NOTIFICATION EMAIL
// =====================================================
async function sendPasswordChangeEmail({ name, email, employeeId }) {
  try {
    console.log(`[EMAIL] Password change notification: ${name} (${email})`);

    const currentDateTime = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const subject = `Password Changed Successfully - Futura Account Security Alert`;

    const htmlContent = `
      <h2 style="color: #0b61ff;">Password Changed Successfully</h2>
      <p style="color: #0b2b5f;">Hello <strong>${name}</strong>,</p>
      <p style="color: #0b2b5f;">Your password has been successfully changed for your Futura account.</p>

      <div style="background-color: #ffffff; border: 1px solid #0b61ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0b61ff;">📋 Change Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Employee ID:</td><td style="padding: 8px 0;">${employeeId}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Email Address:</td><td style="padding: 8px 0;">${email}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Change Time:</td><td style="padding: 8px 0;">${currentDateTime}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #0b2b5f;">Source:</td><td style="padding: 8px 0;">System change via employee portal</td></tr>
        </table>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #0b61ff; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #0b61ff;">🔒 Security Reminder:</h4>
        <ul style="margin: 10px 0; padding-left: 20px; color: #0b2b5f;">
          <li>If you did NOT make this change, contact HR or IT immediately</li>
          <li>Never share your password with anyone</li>
          <li>Use a strong, unique password</li>
          <li>Change your password regularly</li>
        </ul>
      </div>

      <hr/>
      <p style="font-size: 12px; color: #0b2b5f;">This is an automated security notification from Futura System. Please do not reply to this email.</p>
    `;

    const textContent =
      `Password Changed Successfully - Security Alert\n\n` +
      `Hello ${name},\n\n` +
      `Your password has been successfully changed for your Futura account.\n\n` +
      `Change Details:\n` +
      `- Employee ID: ${employeeId}\n` +
      `- Email Address: ${email}\n` +
      `- Change Time: ${currentDateTime}\n` +
      `- Source: System change via employee portal\n\n` +
      `Security Reminder:\n` +
      `- If you did NOT make this change, contact HR or IT immediately\n` +
      `- Never share your password with anyone\n` +
      `- Use a strong, unique password\n` +
      `- Change your password regularly\n`;

    const result = await sendEmail({
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    if (result) console.log(`[EMAIL] Password change email sent to ${email}`);
    else console.log(`[EMAIL] Password change email failed to ${email} (continuing)`);
  } catch (error) {
    console.error('[EMAIL] Failed to send password change notification:', error);
  }
}

module.exports = {
  sendEmail,
  sendCLNotificationEmail,
  sendWelcomeEmail,
  sendPasswordChangeEmail,
  getUserEmail,
  getSupervisorEmail,
  getHREmails,
};
