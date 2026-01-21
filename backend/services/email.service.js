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
  pool: true,
  maxConnections: 1,
  maxMessages: 10,
  rateDelta: 1000,
  rateLimit: 5
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
    
    // Get supervisor email
    const supervisor = await getSupervisorEmail(clId);
    
    // Get HR emails for CREATED action
    let hrUsers = [];
    if (actionType === 'CREATED') {
      hrUsers = await getHREmails();
      if (hrUsers.length > 0) {
        console.log(`[EMAIL] Also notifying ${hrUsers.length} HR user(s)`);
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
          <p><strong>Employee:</strong> ${employeeInfo}</p>
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
        // Email to EMPLOYEE
        subject = `Your CL Form #${clId} Has Been Returned for Revision`;
        htmlContent = `
          <h3>CL Form Returned for Revision</h3>
          <p>Hello <strong>${employee.name}</strong>,</p>
          <p>Your CL form <strong>#${clId}</strong> has been returned for revision.</p>
          <p><strong>Employee:</strong> ${employeeInfo}</p>
          <p><strong>Returned by:</strong> ${actorName} (${actorRole})</p>
          <p><strong>Date & Time:</strong> ${currentDateTime}</p>
          ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p>Your supervisor will revise the form and resubmit it.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
        `;
        textContent = `Your CL Form Has Been Returned for Revision\n\nHello ${employee.name},\n\nYour CL form #${clId} has been returned for revision.\n\nEmployee: ${employeeInfo}\nReturned by: ${actorName} (${actorRole})\nDate & Time: ${currentDateTime}\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\nYour supervisor will revise the form and resubmit it.`;
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

    // For CREATED, also send to HR
    if (actionType === 'CREATED' && hrUsers.length > 0) {
      const hrSubject = `New CL #${clId} Created for ${employeeInfo}`;
      const hrHtmlContent = `
        <h3>New Competency Leveling Form Created</h3>
        <p>Hello,</p>
        <p>A new Competency Leveling form has been created:</p>
        <p><strong>CL Number:</strong> #${clId}</p>
        <p><strong>Employee:</strong> ${employeeInfo}</p>
        <p><strong>Created by:</strong> ${actorName} (${actorRole})</p>
        <p><strong>Date & Time:</strong> ${currentDateTime}</p>
        <p><strong>Status:</strong> The form is now in the approval workflow.</p>
        <p>You will be notified when the form reaches your approval stage.</p>
        <hr/>
        <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
      `;
      const hrTextContent = `New Competency Leveling Form Created\n\nA new Competency Leveling form has been created:\n\nCL Number: #${clId}\nEmployee: ${employeeInfo}\nCreated by: ${actorName} (${actorRole})\nDate & Time: ${currentDateTime}\nStatus: The form is now in the approval workflow.\n\nYou will be notified when the form reaches your approval stage.`;
      
      // Send to all HR users in parallel (don't wait)
      hrUsers.forEach(hr => {
        sendEmail({
          to: hr.email,
          subject: hrSubject,
          text: hrTextContent,
          html: hrHtmlContent
        }).then(result => {
          if (result) {
            console.log(`[EMAIL] Successfully sent HR notification for CL #${clId} to ${hr.email}`);
          } else {
            console.log(`[EMAIL] Failed to send HR notification for CL #${clId} to ${hr.email}, but continuing...`);
          }
        }).catch(err => {
          console.log(`[EMAIL] Error sending HR notification to ${hr.email}:`, err.message);
        });
      });
    }

    // For RETURNED, also send to supervisor
    if (actionType === 'RETURNED' && supervisor) {
      const supervisorSubject = `CL #${clId} for ${employeeInfo} Has Been Returned`;
      const supervisorHtmlContent = `
        <h3>CL Form Returned for Revision</h3>
        <p>Hello <strong>${supervisor.name}</strong>,</p>
        <p>The CL form <strong>#${clId}</strong> for <strong>${employeeInfo}</strong> has been returned for revision.</p>
        <p><strong>Employee:</strong> ${employeeInfo}</p>
        <p><strong>Returned by:</strong> ${actorName} (${actorRole})</p>
        <p><strong>Date & Time:</strong> ${currentDateTime}</p>
        ${remarks ? `<p><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
        <p><strong>⚠️ Action Required:</strong> Please review the remarks and make necessary revisions to the form.</p>
        <hr/>
        <p style="font-size: 12px; color: #666;">This is an automated notification from Futura CL System.</p>
      `;
      const supervisorTextContent = `CL Form Returned for Revision\n\nHello ${supervisor.name},\n\nThe CL form #${clId} for ${employeeInfo} has been returned for revision.\n\nEmployee: ${employeeInfo}\nReturned by: ${actorName} (${actorRole})\nDate & Time: ${currentDateTime}\n${remarks ? `\nRemarks: ${remarks}` : ''}\n\n⚠️ Action Required: Please review the remarks and make necessary revisions to the form.`;
      
      const supervisorResult = await sendEmail({
        to: supervisor.email,
        subject: supervisorSubject,
        text: supervisorTextContent,
        html: supervisorHtmlContent
      });

      if (supervisorResult) {
        console.log(`[EMAIL] Successfully sent supervisor notification for CL #${clId} to ${supervisor.email}`);
      } else {
        console.log(`[EMAIL] Failed to send supervisor notification for CL #${clId}, but continuing...`);
      }
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
  role
}) {
  try {
    console.log(`[EMAIL] Sending welcome email to new employee: ${name} (${email})`);
    
    const currentDateTime = new Date().toLocaleString('en-US', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });

    const subject = `Welcome to Futura - Your Account Has Been Created`;
    
    const htmlContent = `
      <h2 style="color: #1e40af; text-align: center;">Welcome to Futura!</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your employee account has been successfully created by HR. Below are your account details and login credentials:</p>
      
      <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #495057;">Account Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Employee ID:</td><td style="padding: 8px 0;">${employeeId}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Full Name:</td><td style="padding: 8px 0;">${name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Email Address:</td><td style="padding: 8px 0;">${email}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Department:</td><td style="padding: 8px 0;">${departmentName || 'Not assigned'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Position:</td><td style="padding: 8px 0;">${positionTitle || 'Not assigned'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Role:</td><td style="padding: 8px 0;">${role}</td></tr>
          ${supervisorName ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Supervisor:</td><td style="padding: 8px 0;">${supervisorName}</td></tr>` : ''}
          ${managerName ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Manager:</td><td style="padding: 8px 0;">${managerName}</td></tr>` : ''}
          ${amName ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Assistant Manager:</td><td style="padding: 8px 0;">${amName}</td></tr>` : ''}
          <tr><td style="padding: 8px 0; font-weight: bold; color: #495057;">Account Created:</td><td style="padding: 8px 0;">${currentDateTime}</td></tr>
        </table>
      </div>

      <div style="background-color: #e7f3ff; border: 1px solid #b6d7ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0066cc;">🔐 Login Credentials</h3>
        <p style="margin: 10px 0;"><strong>Username:</strong> ${email}</p>
        <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background-color: #f8f9fa; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
        <p style="margin: 10px 0; color: #666;"><em>Please change your password after your first login for security.</em></p>
      </div>

      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #856404;">📋 Next Steps:</h4>
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Log in to the system using your credentials above</li>
          <li>Complete your profile information if needed</li>
          <li>Familiarize yourself with the Competency Leveling (CL) and Individual Development Plan (IDP) systems</li>
          <li>Contact your supervisor or HR if you need assistance</li>
        </ol>
      </div>

      <p>If you have any questions or need assistance, please don't hesitate to contact the HR department or your supervisor.</p>
      
      <p>Welcome to the team!</p>
      
      <hr/>
      <p style="font-size: 12px; color: #666;">This is an automated notification from Futura HR System. Please do not reply to this email.</p>
    `;
    
    const textContent = `Welcome to Futura!\n\nHello ${name},\n\nYour employee account has been successfully created by HR. Below are your account details and login credentials:\n\nAccount Information:\n- Employee ID: ${employeeId}\n- Full Name: ${name}\n- Email Address: ${email}\n- Department: ${departmentName || 'Not assigned'}\n- Position: ${positionTitle || 'Not assigned'}\n- Role: ${role}\n${supervisorName ? `- Supervisor: ${supervisorName}\n` : ''}${managerName ? `- Manager: ${managerName}\n` : ''}${amName ? `- Assistant Manager: ${amName}\n` : ''}- Account Created: ${currentDateTime}\n\nLogin Credentials:\n- Username: ${email}\n- Password: ${password}\n\nPlease change your password after your first login for security.\n\nNext Steps:\n1. Log in to the system using your credentials above\n2. Complete your profile information if needed\n3. Familiarize yourself with the Competency Leveling (CL) and Individual Development Plan (IDP) systems\n4. Contact your supervisor or HR if you need assistance\n\nIf you have any questions or need assistance, please don't hesitate to contact the HR department or your supervisor.\n\nWelcome to the team!`;

    const result = await sendEmail({
      to: email,
      subject,
      text: textContent,
      html: htmlContent
    });

    if (result) {
      console.log(`[EMAIL] Successfully sent welcome email to ${email}`);
    } else {
      console.log(`[EMAIL] Failed to send welcome email to ${email}, but continuing...`);
    }

  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw - email failure shouldn't break the main flow
  }
}

// =====================================================
// SEND PASSWORD CHANGE NOTIFICATION EMAIL
// =====================================================
async function sendPasswordChangeEmail({ 
  name,
  email,
  employeeId
}) {
  try {
    console.log(`[EMAIL] Sending password change notification to: ${name} (${email})`);
    
    const currentDateTime = new Date().toLocaleString('en-US', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });

    const subject = `Password Changed Successfully - Futura Account Security Alert`;
    
    const htmlContent = `
      <h2 style="color: #1e40af;">Password Changed Successfully</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your password has been successfully changed for your Futura account.</p>
      
      <div style="background-color: #dbeafe; border: 1px solid #93c5fd; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e40af;">📋 Change Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #374151;">Employee ID:</td><td style="padding: 8px 0;">${employeeId}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #374151;">Email Address:</td><td style="padding: 8px 0;">${email}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #374151;">Change Time:</td><td style="padding: 8px 0;">${currentDateTime}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #374151;">IP Address:</td><td style="padding: 8px 0;">System change via employee portal</td></tr>
        </table>
      </div>

      <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #166534;">✅ What this means:</h4>
        <ul style="margin: 10px 0; padding-left: 20px; color: #374151;">
          <li>Your password change was successful</li>
          <li>Your account is secure</li>
          <li>You can continue using the system with your new password</li>
        </ul>
      </div>

      <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #92400e;">🔒 Security Reminder:</h4>
        <ul style="margin: 10px 0; padding-left: 20px; color: #374151;">
          <li>If you did NOT make this change, contact HR or IT immediately</li>
          <li>Never share your password with anyone</li>
          <li>Use a strong, unique password</li>
          <li>Change your password regularly</li>
        </ul>
      </div>

      <p>If you have any security concerns or did not initiate this password change, please contact the HR department or IT support immediately.</p>
      
      <p>Thank you for keeping your account secure!</p>
      
      <hr/>
      <p style="font-size: 12px; color: #666;">This is an automated security notification from Futura System. Please do not reply to this email.</p>
    `;
    
    const textContent = `Password Changed Successfully - Security Alert\n\nHello ${name},\n\nYour password has been successfully changed for your Futura account.\n\nChange Details:\n- Employee ID: ${employeeId}\n- Email Address: ${email}\n- Change Time: ${currentDateTime}\n- Source: System change via employee portal\n\nWhat this means:\n- Your password change was successful\n- Your account is secure\n- You can continue using the system with your new password\n\nSecurity Reminder:\n- If you did NOT make this change, contact HR or IT immediately\n- Never share your password with anyone\n- Use a strong, unique password\n- Change your password regularly\n\nIf you have any security concerns or did not initiate this password change, please contact the HR department or IT support immediately.\n\nThank you for keeping your account secure!`;

    const result = await sendEmail({
      to: email,
      subject,
      text: textContent,
      html: htmlContent
    });

    if (result) {
      console.log(`[EMAIL] Successfully sent password change notification to ${email}`);
    } else {
      console.log(`[EMAIL] Failed to send password change notification to ${email}, but continuing...`);
    }

  } catch (error) {
    console.error('Failed to send password change notification email:', error);
    // Don't throw - email failure shouldn't break the main flow
  }
}

module.exports = {
  sendEmail,
  sendCLNotificationEmail,
  sendWelcomeEmail,
  sendPasswordChangeEmail,
  getUserEmail,
  getSupervisorEmail,
  getHREmails
};
