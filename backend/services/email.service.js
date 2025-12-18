// backend/services/email.service.js
const nodemailer = require('nodemailer');
const { db } = require('../config/db');

const notifier = "notification.alert@equicomservices.com";
const hrEmail = "appdev@equicomservices.com"; // HR always gets BCC

let transporter = nodemailer.createTransport({
  host: 'smtp-relay.gmail.com',
  port: 587,
  secure: false,
  auth: false
});

// =====================================================
// SEND EMAIL HELPER
// =====================================================
async function sendEmail({ to, cc = [], bcc = [], subject, text, html }) {
  try {
    // Always BCC HR
    const finalBcc = [...new Set([...bcc, hrEmail])]; // Remove duplicates

    const info = await transporter.sendMail({
      from: notifier,
      to,
      cc,
      bcc: finalBcc,
      subject,
      text,
      html
    });

    console.log('Email sent: ' + info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
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
// SEND CL NOTIFICATION EMAIL
// =====================================================
async function sendCLNotificationEmail({ 
  clId, 
  recipientId, 
  ccIds = [], 
  actionType, 
  actorName, 
  actorRole, 
  employeeName, 
  employeeCode,
  remarks = null 
}) {
  try {
    // Get recipient email
    const recipient = await getUserEmail(recipientId);
    if (!recipient) {
      console.error(`Recipient user ${recipientId} not found`);
      return;
    }

    // Get CC emails
    const ccEmails = [];
    for (const ccId of ccIds) {
      const ccUser = await getUserEmail(ccId);
      if (ccUser) ccEmails.push(ccUser.email);
    }

    // Build email content based on action type
    let subject = '';
    let htmlContent = '';
    let textContent = '';

    const employeeInfo = `${employeeName} (${employeeCode})`;

    switch (actionType) {
      case 'CREATED':
        subject = `CL #${clId} Created for ${employeeName}`;
        htmlContent = `
          <h3>Competency Leveling Form Created</h3>
          <p>Hello <strong>${recipient.name}</strong>,</p>
          <p>A new CL form <strong>#${clId}</strong> has been created for employee <strong>${employeeInfo}</strong>.</p>
          <p><strong>Created by:</strong> ${actorName} (${actorRole})</p>
          ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p>Please log in to the system to review.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `Competency Leveling Form Created\n\nHello ${recipient.name},\n\nA new CL form #${clId} has been created for employee ${employeeInfo}.\n\nCreated by: ${actorName} (${actorRole})\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\nPlease log in to the system to review.`;
        break;

      case 'PENDING_REVIEW':
        subject = `Action Required: CL #${clId} Pending Your Review`;
        htmlContent = `
          <h3>CL Pending Your Review</h3>
          <p>Hello <strong>${recipient.name}</strong>,</p>
          <p>CL form <strong>#${clId}</strong> for employee <strong>${employeeInfo}</strong> is now pending your review.</p>
          <p><strong>Action by:</strong> ${actorName} (${actorRole})</p>
          ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p>Please log in to approve or return the form.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `CL Pending Your Review\n\nHello ${recipient.name},\n\nCL form #${clId} for employee ${employeeInfo} is now pending your review.\n\nAction by: ${actorName} (${actorRole})\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\nPlease log in to approve or return the form.`;
        break;

      case 'APPROVED':
        subject = `CL #${clId} Approved by ${actorRole}`;
        htmlContent = `
          <h3>CL Form Approved</h3>
          <p>Hello <strong>${recipient.name}</strong>,</p>
          <p>CL form <strong>#${clId}</strong> for employee <strong>${employeeInfo}</strong> has been approved.</p>
          <p><strong>Approved by:</strong> ${actorName} (${actorRole})</p>
          ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p>The form will proceed to the next approval stage.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `CL Form Approved\n\nHello ${recipient.name},\n\nCL form #${clId} for employee ${employeeInfo} has been approved.\n\nApproved by: ${actorName} (${actorRole})\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\nThe form will proceed to the next approval stage.`;
        break;

      case 'RETURNED':
        subject = `CL #${clId} Returned by ${actorRole}`;
        htmlContent = `
          <h3>CL Form Returned for Revision</h3>
          <p>Hello <strong>${recipient.name}</strong>,</p>
          <p>CL form <strong>#${clId}</strong> for employee <strong>${employeeInfo}</strong> has been returned for revision.</p>
          <p><strong>Returned by:</strong> ${actorName} (${actorRole})</p>
          ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p>Please review the remarks and resubmit the form.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `CL Form Returned for Revision\n\nHello ${recipient.name},\n\nCL form #${clId} for employee ${employeeInfo} has been returned for revision.\n\nReturned by: ${actorName} (${actorRole})\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\nPlease review the remarks and resubmit the form.`;
        break;

      case 'FINAL_APPROVED':
        subject = `CL #${clId} Final Approval - IDP Creation Enabled`;
        htmlContent = `
          <h3>CL Form Final Approval</h3>
          <p>Hello <strong>${recipient.name}</strong>,</p>
          <p>Congratulations! Your CL form <strong>#${clId}</strong> has been fully approved by HR.</p>
          <p><strong>Approved by:</strong> ${actorName} (${actorRole})</p>
          ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p>You can now proceed to create your Individual Development Plan (IDP).</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `CL Form Final Approval\n\nHello ${recipient.name},\n\nCongratulations! Your CL form #${clId} has been fully approved by HR.\n\nApproved by: ${actorName} (${actorRole})\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\nYou can now proceed to create your Individual Development Plan (IDP).`;
        break;

      default:
        console.error(`Unknown action type: ${actionType}`);
        return;
    }

    // Send the email
    await sendEmail({
      to: recipient.email,
      cc: ccEmails,
      subject,
      text: textContent,
      html: htmlContent
    });

  } catch (error) {
    console.error('Failed to send CL notification email:', error);
    // Don't throw - email failure shouldn't break the main flow
  }
}

module.exports = {
  sendEmail,
  sendCLNotificationEmail,
  getUserEmail
};
