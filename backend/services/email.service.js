// backend/services/email.service.js
const nodemailer = require('nodemailer');
const { db } = require('../config/db');

const notifier = "notification.alert@equicomservices.com";

// Configure transporter with connection pooling and rate limiting
let transporter = nodemailer.createTransport({
  host: 'smtp-relay.gmail.com',
  port: 587,
  secure: false,
  auth: false,
  pool: true, // Use pooled connections
  maxConnections: 1, // Limit concurrent connections
  maxMessages: 10, // Max messages per connection
  rateDelta: 1000, // Time window for rate limiting (1 second)
  rateLimit: 5 // Max messages per rateDelta
});

// Utility function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =====================================================
// SEND EMAIL HELPER WITH RETRY LOGIC
// =====================================================
async function sendEmail({ to, subject, text, html }, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s

  try {
    // Add small delay before sending to avoid rate limits
    if (retryCount === 0) {
      await delay(1000);
    }

    const info = await transporter.sendMail({
      from: notifier,
      to,
      subject,
      text,
      html
    });

    console.log('Email sent: ' + info.messageId);
    return info;
  } catch (error) {
    console.error(`Failed to send email (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message);

    // Check if error is retryable (connection errors, rate limits)
    const isRetryable = 
      error.code === 'ECONNECTION' || 
      error.responseCode === 421 || 
      error.responseCode === 450 ||
      error.responseCode === 451;

    if (isRetryable && retryCount < MAX_RETRIES) {
      const delayTime = RETRY_DELAYS[retryCount];
      console.log(`Retrying email send in ${delayTime}ms...`);
      await delay(delayTime);
      return sendEmail({ to, subject, text, html }, retryCount + 1);
    }

    // If not retryable or max retries reached, log and don't throw
    console.error('Email send failed after retries:', error);
    return null; // Return null instead of throwing to prevent breaking main flow
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
  requiresEmployeeAction = false
}) {
  try {
    console.log(`[EMAIL] CL #${clId} | ActionType: ${actionType} | EmployeeId: ${employeeId}`);
    
    // Get employee email
    const employee = await getUserEmail(employeeId);
    if (!employee) {
      console.error(`Employee user ${employeeId} not found`);
      return;
    }
    console.log(`[EMAIL] Sending to: ${employee.name} (${employee.email})`);
    
    // Get supervisor email for FINAL_APPROVED
    let supervisor = null;
    if (actionType === 'FINAL_APPROVED') {
      supervisor = await getSupervisorEmail(clId);
      if (supervisor) {
        console.log(`[EMAIL] Also sending to supervisor: ${supervisor.name} (${supervisor.email})`);
      }
    }

    // Build email content based on action type
    let subject = '';
    let htmlContent = '';
    let textContent = '';

    const employeeInfo = `${employeeName} (${employeeCode})`;
    const currentDateTime = new Date().toLocaleString('en-US', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });

    switch (actionType) {
      case 'CREATED':
        // Email to EMPLOYEE confirming their CL was created
        subject = `Your Competency Leveling Form Has Been Created - CL #${clId}`;
        htmlContent = `
          <h3>Competency Leveling Form Created</h3>
          <p>Hello <strong>${employee.name}</strong>,</p>
          <p>Your Competency Leveling form <strong>#${clId}</strong> has been successfully created by your supervisor.</p>
          <p><strong>Created by:</strong> ${actorName} (${actorRole})</p>
          <p><strong>Date & Time:</strong> ${currentDateTime}</p>
          <p><strong>Status:</strong> The form is now under review process.</p>
          <p>You will receive notifications as your form progresses through the approval workflow.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `Your Competency Leveling Form Has Been Created\n\nHello ${employee.name},\n\nYour Competency Leveling form #${clId} has been successfully created by your supervisor.\n\nCreated by: ${actorName} (${actorRole})\nDate & Time: ${currentDateTime}\nStatus: The form is now under review process.\n\nYou will receive notifications as your form progresses through the approval workflow.`;
        break;

      case 'RESUBMITTED':
        subject = `Your CL Form #${clId} Has Been Resubmitted for Review`;
        htmlContent = `
          <h3>CL Form Resubmitted</h3>
          <p>Hello <strong>${employee.name}</strong>,</p>
          <p>Your CL form <strong>#${clId}</strong> has been revised and resubmitted by your supervisor.</p>
          <p><strong>Resubmitted by:</strong> ${actorName} (${actorRole})</p>
          <p><strong>Date & Time:</strong> ${currentDateTime}</p>
          ${remarks ? `<p><strong>Supervisor Notes:</strong><br/>${remarks.replace(/\n/g, '<br/>') }</p>` : ''}
          <p><strong>Status:</strong> The form is now back in the approval workflow.</p>
          <p>You will receive notifications as your form progresses through the approval process.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `Your CL Form Has Been Resubmitted for Review\n\nHello ${employee.name},\n\nYour CL form #${clId} has been revised and resubmitted by your supervisor.\n\nResubmitted by: ${actorName} (${actorRole})\nDate & Time: ${currentDateTime}\n${remarks ? `\nSupervisor Notes: ${remarks}` : ''}\n\nStatus: The form is now back in the approval workflow.\n\nYou will receive notifications as your form progresses through the approval process.`;
        break;

      case 'RETURNED':
        subject = `Your CL Form #${clId} Has Been Returned for Revision`;
        htmlContent = `
          <h3>CL Form Returned for Revision</h3>
          <p>Hello <strong>${employee.name}</strong>,</p>
          <p>Your CL form <strong>#${clId}</strong> has been returned for revision.</p>
          <p><strong>Returned by:</strong> ${actorName} (${actorRole})</p>
          <p><strong>Date & Time:</strong> ${currentDateTime}</p>
          ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p>Your supervisor will revise the form and resubmit it.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `Your CL Form Has Been Returned for Revision\n\nHello ${employee.name},\n\nYour CL form #${clId} has been returned for revision.\n\nReturned by: ${actorName} (${actorRole})\nDate & Time: ${currentDateTime}\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\nYour supervisor will revise the form and resubmit it.`;
        break;

      case 'APPROVED':
        subject = `Your CL Form #${clId} Has Been Approved by ${actorRole}`;
        htmlContent = `
          <h3>CL Form Approved</h3>
          <p>Hello <strong>${employee.name}</strong>,</p>
          <p>Good news! Your CL form <strong>#${clId}</strong> has been approved by ${actorRole}.</p>
          <p><strong>Approved by:</strong> ${actorName} (${actorRole})</p>
          <p><strong>Date & Time:</strong> ${currentDateTime}</p>
          ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          ${requiresEmployeeAction 
            ? `<p><strong>⚠️ Action Required:</strong> Your form now requires <strong>your review and approval</strong>. Please log in to the system to review and approve your CL form.</p>`
            : `<p><strong>Status:</strong> Your form is now proceeding to the next approval stage.</p>`
          }
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `Your CL Form Has Been Approved by ${actorRole}\n\nHello ${employee.name},\n\nGood news! Your CL form #${clId} has been approved by ${actorRole}.\n\nApproved by: ${actorName} (${actorRole})\nDate & Time: ${currentDateTime}\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\n${requiresEmployeeAction 
          ? `⚠️ Action Required: Your form now requires your review and approval. Please log in to the system to review and approve your CL form.`
          : `Status: Your form is now proceeding to the next approval stage.`
        }`;
        break;

      case 'FINAL_APPROVED':
        subject = `Congratulations! CL #${clId} Has Been Fully Approved and Locked`;
        htmlContent = `
          <h3>CL Form Final Approval</h3>
          <p>Hello <strong>${employee.name}</strong>,</p>
          <p>Congratulations! Your CL form <strong>#${clId}</strong> has been fully approved by HR and is now <strong>locked</strong>.</p>
          <p><strong>Employee:</strong> ${employeeInfo}</p>
          <p><strong>Approved by:</strong> ${actorName} (${actorRole})</p>
          <p><strong>Date & Time:</strong> ${currentDateTime}</p>
          ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p><strong>✅ Status:</strong> The competency assessment is now finalized and locked. No further changes can be made.</p>
          <p><strong>📋 Next Steps:</strong> You can now proceed to create the Individual Development Plan (IDP).</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `Congratulations! CL Form Has Been Fully Approved and Locked\n\nHello ${employee.name},\n\nYour CL form #${clId} has been fully approved by HR and is now locked.\n\nEmployee: ${employeeInfo}\nApproved by: ${actorName} (${actorRole})\nDate & Time: ${currentDateTime}\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\n✅ Status: The competency assessment is now finalized and locked. No further changes can be made.\n📋 Next Steps: You can now proceed to create the Individual Development Plan (IDP).`;
        break;

      default:
        console.error(`Unknown action type: ${actionType}`);
        return;
    }

    // Send the email to employee
    const employeeResult = await sendEmail({
      to: employee.email,
      subject,
      text: textContent,
      html: htmlContent
    });

    if (employeeResult) {
      console.log(`[EMAIL] Successfully sent notification for CL #${clId} to ${employee.email}`);
    } else {
      console.log(`[EMAIL] Failed to send notification for CL #${clId} to employee, but continuing...`);
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
        <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
      `;
      const supervisorTextContent = `CL Form Final Approval - Supervisor Notice\n\nHello ${supervisor.name},\n\nThe CL form #${clId} for ${employeeInfo} that you submitted has been fully approved by HR and is now locked.\n\nApproved by: ${actorName} (${actorRole})\nDate & Time: ${currentDateTime}\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\n✅ Status: The competency assessment is now finalized and locked. No further changes can be made.\n📋 Next Steps: The employee can now proceed to create their Individual Development Plan (IDP).`;
      
      const supervisorResult = await sendEmail({
        to: supervisor.email,
        subject: supervisorSubject,
        text: supervisorTextContent,
        html: supervisorHtmlContent
      });

      if (supervisorResult) {
        console.log(`[EMAIL] Successfully sent supervisor notification for CL #${clId} to ${supervisor.email}`);
      } else {
        console.log(`[EMAIL] Failed to send notification for CL #${clId} to supervisor, but continuing...`);
      }
    }

  } catch (error) {
    console.error('Failed to send CL notification email:', error);
    // Don't throw - email failure shouldn't break the main flow
  }
}

module.exports = {
  sendEmail,
  sendCLNotificationEmail,
  getUserEmail,
  getSupervisorEmail
};
