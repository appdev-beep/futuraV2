// src/services/cl.service.js
const { db } = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { logInfo } = require('../utils/logger');
const { logRecentAction } = require('./recentActions.service');
const { sendCLNotificationEmail, sendEmail, getSupervisorEmail } = require('./email.service');
const { createNotification } = require('./notification.service');


// =====================
// GET CL BY ID
// =====================
async function getById(id) {
  console.log('🔍 getById called with id:', id);
  const [headerRows] = await db.query(
    `SELECT 
       ch.*,
       e.name as employee_name,
       e.employee_id,
       e.email as employee_email,
       e.manager_id,
       e.am_id,
       s.name as supervisor_name,
       m.name as manager_name,
       am.name as am_name,
       d.name as department_name,
       p.title as position_title
     FROM cl_headers ch
     JOIN users e ON ch.employee_id = e.id
     LEFT JOIN users s ON ch.supervisor_id = s.id
     LEFT JOIN users m ON e.manager_id = m.id
     LEFT JOIN users am ON e.am_id = am.id
     JOIN departments d ON ch.department_id = d.id
     JOIN positions p ON e.position_id = p.id
     WHERE ch.id = ?`,
    [id]
  );

  console.log('📋 Header query result:', headerRows);

  if (!headerRows.length) return null;

  const header = headerRows[0];
  console.log('👤 Manager name from query:', header.manager_name);
  console.log('👤 AM name from query:', header.am_name);

  const [items] = await db.query(
    `SELECT 
        ci.*,
        c.name AS competency_name,
        c.description AS competency_description,
        c.competency_area,
        c.category
     FROM cl_items ci
     JOIN competencies c ON ci.competency_id = c.id
     WHERE ci.cl_header_id = ?`,
    [id]
  );

  // Recalculate score for each item and total
  const mappedItems = items.map(item => {
    const score = (Number(item.weight) / 100) * Number(item.assigned_level);
    return {
      id: item.id,
      competency_id: item.competency_id,
      competency_name: item.competency_name,
      competency_area: item.competency_area,
      category: item.category,
      mplr: item.mplr_level,
      required_level: item.mplr_level,
      assigned_level: item.assigned_level,
      self_rating: item.assigned_level,
      supervisor_rating: score,
      score,
      remarks: item.justification,
      pdf_path: item.pdf_path,
      weight: item.weight,
      justification: item.justification
    };
  });

  const total_score = mappedItems.reduce((sum, item) => sum + (Number(item.score) || 0), 0);

  // Recalculate score for each item before returning
  return {
    id: header.id,
    status: header.status,

    // Remarks with timestamps
    supervisor_remarks: header.supervisor_remarks,
    supervisor_id: header.supervisor_id,
    am_remarks: header.am_remarks,
    manager_remarks: header.manager_remarks,
    employee_remarks: header.employee_remarks,
    hr_remarks: header.hr_remarks,
    created_at: header.created_at,
    updated_at: header.updated_at,

    employee_name: header.employee_name,
    employee_id: header.employee_id,
    employee_email: header.employee_email,
    supervisor_name: header.supervisor_name,
    manager_name: header.manager_name,
    am_name: header.am_name,
    department_name: header.department_name,
    position_title: header.position_title,
    cycle_id: header.cycle_id,
    total_score: total_score.toFixed(2),
    pdf_path: items.length > 0 ? items[0].pdf_path : null,
    items: mappedItems
  };
}


// =====================
// CREATE CL
// =====================
async function create(payload) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Create header (initially DRAFT – controller will move it to PENDING_AM / PENDING_MANAGER)
    const [result] = await conn.query(
      `INSERT INTO cl_headers
        (employee_id, supervisor_id, department_id, cycle_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'DRAFT', NOW(), NOW())`,
      [
        payload.employee_id,
        payload.supervisor_id,
        payload.department_id,
        payload.cycle_id
      ]
    );

    const clId = result.insertId;

    // Load employee position
    const [positionRows] = await conn.query(
      `SELECT position_id FROM users WHERE id = ?`,
      [payload.employee_id]
    );

    if (!positionRows.length) throw new Error('Employee not found');

    const positionId = positionRows[0].position_id;

    // Load competencies mapped to the position
    const [compRows] = await conn.query(
      `SELECT competency_id, required_level AS mplr
       FROM position_competencies
       WHERE position_id = ?`,
      [positionId]
    );

    for (const c of compRows) {
      await conn.query(
        `INSERT INTO cl_items
          (cl_header_id, competency_id, mplr_level, assigned_level, weight, justification, score, created_at, updated_at, pdf_path)
         VALUES (?, ?, ?, ?, 0, '', 0, NOW(), NOW(), NULL)`,
        [clId, c.competency_id, c.mplr, c.mplr]
      );
    }

    await conn.commit();
    // Notify employee (and HR via email.service when actionType === 'CREATED')
    try {
      const [empRows] = await db.query(
        `SELECT name, employee_id FROM users WHERE id = ? LIMIT 1`,
        [payload.employee_id]
      );
      const [supRows] = await db.query(
        `SELECT name FROM users WHERE id = ? LIMIT 1`,
        [payload.supervisor_id]
      );

      const employeeName = empRows && empRows.length ? empRows[0].name : '';
      const employeeCode = empRows && empRows.length ? empRows[0].employee_id : '';
      const supervisorName = supRows && supRows.length ? supRows[0].name : '';

      // fire-and-forget but await to log errors if any
      await sendCLNotificationEmail({
        clId,
        employeeId: payload.employee_id,
        actionType: 'CREATED',
        actorName: supervisorName || 'Supervisor',
        actorRole: 'Supervisor',
        employeeName,
        employeeCode,
        remarks: null,
        requiresEmployeeAction: false,
      });
    } catch (e) {
      console.error('[CL SERVICE] Failed to send creation notification:', e);
    }

    // Also notify the next reviewer (AM -> Manager). HR is already notified by sendCLNotificationEmail when actionType === 'CREATED'.
    try {
      const [userRow] = await db.query(`SELECT am_id, manager_id FROM users WHERE id = ? LIMIT 1`, [payload.employee_id]);
      if (userRow && userRow.length) {
        const { am_id, manager_id } = userRow[0];

        if (am_id) {
          const [amRows] = await db.query(`SELECT id, name, email FROM users WHERE id = ? LIMIT 1`, [am_id]);
          if (amRows && amRows.length && amRows[0].email) {
            const am = amRows[0];
            const html = `
              <h3 style="color: #0b61ff;">Action Required: New CL Assigned for Review</h3>
              <p style="color: #0b2b5f;">Dear ${am.name || 'Assistant Manager'},</p>
              <p style="color: #0b2b5f;">A new Competency Leveling (CL) form <strong>#${clId}</strong> has been created for ${employeeName} (${employeeCode}) and has been routed to you for review.</p>
              <p style="color: #0b2b5f;">Please review the CL at your earliest convenience.</p>
              <hr/>
              <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
            `;

            const text = `Dear ${am.name || 'Assistant Manager'},\n\nA new Competency Leveling (CL) form (#${clId}) has been created for ${employeeName} (${employeeCode}) and has been routed to you for review.\n\nPlease review the CL at your earliest convenience.\n\nRegards,\nFutura System`;

            sendEmail({ to: am.email, subject: `CL #${clId} Assigned for Review`, text, html })
              .then(r => { if (r) console.log(`[EMAIL] Sent AM assign CL #${clId} to ${am.email}`); })
              .catch(e => console.error('[EMAIL] AM assign notify error:', e.message));

            await createNotification({ recipient_id: am.id, message: `CL #${clId} for ${employeeName} has been created and assigned to you for review.`, module: 'CL' }).catch(err => console.error('Failed to create AM notification:', err));
          }
        } else if (manager_id) {
          const [mgrRows] = await db.query(`SELECT id, name, email FROM users WHERE id = ? LIMIT 1`, [manager_id]);
          if (mgrRows && mgrRows.length && mgrRows[0].email) {
            const mgr = mgrRows[0];
            const html = `
              <h3 style="color: #0b61ff;">Action Required: New CL Assigned for Review</h3>
              <p style="color: #0b2b5f;">Dear ${mgr.name || 'Manager'},</p>
              <p style="color: #0b2b5f;">A new Competency Leveling (CL) form <strong>#${clId}</strong> has been created for ${employeeName} (${employeeCode}) and has been routed to you for review.</p>
              <p style="color: #0b2b5f;">Please review the CL at your earliest convenience.</p>
              <hr/>
              <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
            `;

            const text = `Dear ${mgr.name || 'Manager'},\n\nA new Competency Leveling (CL) form (#${clId}) has been created for ${employeeName} (${employeeCode}) and has been routed to you for review.\n\nPlease review the CL at your earliest convenience.\n\nRegards,\nFutura System`;

            sendEmail({ to: mgr.email, subject: `CL #${clId} Assigned for Review`, text, html })
              .then(r => { if (r) console.log(`[EMAIL] Sent Manager assign CL #${clId} to ${mgr.email}`); })
              .catch(e => console.error('[EMAIL] Manager assign notify error:', e.message));

            await createNotification({ recipient_id: mgr.id, message: `CL #${clId} for ${employeeName} has been created and assigned to you for review.`, module: 'CL' }).catch(err => console.error('Failed to create Manager notification:', err));
          }
        } else {
          // No AM or Manager assigned: HR were already notified via sendCLNotificationEmail
        }
      }
    } catch (e) {
      console.error('[CL SERVICE] Failed to notify next reviewer on create:', e.message);
    }

    return { id: clId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// =====================
// UPDATE CL ITEMS
// =====================
async function update(id, payload) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    if (payload.items && Array.isArray(payload.items)) {
      for (const item of payload.items) {
        // Only update pdf_path if explicitly provided
        if (item.pdf_path) {
          await conn.query(
            `UPDATE cl_items
               SET assigned_level = ?,
                   weight         = ?,
                   justification  = ?,
                   score          = (weight / 100.0) * assigned_level,
                   pdf_path       = ?,
                   updated_at     = NOW()
             WHERE id = ? AND cl_header_id = ?`,
            [
              item.assigned_level,
              item.weight,
              item.justification || '',
              item.pdf_path,
              item.id,
              id
            ]
          );
        } else {
          // Don't update pdf_path if no new file provided
          await conn.query(
            `UPDATE cl_items
               SET assigned_level = ?,
                   weight         = ?,
                   justification  = ?,
                   score          = (weight / 100.0) * assigned_level,
                   updated_at     = NOW()
             WHERE id = ? AND cl_header_id = ?`,
            [
              item.assigned_level,
              item.weight,
              item.justification || '',
              item.id,
              id
            ]
          );
        }
      }
    }

    await conn.query(
      `UPDATE cl_headers SET updated_at = NOW() WHERE id = ?`,
      [id]
    );

    await conn.commit();
    return await getById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// =====================
// SUBMIT CL
// Decide next status based on context:
// - If first submission: route to AM or Manager based on department
// - If resubmission: route back to whoever returned it
// =====================
// services/cl.service.js
async function submit(id, supervisorRemarks = null) {
  // 1) Find the CL and department (include existing supervisor_remarks)
  const [rows] = await db.query(
    `SELECT 
        ch.id,
        ch.employee_id,
        ch.supervisor_id,
        ch.department_id,
        ch.cycle_id,
        ch.status,
        ch.awaiting_approval_from,
        ch.supervisor_remarks,
        d.has_am,
        u.manager_id,
        u.am_id
     FROM cl_headers ch
     JOIN departments d ON d.id = ch.department_id
     JOIN users u ON u.id = ch.employee_id
     WHERE ch.id = ?`,
    [id]
  );

  if (!rows.length) {
    const err = new Error('CL not found');
    err.statusCode = 404;
    throw err;
  }

  const clHeader = rows[0];

  // ✅ detect if this is resubmission BEFORE we clear awaiting_approval_from
  const isResubmission = !!clHeader.awaiting_approval_from;

  // ✅ get employee name for the action title
  const [empRows] = await db.query(
    `SELECT name FROM users WHERE id = ?`,
    [clHeader.employee_id]
  );
  const employeeName = empRows[0]?.name || 'Employee';

  // 2) Determine next status based on individual assignments
  let nextStatus;

  if (clHeader.awaiting_approval_from) {
    // For resubmission, route back to whoever returned it
    nextStatus = clHeader.awaiting_approval_from;
  } else {
    // For first submission, check individual assignments
    // Priority: 1. Assistant Manager (if assigned), 2. Manager (if assigned), 3. HR
    if (clHeader.am_id) {
      nextStatus = 'PENDING_AM';
    } else if (clHeader.manager_id) {
      nextStatus = 'PENDING_MANAGER';
    } else {
      // Fallback to department-based routing if no individual assignments
      const hasAM = !!clHeader.has_am;
      nextStatus = hasAM ? 'PENDING_AM' : 'PENDING_MANAGER';
    }
  }

  // 3) No longer auto-generate PDF - use uploaded PDFs instead
  // const pdfPath = await generateCLPDF(id, clHeader);

  // 4) Update supervisor_remarks with new remarks if provided
  let newSupervisorRemarks = supervisorRemarks || clHeader.supervisor_remarks;

  // 5) Update header status and pdf_path for all items
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE cl_headers 
         SET status = ?, 
             awaiting_approval_from = NULL,
             supervisor_remarks = ?,
             updated_at = NOW() 
       WHERE id = ?`,
      [nextStatus, newSupervisorRemarks, id]
    );

    // PDF paths are already set per competency item via the update() function
    // No need to override them here

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // ✅ 6) LOG RECENT ACTION (after commit so it won't log on failure)
  await logRecentAction({
    actor_id: clHeader.supervisor_id,
    module: 'CL',
    action_type: isResubmission ? 'CL_RESUBMITTED' : 'CL_SUBMITTED',
    cl_id: id,
    employee_id: clHeader.employee_id,
    title: isResubmission
      ? `Resubmitted form for ${employeeName}`
      : `Created form for ${employeeName}`,
    description: `CL #${id}`,
    url: `/cl/supervisor/review/${id}`,
  });

  // 7) Send email notification to employee
  const [supervisorRows] = await db.query(
    `SELECT name FROM users WHERE id = ?`,
    [clHeader.supervisor_id]
  );
  const supervisorName = supervisorRows[0]?.name || 'Supervisor';
  
  await sendCLNotificationEmail({
    clId: id,
    employeeId: clHeader.employee_id,
    actionType: isResubmission ? 'RESUBMITTED' : 'CREATED',
    actorName: supervisorName,
    actorRole: 'Supervisor',
    employeeName: employeeName,
    employeeCode: empRows[0]?.employee_id || '',
    remarks: supervisorRemarks,
    requiresEmployeeAction: false
  }).catch(err => console.error('Failed to send email:', err));

  // 8) Create in-app notification for employee
  await createNotification({
    recipient_id: clHeader.employee_id,
    message: `CL #${id} ${isResubmission ? 'resubmitted' : 'created'} for you by ${supervisorName}`,
    module: 'CL'
  }).catch(err => console.error('Failed to create notification:', err));

  // 9) Create notification for the next approver (specific Manager, AM, or HR)
  let approverId = null;
  let approverName = '';
  
  if (nextStatus === 'PENDING_HR') {
    // For HR approval, find any HR user
    const [hrRows] = await db.query(
      `SELECT id, name FROM users WHERE role = 'HR' AND is_active = 1 LIMIT 1`
    );
    if (hrRows.length > 0) {
      approverId = hrRows[0].id;
      approverName = hrRows[0].name;
    }
  } else if (nextStatus === 'PENDING_AM') {
    // For AM approval, use assigned AM first, then fallback to department AM
    if (clHeader.am_id) {
      const [amRows] = await db.query(
        `SELECT id, name FROM users WHERE id = ? AND is_active = 1`,
        [clHeader.am_id]
      );
      if (amRows.length > 0) {
        approverId = amRows[0].id;
        approverName = amRows[0].name;
      }
    } else {
      // Fallback to department AM
      const [amRows] = await db.query(
        `SELECT id, name FROM users 
         WHERE department_id = ? AND role = 'AM' AND is_active = 1 
         LIMIT 1`,
        [clHeader.department_id]
      );
      if (amRows.length > 0) {
        approverId = amRows[0].id;
        approverName = amRows[0].name;
      }
    }
  } else if (nextStatus === 'PENDING_MANAGER') {
    // For Manager approval, use assigned manager first, then fallback to department manager
    if (clHeader.manager_id) {
      const [managerRows] = await db.query(
        `SELECT id, name FROM users WHERE id = ? AND is_active = 1`,
        [clHeader.manager_id]
      );
      if (managerRows.length > 0) {
        approverId = managerRows[0].id;
        approverName = managerRows[0].name;
      }
    } else {
      // Fallback to department manager
      const [managerRows] = await db.query(
        `SELECT id, name FROM users 
         WHERE department_id = ? AND role = 'Manager' AND is_active = 1 
         LIMIT 1`,
        [clHeader.department_id]
      );
      if (managerRows.length > 0) {
        approverId = managerRows[0].id;
        approverName = managerRows[0].name;
      }
    }
  }
  
  // Send notification to the specific approver
  if (approverId) {
    const remarksText = supervisorRemarks ? ` Remarks: ${supervisorRemarks}` : '';
    await createNotification({
      recipient_id: approverId,
      message: `CL #${id} for ${employeeName} ${isResubmission ? 'resubmitted' : 'submitted'} by ${supervisorName} is awaiting your approval.${remarksText}`,
      module: 'CL',
      url: `/hr#CL`
    }).catch(err => console.error('Failed to create notification for approver:', err));
  }

  // 10) Return latest CL data
  return await getById(id);
}


// =====================
// GENERATE CL PDF
// =====================
async function generateCLPDF(clId, clHeader) {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../uploads/cl');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate filename
    const timestamp = Date.now();
    const filename = `cl_${clId}_${timestamp}.pdf`;
    const filePath = path.join(uploadsDir, filename);

    // Get CL data with items and competencies
    const [headerRows] = await db.query(
      `SELECT * FROM cl_headers WHERE id = ?`,
      [clId]
    );

    const [itemRows] = await db.query(
      `SELECT 
         ci.id,
         ci.competency_id,
         ci.mplr_level,
         ci.assigned_level,
         ci.weight,
         ci.justification,
         ci.score,
         c.name AS competency_name
       FROM cl_items ci
       JOIN competencies c ON ci.competency_id = c.id
       WHERE ci.cl_header_id = ?
       ORDER BY c.name`,
      [clId]
    );

    // Get employee, supervisor, and department info
    const [empData] = await db.query(
      `SELECT u.name, u.employee_id, u.email, p.title as position_title, d.name as department_name
       FROM users u
       JOIN positions p ON u.position_id = p.id
       JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [clHeader.employee_id]
    );

    const [supData] = await db.query(
      `SELECT u.name as supervisor_name FROM users u WHERE u.id = ?`,
      [clHeader.supervisor_id]
    );

    const employee = empData[0] || {};
    const supervisor = supData[0] || {};

    // Create PDF
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Title
    doc.fontSize(20).font('Helvetica-Bold').text('Competency Leveling Form', { align: 'center' });
    doc.moveDown(0.5);

    // Employee Info
    doc.fontSize(12).font('Helvetica-Bold').text('Employee Information', { underline: true });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Name: ${employee.name || 'N/A'}`);
    doc.text(`Employee ID: ${employee.employee_id || 'N/A'}`);
    doc.text(`Email: ${employee.email || 'N/A'}`);
    doc.text(`Position: ${employee.position_title || 'N/A'}`);
    doc.text(`Department: ${employee.department_name || 'N/A'}`);
    doc.moveDown(0.5);

    // Supervisor Info
    doc.fontSize(12).font('Helvetica-Bold').text('Supervisor Information', { underline: true });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Supervisor: ${supervisor.supervisor_name || 'N/A'}`);
    doc.moveDown(0.5);

    // Competencies Table
    doc.fontSize(12).font('Helvetica-Bold').text('Competency Levels', { underline: true });
    doc.moveDown(0.3);

    // Table headers
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Competency', 50, doc.y, { width: 150 });
    doc.text('MPLR Level', 210, doc.y - 11, { width: 70 });
    doc.text('Assigned Level', 290, doc.y - 11, { width: 80 });
    doc.text('Weight %', 380, doc.y - 11, { width: 50 });
    doc.text('Score', 440, doc.y - 11, { width: 50 });
    doc.moveDown(0.5);

    // Table rows
    doc.fontSize(9).font('Helvetica');
    itemRows.forEach((item) => {
      const competencyText = (item.competency_name || 'N/A').substring(0, 40);
      doc.text(competencyText, 50, doc.y, { width: 150 });
      doc.text(String(item.mplr_level || '-'), 210, doc.y - 11, { width: 70 });
      doc.text(String(item.assigned_level || '-'), 290, doc.y - 11, { width: 80 });
      doc.text(`${item.weight || 0}%`, 380, doc.y - 11, { width: 50 });
      doc.text(String(item.score || '-').substring(0, 5), 440, doc.y - 11, { width: 50 });
      doc.moveDown(0.4);
    });

    doc.moveDown(1);

    // Footer
    doc.fontSize(8).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    // Finalize PDF
    doc.end();

    // Return a promise that resolves when the file is written
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        logInfo('PDF generated successfully', { clId, filePath });
        resolve(`uploads/cl/${filename}`);
      });
      stream.on('error', (err) => {
        logInfo('PDF generation failed', { clId, error: err.message });
        reject(err);
      });
    });
  } catch (err) {
    logInfo('Error in generateCLPDF', { clId, error: err.message });
    throw err;
  }
}

// =====================
// SUPERVISOR SUMMARY
// Only employees in the same department as the supervisor
// =====================
async function getSupervisorSummary(supervisorId) {
  const [rows] = await db.query(
    `
    SELECT
      -- Pending: anything waiting on someone in the CL workflow
      SUM(
        ch.status IN (
          'PENDING_AM',
          'PENDING_MANAGER',
          'PENDING_EMPLOYEE',
          'PENDING_HR'
        )
      ) AS clPending,

      -- In Progress: still being edited by supervisor (DRAFT)
      SUM(ch.status = 'DRAFT') AS clInProgress,

      -- Approved
      SUM(ch.status = 'APPROVED') AS clApproved
    FROM cl_headers ch
      JOIN users e ON ch.employee_id   = e.id
    WHERE
      ch.supervisor_id = ?
    `,
    [supervisorId]
  );

  const row = rows[0] || {};

  return {
    clPending: Number(row.clPending || 0),
    clInProgress: Number(row.clInProgress || 0),
    clApproved: Number(row.clApproved || 0),
    // if you don’t have an IDP summary yet, just keep 0 here
    idpCount: Number(row.idpCount || 0),
  };
}



// =====================
// SUPERVISOR ALL CLs
// Get all CLs grouped by status
// =====================
async function getSupervisorAllCL(supervisorId) {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        ch.id,
        e.name        AS employee_name,
        e.employee_id AS employee_code,
        d.name        AS department_name,
        p.title       AS position_title,
        ch.status,
        ch.awaiting_approval_from,
        ch.created_at AS submitted_at
      FROM cl_headers ch
        JOIN users e       ON ch.employee_id   = e.id
        JOIN departments d ON e.department_id  = d.id
        JOIN positions   p ON e.position_id    = p.id
      WHERE
        ch.supervisor_id = ?
      ORDER BY ch.status ASC, ch.created_at DESC
      `,
      [supervisorId]
    );

    // Group by status
    const grouped = {};
    (rows || []).forEach(row => {
      if (!grouped[row.status]) {
        grouped[row.status] = [];
      }
      grouped[row.status].push(row);
    });

    return grouped;
  } catch (err) {
    logInfo('Error getting all supervisor CLs', { supervisorId, error: err.message });
    return {};
  }
}

// =====================
// SUPERVISOR PENDING LIST
// Only employees in the same department as the supervisor
// and returns department / position info for the FE
// =====================
async function getSupervisorPending(supervisorId) {
  const [rows] = await db.query(
    `
    SELECT 
      ch.id,
      e.name        AS employee_name,
      e.employee_id AS employee_code,
      d.name        AS department_name,
      p.title       AS position_title,
      ch.status,
      ch.created_at AS submitted_at
    FROM cl_headers ch
      JOIN users e       ON ch.employee_id   = e.id
      JOIN departments d ON e.department_id  = d.id
      JOIN positions   p ON e.position_id    = p.id
    WHERE
      ch.supervisor_id = ?
      AND ch.status IN ('DRAFT', 'IN_PROGRESS', 'PENDING_AM', 'PENDING_MANAGER')
    ORDER BY ch.created_at DESC
    `,
    [supervisorId]
  );

  return rows;
}

// =====================
// MANAGER SUMMARY
// CLs that reached Manager stage in the same department
// =====================
async function getManagerSummary(managerId) {
  const [rows] = await db.query(
    `
    SELECT
      SUM(ch.status = 'PENDING_MANAGER') AS clPending,
      SUM(ch.status = 'MANAGER_REVIEW')  AS clInProgress,
      (SELECT COUNT(*) FROM cl_manager_logs cml 
       JOIN cl_headers ch2 ON cml.cl_id = ch2.id
       JOIN users e2 ON ch2.employee_id = e2.id
       WHERE cml.manager_id = ? AND cml.action = 'APPROVED'
       AND cml.id = (SELECT MAX(id) FROM cl_manager_logs WHERE cl_id = ch2.id AND manager_id = ?)
       AND e2.manager_id = ?
      ) AS clApproved,
      (SELECT COUNT(*) FROM cl_manager_logs cml 
       JOIN cl_headers ch2 ON cml.cl_id = ch2.id
       JOIN users e2 ON ch2.employee_id = e2.id
       WHERE cml.manager_id = ? AND cml.action = 'RETURNED' AND ch2.status = 'DRAFT'
       AND cml.id = (SELECT MAX(id) FROM cl_manager_logs WHERE cl_id = ch2.id AND manager_id = ?)
       AND e2.manager_id = ?
      ) AS clReturned
    FROM cl_headers ch
      JOIN users e ON ch.employee_id = e.id
    WHERE
      e.manager_id = ?
    `,
    [managerId, managerId, managerId, managerId, managerId, managerId, managerId]
  );

  return rows[0] || { clPending: 0, clInProgress: 0, clApproved: 0, clReturned: 0 };
}

// =====================
// MANAGER PENDING LIST
// CLs that are at Manager stage for this department
// =====================
async function getManagerPending(managerId) {
  const [rows] = await db.query(
    `
    SELECT 
      ch.id,
      ch.employee_id,
      ch.supervisor_id,
      e.name        AS employee_name,
      e.employee_id AS employee_code,
      d.name        AS department_name,
      p.title       AS position_title,
      ch.status,
      ch.created_at AS submitted_at,
      ROUND(AVG(ci.score), 2) as competency_score
    FROM cl_headers ch
      JOIN users e       ON ch.employee_id  = e.id
      JOIN departments d ON e.department_id = d.id
      JOIN positions   p ON e.position_id   = p.id
      LEFT JOIN cl_items ci ON ch.id = ci.cl_header_id
    WHERE
      e.manager_id = ?
      AND ch.status IN ('PENDING_MANAGER', 'MANAGER_REVIEW')
    GROUP BY ch.id, ch.employee_id, ch.supervisor_id, e.name, e.employee_id, d.name, p.title, ch.status, ch.created_at
    ORDER BY ch.created_at DESC
    `,
    [managerId]
  );

  return rows;
}

// =====================
// GET COMPETENCIES FOR EMPLOYEE
// =====================
async function getCompetenciesForEmployee(employeeId) {
  const [emp] = await db.query(
    `SELECT
        u.id,
        u.name,
        u.employee_id,
        u.email,
        u.position_id,
        u.department_id,
        u.supervisor_id,
        u.manager_id,
        u.am_id,
        p.title AS position_title,
        d.name  AS department_name,
        s.name  AS supervisor_name,
        m.name  AS manager_name,
        am.name AS am_name
     FROM users u
     JOIN positions   p ON u.position_id   = p.id
     JOIN departments d ON u.department_id = d.id
     LEFT JOIN users  s ON u.supervisor_id = s.id
     LEFT JOIN users  m ON u.manager_id = m.id
     LEFT JOIN users  am ON u.am_id = am.id
     WHERE u.id = ?`,
    [employeeId]
  );

  if (!emp.length) return null;

  const employee = emp[0];

  const [competencies] = await db.query(
    `SELECT
        c.id AS competency_id,
        c.name,
        c.description,
        pc.required_level     AS mplr,
        pc.max_level_increment
     FROM position_competencies pc
     JOIN competencies c ON c.id = pc.competency_id
     WHERE pc.position_id = ?`,
    [employee.position_id]
  );

  return { employee, competencies };
}

// =====================
// MANAGER APPROVE CL
// =====================
async function managerApprove(id, approverId, remarks) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Insert audit log
    await conn.query(
      `INSERT INTO cl_manager_logs (cl_id, manager_id, action, remarks)
       VALUES (?, ?, 'APPROVED', ?)`,
      [id, approverId, remarks || null]
    );

    // Move CL to next stage and save remarks
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'PENDING_EMPLOYEE',
           manager_remarks = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [remarks || null, id]
    );

    await conn.commit();

    // Get CL and employee details for email
    const [clRows] = await conn.query(
      `SELECT ch.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers ch
       JOIN users e ON ch.employee_id = e.id
       WHERE ch.id = ?`,
      [id]
    );

    const [managerRows] = await conn.query(
      `SELECT name FROM users WHERE id = ?`,
      [approverId]
    );

    // Send email notification to employee
    if (clRows.length > 0 && managerRows.length > 0) {
      const { employee_id, employee_name, employee_code } = clRows[0];
      await sendCLNotificationEmail({
        clId: id,
        employeeId: employee_id,
        actionType: 'APPROVED',
        actorName: managerRows[0].name,
        actorRole: 'Manager',
        employeeName: employee_name,
        employeeCode: employee_code,
        remarks: remarks,
        requiresEmployeeAction: true
      }).catch(err => console.error('Failed to send email:', err));

      // Create in-app notification
      await createNotification({
        recipient_id: employee_id,
        message: `CL #${id} approved by Manager ${managerRows[0].name}. Please review and approve.`,
        module: 'CL'
      }).catch(err => console.error('Failed to create notification:', err));
      
      // Log recent action
      await logRecentAction({
        actor_id: approverId,
        module: 'CL',
        action_type: 'CL_APPROVED',
        cl_id: id,
        employee_id: employee_id,
        title: `Approved form for ${employee_name}`,
        description: `CL #${id}`,
        url: `/cl/submissions/${id}`,
      }).catch(err => console.error('Failed to log recent action:', err));

      // Notify supervisor by email and in-app
      try {
        const supervisor = await getSupervisorEmail(id);
        if (supervisor && supervisor.email) {
          const supSubject = `CL #${id} Approved by Manager`;
          const supHtml = `
            <h3 style="color: #0b61ff;">CL Approved by Manager</h3>
            <p style="color: #0b2b5f;">Hello <strong>${supervisor.name}</strong>,</p>
            <p style="color: #0b2b5f;">Please be informed that CL <strong>#${id}</strong> for <strong>${employee_name} (${employee_code})</strong> has been approved by Manager <strong>${managerRows[0].name}</strong>.</p>
            ${remarks ? `<p style="color: #0b2b5f;"><strong>Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
            <p style="color: #0b2b5f;">No action is required from you at this time.</p>
            <hr/>
            <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
          `;

          const supText = `CL #${id} Approved by Manager\n\n` +
            `Hello ${supervisor.name},\n\n` +
            `Please be informed that CL #${id} for ${employee_name} (${employee_code}) has been approved by Manager ${managerRows[0].name}.\n\n` +
            (remarks ? `Remarks: ${remarks}\n\n` : '') +
            `No action is required from you at this time.`;

          await sendEmail({ to: supervisor.email, subject: supSubject, text: supText, html: supHtml })
            .then(r => { if (r) console.log(`[EMAIL] Sent Manager-approval notify CL #${id} to supervisor ${supervisor.email}`); })
            .catch(e => console.error('[EMAIL] Supervisor notify error (managerApprove):', e.message));

          await createNotification({ recipient_id: supervisor.id, message: `CL #${id} has been approved by Manager ${managerRows[0].name}.`, module: 'CL' })
            .catch(err => console.error('Failed to create supervisor notification after manager approve:', err));
        }
      } catch (e) {
        console.error('[CL SERVICE] Failed to notify supervisor after manager approve:', e.message);
      }
    }

    return { success: true, message: 'Manager approved CL, moved to Employee' };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}


// =====================
// MANAGER RETURN CL TO SUPERVISOR
// =====================
async function managerReturn(id, approverId, remarks) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Insert audit log
    await conn.query(
      `INSERT INTO cl_manager_logs (cl_id, manager_id, action, remarks)
       VALUES (?, ?, 'RETURNED', ?)`,
      [id, approverId, remarks]
    );

    // Move CL back to supervisor and save remarks with DRAFT status
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'DRAFT',
           awaiting_approval_from = 'PENDING_MANAGER',
           manager_remarks = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [remarks, id]
    );

    await conn.commit();

    // Get CL and employee details for email
    const [clRows] = await conn.query(
      `SELECT ch.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers ch
       JOIN users e ON ch.employee_id = e.id
       WHERE ch.id = ?`,
      [id]
    );

    const [managerRows] = await conn.query(
      `SELECT name FROM users WHERE id = ?`,
      [approverId]
    );

    // Send email notification to employee
    if (clRows.length > 0 && managerRows.length > 0) {
      const { employee_id, employee_name, employee_code } = clRows[0];
      await sendCLNotificationEmail({
        clId: id,
        employeeId: employee_id,
        actionType: 'RETURNED',
        actorName: managerRows[0].name,
        actorRole: 'Manager',
        employeeName: employee_name,
        employeeCode: employee_code,
        remarks: remarks,
        requiresEmployeeAction: false
      }).catch(err => console.error('Failed to send email:', err));
    }

    // Notify supervisor
    const [supRows] = await conn.query(
      `SELECT supervisor_id FROM cl_headers WHERE id = ?`,
      [id]
    );
    if (supRows.length > 0 && supRows[0].supervisor_id && managerRows.length > 0) {
      await createNotification({
        recipient_id: supRows[0].supervisor_id,
        message: `CL #${id} was returned by Manager ${managerRows[0].name}. Reason: ${remarks || 'No reason provided'}`,
        module: 'CL'
      }).catch(err => console.error('Failed to create notification:', err));

      // Also send a formal email to the supervisor
      try {
        const supervisor = await getSupervisorEmail(id);
        if (supervisor && supervisor.email) {
          const supSubject = `Action Required: CL #${id} Returned by Manager`;
          const supHtml = `
            <h3 style="color: #0b61ff;">CL Returned by Manager</h3>
            <p style="color: #0b2b5f;">Hello <strong>${supervisor.name}</strong>,</p>
            <p style="color: #0b2b5f;">Please be informed that CL <strong>#${id}</strong> has been returned to you by Manager <strong>${managerRows[0].name}</strong> for revision.</p>
            <p style="color: #0b2b5f;"><strong>Employee:</strong> ${clRows[0]?.employee_name} (${clRows[0]?.employee_code})</p>
            ${remarks ? `<p style="color: #0b2b5f;"><strong>Manager Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
            <p style="color: #0b2b5f;">Please review the remarks, update the form as necessary, and resubmit when ready.</p>
            <hr/>
            <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
          `;

          const supText = `CL #${id} Returned by Manager\n\n` +
            `Hello ${supervisor.name},\n\n` +
            `Please be informed that CL #${id} has been returned to you by Manager ${managerRows[0].name} for revision.\n\n` +
            `Employee: ${clRows[0]?.employee_name} (${clRows[0]?.employee_code})\n\n` +
            (remarks ? `Manager Remarks: ${remarks}\n\n` : '') +
            `Please review the remarks, update the form as necessary, and resubmit when ready.`;

          await sendEmail({ to: supervisor.email, subject: supSubject, text: supText, html: supHtml })
            .then(r => { if (r) console.log(`[EMAIL] Sent Manager-return notify CL #${id} to supervisor ${supervisor.email}`); })
            .catch(e => console.error('[EMAIL] Supervisor notify error (managerReturn):', e.message));
        }
      } catch (e) {
        console.error('[CL SERVICE] Failed to email supervisor after manager return:', e.message);
      }
    }
    
    // Log recent action
    if (clRows.length > 0 && managerRows.length > 0) {
      const { employee_id, employee_name } = clRows[0];
      await logRecentAction({
        actor_id: approverId,
        module: 'CL',
        action_type: 'CL_RETURNED',
        cl_id: id,
        employee_id: employee_id,
        title: `Returned form for ${employee_name}`,
        description: `CL #${id}`,
        url: `/cl/submissions/${id}`,
      }).catch(err => console.error('Failed to log recent action:', err));
    }

    return { success: true, message: 'Manager returned CL to Supervisor' };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}



// =====================
// EMPLOYEE DASHBOARD
// =====================
async function getEmployeePending(employeeId) {
  try {
    const [rows] = await db.query(
      `SELECT 
         ch.id,
         ch.supervisor_id,
         u.name as supervisor_name,
         d.name as department_name,
         ch.status,
         ch.created_at
       FROM cl_headers ch
       JOIN users u ON ch.supervisor_id = u.id
       JOIN departments d ON ch.department_id = d.id
       WHERE ch.employee_id = ? AND ch.status = 'PENDING_EMPLOYEE'
       ORDER BY ch.created_at DESC`,
      [employeeId]
    );

    return rows || [];
  } catch (err) {
    logInfo('Error getting employee pending CLs', { employeeId, error: err.message });
    return [];
  }
}

// =====================
// AM DASHBOARD
// =====================
async function getAMSummary(amId) {
  const [rows] = await db.query(
    `SELECT
       SUM(ch.status = 'PENDING_AM') as clPending,
       SUM(ch.status = 'APPROVED') as clApproved,
       SUM(ch.status = 'DRAFT') as clReturned
     FROM cl_headers ch
     JOIN users u ON ch.employee_id = u.id
     WHERE u.am_id = ?`,
    [amId]
  );

  return {
    clPending: rows[0]?.clPending || 0,
    clApproved: rows[0]?.clApproved || 0,
    clReturned: rows[0]?.clReturned || 0
  };
}

async function getAMPending(amId) {
  try {
    const [rows] = await db.query(
      `SELECT 
         ch.id,
         ch.employee_id,
         u.name as employee_name,
         u.employee_id as emp_code,
         u.employee_id as employee_code,
         s.name as supervisor_name,
         d.name as department_name,
         p.title as position_title,
         ch.status,
         ch.created_at as submitted_at,
         ROUND(AVG(ci.score), 2) as competency_score
       FROM cl_headers ch
       JOIN users u ON ch.employee_id = u.id
       JOIN users s ON ch.supervisor_id = s.id
       JOIN departments d ON ch.department_id = d.id
       JOIN positions p ON u.position_id = p.id
       LEFT JOIN cl_items ci ON ch.id = ci.cl_header_id
       WHERE ch.status = 'PENDING_AM' AND u.am_id = ?
       GROUP BY ch.id, ch.employee_id, u.name, u.employee_id, s.name, d.name, p.title, ch.status, ch.created_at
       ORDER BY ch.created_at DESC`,
      [amId]
    );

    return rows || [];
  } catch (err) {
    logInfo('Error getting AM pending CLs', { amId, error: err.message });
    return [];
  }
}

// =====================
// HR DASHBOARD
// =====================
async function getHRSummary(hrId, departmentName = null) {
  let query = `SELECT
       SUM(ch.status = 'PENDING_HR') as clPending,
       SUM(ch.status = 'APPROVED') as clApproved,
       SUM(ch.status = 'DRAFT') as clReturned
     FROM cl_headers ch`;
  
  const params = [];
  
  // If department name is provided, filter by department
  if (departmentName) {
    query += ` JOIN departments d ON ch.department_id = d.id WHERE d.name = ?`;
    params.push(departmentName);
  }

  const [rows] = await db.query(query, params);

  return {
    clPending: rows[0]?.clPending || 0,
    clApproved: rows[0]?.clApproved || 0,
    clReturned: rows[0]?.clReturned || 0
  };
}

async function getHRPending(hrId) {
  try {
    const [rows] = await db.query(
      `SELECT 
         ch.id,
         ch.employee_id,
         u.name as employee_name,
         u.employee_id as emp_code,
         s.name as supervisor_name,
         d.name as department_name,
         ch.status,
         ch.created_at
       FROM cl_headers ch
       JOIN users u ON ch.employee_id = u.id
       JOIN users s ON ch.supervisor_id = s.id
       JOIN departments d ON ch.department_id = d.id
       WHERE ch.status = 'PENDING_HR'
       ORDER BY ch.created_at DESC`,
      []
    );

    return rows || [];
  } catch (err) {
    logInfo('Error getting HR pending CLs', { hrId, error: err.message });
    return [];
  }
}

// =====================
// AM APPROVE
// =====================
async function amApprove(id, approverId, remarks) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Get CL and employee details including manager
    const [clRows] = await conn.query(
      `SELECT ch.employee_id, e.name as employee_name, e.employee_id as employee_code,
              e.manager_id, u.name as am_name
       FROM cl_headers ch
       JOIN users e ON ch.employee_id = e.id
       JOIN users u ON u.id = ?
       WHERE ch.id = ?`,
      [approverId, id]
    );

    // Insert audit log
    await conn.query(
      `INSERT INTO cl_manager_logs (cl_id, manager_id, action, remarks)
       VALUES (?, ?, 'APPROVED', ?)`,
      [id, approverId, remarks || null]
    );

    // Update CL status to PENDING_MANAGER
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'PENDING_MANAGER', updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await conn.commit();

    // Send notifications and log action
    if (clRows.length > 0) {
      const { employee_id, employee_name, employee_code, manager_id, am_name } = clRows[0];
      const currentDateTime = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
      
      // Send email notification to employee
      await sendCLNotificationEmail({
        clId: id,
        employeeId: employee_id,
        actionType: 'APPROVED',
        actorName: am_name || 'Assistant Manager',
        actorRole: 'AM',
        employeeName: employee_name,
        employeeCode: employee_code,
        remarks: remarks,
        requiresEmployeeAction: true
      }).catch(err => console.error('Failed to send email:', err));

      // Send in-app notification to employee
      await createNotification({
        recipient_id: employee_id,
        message: `CL #${id} has been approved by Assistant Manager ${am_name || 'AM'}. Please review and approve.`,
        module: 'CL',
      }).catch(err => console.error('Failed to create employee notification:', err));

      // Send email notification to supervisor as well
      try {
        const supervisorInfo = await getSupervisorEmail(id);
        if (supervisorInfo && supervisorInfo.email) {
          const supHtml = `
            <h3 style="color: #0b61ff;">Notification: CL Approved by Assistant Manager</h3>
            <p style="color: #0b2b5f;">Dear ${supervisorInfo.name || 'Supervisor'},</p>
            <p style="color: #0b2b5f;">Please be informed that CL #${id} for ${employee_name} (${employee_code}) has been approved by Assistant Manager ${am_name || 'AM'} and is now pending further action.</p>
            <p style="color: #0b2b5f;">Submitted Date & Time: ${currentDateTime}</p>
            <hr/>
            <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
          `;

          const supText =
            `Dear ${supervisorInfo.name || 'Supervisor'},\n\n` +
            `CL #${id} for ${employee_name} (${employee_code}) has been approved by Assistant Manager ${am_name || 'AM'} and is now pending your review.\n\n` +
            `Submitted Date & Time: ${currentDateTime}\n\n` +
            `Regards,\nFutura System`;

          sendEmail({
            to: supervisorInfo.email,
            subject: `CL #${id} Approved by Assistant Manager`,
            text: supText,
            html: supHtml,
          })
            .then(r => { if (r) console.log(`[EMAIL] Sent supervisor notify CL #${id} to ${supervisorInfo.email}`); })
            .catch(e => console.error('[EMAIL] Supervisor notify error:', e.message));

          // also create in-app notification for supervisor
          if (supervisorInfo.id) {
            await createNotification({
              recipient_id: supervisorInfo.id,
              message: `CL #${id} for ${employee_name} has been approved by Assistant Manager ${am_name || 'AM'}.`,
              module: 'CL',
            }).catch(err => console.error('Failed to create supervisor notification:', err));
          }
        }
      } catch (e) {
        console.error('[CL SERVICE] Failed to notify supervisor on AM approve:', e.message);
      }

      // Notify manager that CL is pending their review
      if (manager_id) {
        await createNotification({
          recipient_id: manager_id,
          message: `CL #${id} for ${employee_name} has been approved by AM and requires your review.`,
          module: 'CL',
        }).catch(err => console.error('Failed to create manager notification:', err));
      }

      // Log the action
      await logRecentAction({
        actor_id: approverId,
        module: 'CL',
        action_type: 'CL_APPROVED_BY_AM',
        cl_id: id,
        employee_id: employee_id,
        title: `AM approved CL for ${employee_name}`,
        description: remarks || 'No remarks provided',
        url: `/cl/manager/review/${id}`,
      }).catch(err => console.error('Failed to log recent action:', err));
    }

    return { success: true, message: 'AM approved CL, moved to Employee' };
  } catch (err) {
    await conn.rollback();
    logInfo('Error in amApprove', { id, approverId, error: err.message });
    throw err;
  } finally {
    conn.release();
  }
}

// =====================
// AM RETURN
// =====================
async function amReturn(id, approverId, remarks) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Get CL and employee details
    const [clRows] = await conn.query(
      `SELECT ch.employee_id, e.name as employee_name, e.employee_id as employee_code,
              ch.supervisor_id, u.name as am_name
       FROM cl_headers ch
       JOIN users e ON ch.employee_id = e.id
       JOIN users u ON u.id = ?
       WHERE ch.id = ?`,
      [approverId, id]
    );

    // Insert audit log
    await conn.query(
      `INSERT INTO cl_manager_logs (cl_id, manager_id, action, remarks)
       VALUES (?, ?, 'RETURNED', ?)`,
      [id, approverId, remarks]
    );

    // Update CL status back to DRAFT and mark where it should go on resubmit
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'DRAFT', awaiting_approval_from = 'PENDING_AM', updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await conn.commit();

    // Send email notification to employee
    if (clRows.length > 0) {
      const { employee_id, employee_name, employee_code, am_name } = clRows[0];
      await sendCLNotificationEmail({
        clId: id,
        employeeId: employee_id,
        actionType: 'RETURNED',
        actorName: am_name || 'Assistant Manager',
        actorRole: 'AM',
        employeeName: employee_name,
        employeeCode: employee_code,
        remarks: remarks,
        requiresEmployeeAction: false
      }).catch(err => console.error('Failed to send email:', err));
    }

    // Notify supervisor
    const [supRows] = await conn.query(
      `SELECT supervisor_id FROM cl_headers WHERE id = ?`,
      [id]
    );
    if (supRows.length > 0 && supRows[0].supervisor_id && clRows.length > 0) {
      const { am_name } = clRows[0];
      await createNotification({
        recipient_id: supRows[0].supervisor_id,
        message: `CL #${id} was returned by Assistant Manager ${am_name || 'Assistant Manager'}. Reason: ${remarks || 'No reason provided'}`,
        module: 'CL',
        url: `/supervisor#CL`
      }).catch(err => console.error('Failed to create notification:', err));
    }

    // Log recent action
    if (clRows.length > 0) {
      const { employee_id, employee_name, am_name } = clRows[0];
      await logRecentAction({
        actor_id: approverId,
        module: 'CL',
        action_type: 'CL_RETURNED',
        cl_id: id,
        employee_id: employee_id,
        title: `Returned form for ${employee_name}`,
        description: `CL #${id}`,
        url: `/cl/supervisor/review/${id}`
      }).catch(err => console.error('Failed to log recent action:', err));
    }

    return { success: true, message: 'AM returned CL to Supervisor' };
  } catch (err) {
    await conn.rollback();
    logInfo('Error in amReturn', { id, approverId, error: err.message });
    throw err;
  } finally {
    conn.release();
  }
}

// =====================
// EMPLOYEE APPROVE
// =====================
// =====================
// EMPLOYEE APPROVE
// =====================
// =====================
// EMPLOYEE APPROVE
// =====================
async function employeeApprove(id, approverId, remarks) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Get employee details
    const [empRows] = await conn.query(
      `SELECT e.name as employee_name, e.employee_id as employee_code
       FROM users e WHERE e.id = ?`,
      [approverId]
    );

    // 1) Insert into EMPLOYEE LOGS (activity history)
    await conn.query(
      `INSERT INTO cl_employee_logs (cl_id, employee_id, action, remarks)
       VALUES (?, ?, 'APPROVED', ?)`,
      [id, approverId, remarks || null]
    );

    // 2) Update the header (latest state)
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'PENDING_HR',
           employee_remarks = COALESCE(?, employee_remarks),
           updated_at = NOW()
       WHERE id = ?`,
      [remarks, id]
    );

    await conn.commit();

    // Send email notification to employee
    if (empRows.length > 0) {
      const { employee_name, employee_code } = empRows[0];
      await sendCLNotificationEmail({
        clId: id,
        employeeId: approverId,
        actionType: 'APPROVED',
        actorName: employee_name,
        actorRole: 'Employee',
        employeeName: employee_name,
        employeeCode: employee_code,
        remarks: remarks,
        requiresEmployeeAction: false
      }).catch(err => console.error('Failed to send email:', err));
    }

    // Get HR users to notify
    const [hrUsers] = await conn.query(
      `SELECT id FROM users WHERE role = 'HR' LIMIT 1`
    );
    if (hrUsers.length > 0 && empRows.length > 0) {
      await createNotification({
        recipient_id: hrUsers[0].id,
        message: `CL #${id} for ${empRows[0].employee_name} approved by employee. Pending HR approval.`,
        module: 'CL'
      }).catch(err => console.error('Failed to create notification:', err));
    }

    // Notify supervisor by email and in-app, and notify all HR users by email
    try {
      const supervisor = await getSupervisorEmail(id);
      if (supervisor && supervisor.email) {
        const supSubject = `CL #${id} Approved by Employee`;
        const supHtml = `
          <h3 style="color: #0b61ff;">CL Approved by Employee</h3>
          <p style="color: #0b2b5f;">Hello <strong>${supervisor.name}</strong>,</p>
          <p style="color: #0b2b5f;">Please be informed that CL <strong>#${id}</strong> has been approved by the employee and is now pending HR approval.</p>
          <p style="color: #0b2b5f;"><strong>Employee:</strong> ${empRows[0].employee_name} (${empRows[0].employee_code})</p>
          ${remarks ? `<p style="color: #0b2b5f;"><strong>Employee Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p style="color: #0b2b5f;">Please review the submission if needed.</p>
          <hr/>
          <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
        `;

        const supText = `CL #${id} Approved by Employee\n\n` +
          `Hello ${supervisor.name},\n\n` +
          `Please be informed that CL #${id} has been approved by the employee and is now pending HR approval.\n\n` +
          `Employee: ${empRows[0].employee_name} (${empRows[0].employee_code})\n\n` +
          (remarks ? `Employee Remarks: ${remarks}\n\n` : '') +
          `Please review the submission if needed.`;

        await sendEmail({ to: supervisor.email, subject: supSubject, text: supText, html: supHtml })
          .then(r => { if (r) console.log(`[EMAIL] Sent employee-approval notify CL #${id} to supervisor ${supervisor.email}`); })
          .catch(e => console.error('[EMAIL] Supervisor notify error (employeeApprove):', e.message));

        await createNotification({ recipient_id: supervisor.id, message: `CL #${id} has been approved by the employee and is pending HR.`, module: 'CL' })
          .catch(err => console.error('Failed to create supervisor notification after employee approve:', err));
      }

      // Email all HR users
      const [hrEmailRows] = await db.query(`SELECT id, email, name FROM users WHERE role = 'HR' AND is_active = 1`);
      if (hrEmailRows && hrEmailRows.length) {
        const hrSubject = `CL #${id} Pending HR Approval`;
        const hrHtml = `
          <h3 style="color: #0b61ff;">CL Pending HR Approval</h3>
          <p style="color: #0b2b5f;">Hello,</p>
          <p style="color: #0b2b5f;">CL <strong>#${id}</strong> for <strong>${empRows[0].employee_name} (${empRows[0].employee_code})</strong> has been approved by the employee and requires HR review.</p>
          <p style="color: #0b2b5f;">Please log in to the system to review and take necessary action.</p>
          <hr/>
          <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
        `;

        const hrText = `CL #${id} Pending HR Approval\n\n` +
          `CL #${id} for ${empRows[0].employee_name} (${empRows[0].employee_code}) has been approved by the employee and requires HR review.`;

        for (const hr of hrEmailRows) {
          if (hr.email) {
            sendEmail({ to: hr.email, subject: hrSubject, text: hrText, html: hrHtml })
              .then(r => { if (r) console.log(`[EMAIL] Sent HR notify CL #${id} to ${hr.email}`); })
              .catch(e => console.error('[EMAIL] HR notify error (employeeApprove):', e.message));
          }
        }
      }
    } catch (e) {
      console.error('[CL SERVICE] Failed to notify supervisor/HR after employee approve:', e.message);
    }

    // Log recent action
    if (empRows.length > 0) {
      const { employee_name } = empRows[0];
      await logRecentAction({
        actor_id: approverId,
        module: 'CL',
        action_type: 'CL_APPROVED',
        cl_id: id,
        employee_id: approverId,
        title: `Approved my CL form`,
        description: `CL #${id}`,
        url: `/cl/employee/review/${id}`,
      }).catch(err => console.error('Failed to log recent action:', err));
    }

    return { success: true, message: 'Employee approved CL, moved to HR' };
  } catch (err) {
    await conn.rollback();
    logInfo('Error in employeeApprove', { id, approverId, error: err.message });
    throw err;
  } finally {
    conn.release();
  }
}

// =====================
// EMPLOYEE RETURN
// =====================
async function employeeReturn(id, approverId, remarks) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Insert into EMPLOYEE LOGS (activity history)
    await conn.query(
      `INSERT INTO cl_employee_logs (cl_id, employee_id, action, remarks)
       VALUES (?, ?, 'RETURNED', ?)`,
      [id, approverId, remarks || null]
    );

    // 2) Update the header (latest state)
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'DRAFT',
           awaiting_approval_from = 'PENDING_EMPLOYEE',
           employee_remarks = COALESCE(?, employee_remarks),
           updated_at = NOW()
       WHERE id = ?`,
      [remarks, id]
    );

    await conn.commit();

    // Get employee details for email
    const [clRows] = await conn.query(
      `SELECT ch.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers ch
       JOIN users e ON ch.employee_id = e.id
       WHERE ch.id = ?`,
      [id]
    );

    // Send email notification to employee
    const [empRows] = await conn.query(
      `SELECT name FROM users WHERE id = ?`,
      [approverId]
    );

    if (clRows.length > 0 && empRows.length > 0) {
      const { employee_id, employee_name, employee_code } = clRows[0];
      await sendCLNotificationEmail({
        clId: id,
        employeeId: employee_id,
        actionType: 'RETURNED',
        actorName: empRows[0].name,
        actorRole: 'Employee',
        employeeName: employee_name,
        employeeCode: employee_code,
        remarks: remarks,
        requiresEmployeeAction: false
      }).catch(err => console.error('Failed to send email:', err));
    }

    // Log recent action
    if (clRows.length > 0 && empRows.length > 0) {
      const { employee_name } = clRows[0];
      await logRecentAction({
        actor_id: approverId,
        module: 'CL',
        action_type: 'CL_RETURNED',
        cl_id: id,
        employee_id: approverId,
        title: `Returned my CL form`,
        description: `CL #${id}`,
        url: `/cl/employee/review/${id}`,
      }).catch(err => console.error('Failed to log recent action:', err));
    }

    // Notify supervisor by email and in-app that employee returned the CL
    try {
      const supervisor = await getSupervisorEmail(id);
      const actorNameRow = empRows[0];
      if (supervisor && supervisor.email && clRows.length > 0 && actorNameRow) {
        const supSubject = `Action Required: CL #${id} Returned by Employee`;
        const supHtml = `
          <h3 style="color: #0b61ff;">CL Returned by Employee</h3>
          <p style="color: #0b2b5f;">Hello <strong>${supervisor.name}</strong>,</p>
          <p style="color: #0b2b5f;">Please be informed that CL <strong>#${id}</strong> for <strong>${clRows[0].employee_name} (${clRows[0].employee_code})</strong> has been returned by the employee <strong>${actorNameRow.name}</strong>.</p>
          ${remarks ? `<p style="color: #0b2b5f;"><strong>Employee Remarks:</strong><br/>${remarks.replace(/\n/g, '<br/>')}</p>` : ''}
          <p style="color: #0b2b5f;">Please review and make necessary revisions.</p>
          <hr/>
          <p style="font-size: 12px; color: #0b2b5f;">This is an automated notification from Futura CL System.</p>
        `;

        const supText = `CL #${id} Returned by Employee\n\n` +
          `Hello ${supervisor.name},\n\n` +
          `Please be informed that CL #${id} for ${clRows[0].employee_name} (${clRows[0].employee_code}) has been returned by the employee ${actorNameRow.name}.\n\n` +
          (remarks ? `Employee Remarks: ${remarks}\n\n` : '') +
          `Please review and make necessary revisions.`;

        await sendEmail({ to: supervisor.email, subject: supSubject, text: supText, html: supHtml })
          .then(r => { if (r) console.log(`[EMAIL] Sent employee-return notify CL #${id} to supervisor ${supervisor.email}`); })
          .catch(e => console.error('[EMAIL] Supervisor notify error (employeeReturn):', e.message));

        await createNotification({ recipient_id: supervisor.id, message: `CL #${id} has been returned by the employee ${actorNameRow.name}.`, module: 'CL' })
          .catch(err => console.error('Failed to create supervisor notification after employee return:', err));
      }
    } catch (e) {
      console.error('[CL SERVICE] Failed to notify supervisor after employee return:', e.message);
    }

    return { success: true, message: 'Employee returned CL to Supervisor' };
  } catch (err) {
    await conn.rollback();
    logInfo('Error in employeeReturn', { id, approverId, error: err.message });
    throw err;
  } finally {
    conn.release();
  }
}



// =====================
// HR APPROVAL ACTIONS
// =====================
async function hrApprove(id, approverId, remarks) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Log the HR action
    await conn.query(
      `INSERT INTO cl_hr_logs (cl_id, hr_id, action, remarks)
       VALUES (?, ?, 'APPROVED', ?)`,
      [id, approverId, remarks || null]
    );

    // 2) Update the header (latest state)
    await conn.query(
      `UPDATE cl_headers 
       SET status         = 'APPROVED',
           hr_id          = ?,                     -- who approved
           hr_decision    = 'APPROVED',            -- latest decision
           hr_decided_at  = NOW(),                 -- when
           hr_remarks     = COALESCE(?, hr_remarks),
           updated_at     = NOW()
       WHERE id = ?`,
      [approverId, remarks, id]
    );

    await conn.commit();

    // Get CL and employee details for email
    const [clRows] = await conn.query(
      `SELECT ch.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers ch
       JOIN users e ON ch.employee_id = e.id
       WHERE ch.id = ?`,
      [id]
    );

    const [hrRows] = await conn.query(
      `SELECT name FROM users WHERE id = ?`,
      [approverId]
    );

    // Send email notification to employee
    if (clRows.length > 0 && hrRows.length > 0) {
      const { employee_id, employee_name, employee_code } = clRows[0];
      await sendCLNotificationEmail({
        clId: id,
        employeeId: employee_id,
        actionType: 'APPROVED',
        actorName: hrRows[0].name,
        actorRole: 'HR',
        employeeName: employee_name,
        employeeCode: employee_code,
        remarks: remarks,
        requiresEmployeeAction: false
      }).catch(err => console.error('Failed to send email:', err));

      // Create in-app notification for employee
      await createNotification({
        recipient_id: employee_id,
        message: `CL #${id} has been approved by HR ${hrRows[0].name}! You can now proceed with IDP.`,
        module: 'CL'
      }).catch(err => console.error('Failed to create notification:', err));

      // Also notify supervisor
      const [supRows] = await conn.query(
        `SELECT supervisor_id FROM cl_headers WHERE id = ?`,
        [id]
      );
      if (supRows.length > 0 && supRows[0].supervisor_id) {
        await createNotification({
          recipient_id: supRows[0].supervisor_id,
          message: `CL #${id} for ${employee_name} has been approved by HR.`,
          module: 'CL'
        }).catch(err => console.error('Failed to create notification:', err));
      }
      
      // Log recent action
      await logRecentAction({
        actor_id: approverId,
        module: 'CL',
        action_type: 'CL_APPROVED',
        cl_id: id,
        employee_id: employee_id,
        title: `Approved form for ${employee_name}`,
        description: `CL #${id}`,
        url: `/cl/hr/review/${id}`,
      }).catch(err => console.error('Failed to log recent action:', err));
    }

    return { success: true, message: 'HR approved CL - IDP enabled' };
  } catch (err) {
    await conn.rollback();
    logInfo('Error in hrApprove', { id, approverId, error: err.message });
    throw err;
  } finally {
    conn.release();
  }
}

async function hrReturn(id, approverId, remarks) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Log the HR action
    await conn.query(
      `INSERT INTO cl_hr_logs (cl_id, hr_id, action, remarks)
       VALUES (?, ?, 'RETURNED', ?)`,
      [id, approverId, remarks || null]
    );

    // 2) Update the header (latest state)
    await conn.query(
      `UPDATE cl_headers 
       SET status                 = 'DRAFT',
           awaiting_approval_from = 'PENDING_HR',
           hr_id                  = ?,                     -- who returned
           hr_decision            = 'RETURNED',            -- latest decision
           hr_decided_at          = NOW(),                 -- when
           hr_remarks             = COALESCE(?, hr_remarks),
           updated_at             = NOW()
       WHERE id = ?`,
      [approverId, remarks, id]
    );

    await conn.commit();

    // Get CL and employee details for email
    const [clRows] = await conn.query(
      `SELECT ch.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers ch
       JOIN users e ON ch.employee_id = e.id
       WHERE ch.id = ?`,
      [id]
    );

    const [hrRows] = await conn.query(
      `SELECT name FROM users WHERE id = ?`,
      [approverId]
    );

    // Send email notification to employee
    if (clRows.length > 0 && hrRows.length > 0) {
      const { employee_id, employee_name, employee_code } = clRows[0];
      await sendCLNotificationEmail({
        clId: id,
        employeeId: employee_id,
        actionType: 'RETURNED',
        actorName: hrRows[0].name,
        actorRole: 'HR',
        employeeName: employee_name,
        employeeCode: employee_code,
        remarks: remarks,
        requiresEmployeeAction: false
      }).catch(err => console.error('Failed to send email:', err));
    }

    // Notify supervisor
    const [supRows] = await conn.query(
      `SELECT supervisor_id FROM cl_headers WHERE id = ?`,
      [id]
    );
    if (supRows.length > 0 && supRows[0].supervisor_id && hrRows.length > 0) {
      await createNotification({
        recipient_id: supRows[0].supervisor_id,
        message: `CL #${id} was returned by HR ${hrRows[0].name}. Reason: ${remarks || 'No reason provided'}`,
        module: 'CL'
      }).catch(err => console.error('Failed to create notification:', err));
    }

    // Log recent action
    if (clRows.length > 0 && hrRows.length > 0) {
      const { employee_name } = clRows[0];
      await logRecentAction({
        actor_id: approverId,
        module: 'CL',
        action_type: 'CL_RETURNED',
        cl_id: id,
        employee_id: clRows[0].employee_id,
        title: `Returned form for ${employee_name}`,
        description: `CL #${id}`,
        url: `/cl/hr/review/${id}`,
      }).catch(err => console.error('Failed to log recent action:', err));
    }

    return { success: true, message: 'HR returned CL to Supervisor' };
  } catch (err) {
    await conn.rollback();
    logInfo('Error in hrReturn', { id, approverId, error: err.message });
    throw err;
  } finally {
    conn.release();
  }
}



// =====================
// EMPLOYEE CL HISTORY
// All CLs for a given employee (any status)
// =====================
// =====================
// services/cl.service.js
async function getEmployeeHistory(employeeId) {
  const [rows] = await db.query(
    `
    SELECT
      ch.id,
      ch.cycle_id,
      ch.status,
      ch.created_at,
      COALESCE(ci.total_score, 0) AS total_score,

      -- latest employee action (if any)
      el.action     AS employee_decision,
      el.created_at AS employee_decided_at,
      el.remarks    AS employee_decision_remarks

    FROM cl_headers ch

    -- aggregate cl_items score per CL (no GROUP BY in main query needed)
    LEFT JOIN (
      SELECT
        cl_header_id,
        SUM(score) AS total_score
      FROM cl_items
      GROUP BY cl_header_id
    ) ci ON ci.cl_header_id = ch.id

    -- latest employee log per CL (for this employee)
    LEFT JOIN (
      SELECT x.*
      FROM cl_employee_logs x
      JOIN (
        SELECT cl_id, MAX(created_at) AS max_created_at
        FROM cl_employee_logs
        WHERE employee_id = ?
        GROUP BY cl_id
      ) last
        ON last.cl_id = x.cl_id AND last.max_created_at = x.created_at
      WHERE x.employee_id = ?
    ) el ON el.cl_id = ch.id

    WHERE ch.employee_id = ?
    ORDER BY ch.created_at DESC
    `,
    [employeeId, employeeId, employeeId]
  );

  return rows || [];
}

// =====================
// MANAGER ALL CLs (HISTORY)
// All CLs for employees in this manager's department
// =====================
async function getManagerAllCL(managerId) {
  const [rows] = await db.query(
    `
    SELECT 
      ch.id,
      ch.employee_id,
      ch.supervisor_id,
      e.name AS employee_name,
      e.employee_id AS employee_code,
      d.name AS department_name,
      p.title AS position_title,
      ch.status,

      -- Get only the LATEST log entry for this manager
      ml.action AS manager_decision,
      ml.remarks AS manager_remarks,
      ml.created_at AS manager_decided_at,
      u_mgr.name AS returned_by_name,
      u_mgr.role AS returned_by_role

    FROM cl_headers ch
    JOIN users e ON ch.employee_id = e.id
    JOIN users m ON e.department_id = m.department_id
    JOIN departments d ON e.department_id = d.id
    JOIN positions p ON e.position_id = p.id

    LEFT JOIN cl_manager_logs ml ON ml.cl_id = ch.id 
      AND ml.manager_id = ?
      AND ml.id = (
        SELECT MAX(id) FROM cl_manager_logs 
        WHERE cl_id = ch.id AND manager_id = ?
      )
    LEFT JOIN users u_mgr ON u_mgr.id = ml.manager_id

    WHERE m.id = ?
      AND ml.id IS NOT NULL
    ORDER BY ml.created_at DESC
    `,
    [managerId, managerId, managerId]
  );

  return rows;
}

// =====================
// HR INCOMING - ALL CLs from ALL departments
// Shows all CLs regardless of status for HR visibility
// =====================
async function getHRIncomingCL() {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        ch.id,
        e.name        AS employee_name,
        e.employee_id AS employee_code,
        s.name        AS supervisor_name,
        d.name        AS department_name,
        p.title       AS position_title,
        ch.status,
        ch.created_at AS submitted_at
      FROM cl_headers ch
        JOIN users e       ON ch.employee_id   = e.id
        JOIN users s       ON ch.supervisor_id = s.id
        JOIN departments d ON e.department_id  = d.id
        JOIN positions   p ON e.position_id    = p.id
      ORDER BY d.name ASC, ch.created_at DESC
      `
    );

    return rows || [];
  } catch (err) {
    logInfo('Error getting HR incoming CLs', { error: err.message });
    return [];
  }
}

// =====================
// HR ALL CLs (HISTORY)
// All CLs that this HR has acted on
// =====================
// =====================
// HR ALL CLs (HISTORY / ACTIVITY)
// All actions this HR has taken (APPROVED / RETURNED)
// =====================
async function getHRAllCL(hrId) {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        ch.id,
        e.name        AS employee_name,
        s.name        AS supervisor_name,
        d.name        AS department_name,
        ch.status,                    -- current CL status

        -- activity fields from HR log (aliased to keep FE code simple)
        hl.action      AS hr_decision,
        hl.created_at  AS hr_decided_at,
        hl.remarks     AS hr_decision_remarks

      FROM cl_hr_logs hl
        JOIN cl_headers   ch ON hl.cl_id       = ch.id
        JOIN users        e  ON ch.employee_id = e.id
        JOIN users        s  ON ch.supervisor_id = s.id
        JOIN departments  d  ON ch.department_id = d.id
      WHERE
        hl.hr_id = ?                  -- only actions done by this HR
      ORDER BY hl.created_at DESC
      `,
      [hrId]
    );

    return rows || [];
  } catch (err) {
    logInfo('Error getting HR ALL CLs', { hrId, error: err.message });
    return [];
  }
}

// Find a user by role in same department or by individual assignment
async function findApproverByRole(department_id, role, employee_id = null) {
  // If we have employee_id, try to find individually assigned approver first
  if (employee_id) {
    const [empRows] = await db.query(
      `SELECT manager_id, am_id FROM users WHERE id = ?`,
      [employee_id]
    );
    
    if (empRows.length > 0) {
      const emp = empRows[0];
      
      if (role === 'Manager' && emp.manager_id) {
        const [managerRows] = await db.query(
          `SELECT * FROM users WHERE id = ? AND is_active = 1`,
          [emp.manager_id]
        );
        if (managerRows.length > 0) return managerRows[0];
      }
      
      if (role === 'AM' && emp.am_id) {
        const [amRows] = await db.query(
          `SELECT * FROM users WHERE id = ? AND is_active = 1`,
          [emp.am_id]
        );
        if (amRows.length > 0) return amRows[0];
      }
    }
  }
  
  // Fallback to department-based lookup
  const [rows] = await db.query(
    `SELECT * FROM users WHERE department_id = ? AND role = ? AND is_active = 1 LIMIT 1`,
    [department_id, role]
  );
  
  return rows.length > 0 ? rows[0] : null;
}

async function getRecipientForStatus(clHeader) {
  const { status, department_id, employee_id, supervisor_id } = clHeader;

  if (status === "PENDING_EMPLOYEE") return { recipient_id: employee_id, role: "Employee" };
  if (status === "PENDING_AM") {
    const approver = await findApproverByRole(department_id, "AM", employee_id);
    return { recipient_id: approver?.id, role: "AM" };
  }
  if (status === "PENDING_MANAGER") {
    const approver = await findApproverByRole(department_id, "Manager", employee_id);
    return { recipient_id: approver?.id, role: "Manager" };
  }
  if (status === "PENDING_HR") {
    const approver = await findApproverByRole(department_id, "HR");
    return { recipient_id: approver?.id, role: "HR" };
  }

  return null;
}


// =====================
// GET CL AUDIT TRAIL / HISTORY
// =====================
async function getCLAuditTrail(clId) {
  const [trail] = await db.query(
    `
    SELECT 
      'CREATED' as action_type,
      ch.supervisor_id as actor_id,
      u.name as actor_name,
      u.role as actor_role,
      ch.supervisor_remarks as remarks,
      ch.created_at as timestamp
    FROM cl_headers ch
    JOIN users u ON ch.supervisor_id = u.id
    WHERE ch.id = ?
    
    UNION ALL
    
    SELECT 
      CASE 
        WHEN u.role = 'AM' THEN CONCAT('AM_', ml.action)
        ELSE CONCAT('MANAGER_', ml.action)
      END as action_type,
      ml.manager_id as actor_id,
      u.name as actor_name,
      u.role as actor_role,
      ml.remarks,
      ml.created_at as timestamp
    FROM cl_manager_logs ml
    JOIN users u ON ml.manager_id = u.id
    WHERE ml.cl_id = ?
    
    UNION ALL
    
    SELECT 
      CONCAT('EMPLOYEE_', el.action) as action_type,
      el.employee_id as actor_id,
      u.name as actor_name,
      u.role as actor_role,
      el.remarks,
      el.created_at as timestamp
    FROM cl_employee_logs el
    JOIN users u ON el.employee_id = u.id
    WHERE el.cl_id = ?
    
    UNION ALL
    
    SELECT 
      CONCAT('HR_', hl.action) as action_type,
      hl.hr_id as actor_id,
      u.name as actor_name,
      u.role as actor_role,
      hl.remarks,
      hl.created_at as timestamp
    FROM cl_hr_logs hl
    JOIN users u ON hl.hr_id = u.id
    WHERE hl.cl_id = ?
    
    ORDER BY timestamp ASC
    `,
    [clId, clId, clId, clId]
  );

  return trail;
}

// =====================
// AM DEPARTMENT TRACKING 
// Returns ALL ongoing CLs for employees assigned to this AM for tracking purposes
// =====================
async function getAMDepartmentCL(amId) {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        ch.id,
        ch.employee_id,
        ch.supervisor_id,
        e.name        AS employee_name,
        e.employee_id AS employee_code,
        s.name        AS supervisor_name,
        d.name        AS department_name,
        p.title       AS position_title,
        ch.status,
        ch.awaiting_approval_from,
        ch.created_at,
        ch.updated_at
      FROM cl_headers ch
        JOIN users e       ON ch.employee_id   = e.id
        LEFT JOIN users s  ON ch.supervisor_id = s.id
        JOIN departments d ON e.department_id  = d.id
        JOIN positions   p ON e.position_id    = p.id
      WHERE
        e.am_id = ?
        AND ch.status != 'DRAFT'
      ORDER BY ch.updated_at DESC
      `,
      [amId]
    );

    return rows || [];
  } catch (err) {
    logInfo('Error getting AM department CLs', { amId, error: err.message });
    return [];
  }
}

// =====================
// MANAGER DEPARTMENT TRACKING
// Returns ALL ongoing CLs in the manager's department for tracking purposes
// =====================
async function getManagerDepartmentCL(managerId) {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        ch.id,
        ch.employee_id,
        ch.supervisor_id,
        e.name        AS employee_name,
        e.employee_id AS employee_code,
        s.name        AS supervisor_name,
        d.name        AS department_name,
        p.title       AS position_title,
        ch.status,
        ch.awaiting_approval_from,
        ch.created_at,
        ch.updated_at
      FROM cl_headers ch
        JOIN users e       ON ch.employee_id   = e.id
        LEFT JOIN users s  ON ch.supervisor_id = s.id
        JOIN departments d ON e.department_id  = d.id
        JOIN positions   p ON e.position_id    = p.id
      WHERE
        e.manager_id = ?
        AND ch.status != 'DRAFT'
      ORDER BY ch.updated_at DESC
      `,
      [managerId]
    );

    return rows || [];
  } catch (err) {
    logInfo('Error getting manager department CLs', { managerId, error: err.message });
    return [];
  }
}

// =====================
// CSV EXPORT (for Supervisors - only their employees)
// =====================
async function exportCLForSupervisor({ startDate, endDate, department, status, supervisorId }) {
  console.log('CL Export for Supervisor params:', { startDate, endDate, department, status, supervisorId });
  
  let sql = `
    SELECT 
      ch.id as cl_id,
      ch.status,
      ch.created_at,
      ch.updated_at,
      e.employee_id,
      e.name as employee_name,
      e.email as employee_email,
      d.name as department_name,
      p.title as position_title,
      s.name as supervisor_name,
      m.name as manager_name,
      hr.name as hr_name,
      ch.supervisor_remarks,
      ch.manager_remarks,
      ch.hr_remarks,
      ci.competency_id,
      c.name as competency_name,
      ci.mplr_level,
      ci.assigned_level,
      ci.weight,
      ci.score,
      ci.justification,
      ROUND(
        (SELECT AVG(score) FROM cl_items WHERE cl_header_id = ch.id), 2
      ) as total_score
    FROM cl_headers ch
    JOIN users e ON ch.employee_id = e.id
    LEFT JOIN users s ON ch.supervisor_id = s.id  
    LEFT JOIN users m ON ch.manager_id = m.id
    LEFT JOIN users hr ON ch.hr_id = hr.id
    JOIN departments d ON ch.department_id = d.id
    JOIN positions p ON e.position_id = p.id
    LEFT JOIN cl_items ci ON ch.id = ci.cl_header_id
    LEFT JOIN competencies c ON ci.competency_id = c.id
    WHERE ch.supervisor_id = ?
  `;
  
  const params = [supervisorId];
  
  // Only add date filter if dates are provided
  if (startDate && endDate) {
    sql += ' AND DATE(ch.created_at) >= DATE(?) AND DATE(ch.created_at) <= DATE(?)';
    params.push(startDate, endDate);
  }
  
  if (department && department !== 'ALL') {
    sql += ' AND d.name = ?';
    params.push(department);
  }
  
  if (status && status !== 'ALL') {
    sql += ' AND ch.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY ch.created_at DESC, ch.id, ci.id';
  
  console.log('CL Export for Supervisor SQL:', sql);
  console.log('CL Export for Supervisor params:', params);
  
  const [rows] = await db.query(sql, params);
  
  console.log(`CL Export for Supervisor found ${rows.length} rows`);
  
  // If no data found, return CSV with headers and a note
  if (rows.length === 0) {
    const headers = [
      'Section',
      'CL ID',
      'Status', 
      'Employee ID',
      'Employee Name',
      'Department',
      'Position',
      'Supervisor',
      'Manager',
      'HR Representative',
      'Created Date',
      'Updated Date',
      'Competency Name',
      'Target Level',
      'Assigned Level',
      'Weight',
      'Score',
      'Justification',
      'Total Score',
      'Supervisor Remarks',
      'Manager Remarks',
      'HR Remarks'
    ];
    
    return [
      headers.join(','),
      `"No CL data found for the selected criteria","","","","","","","","","","","","","","","","","","","","",""`,
      `"Search Period: ${startDate || 'N/A'} to ${endDate || 'N/A'}","","","","","","","","","","","","","","","","","","","","",""`
    ].join('\n');
  }
  
  // Group by CL header to organize data properly
  const clMap = new Map();
  
  rows.forEach(row => {
    const clId = row.cl_id;
    
    if (!clMap.has(clId)) {
      clMap.set(clId, {
        header: {
          cl_id: row.cl_id,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          employee_email: row.employee_email,
          department_name: row.department_name,
          position_title: row.position_title,
          supervisor_name: row.supervisor_name,
          manager_name: row.manager_name,
          hr_name: row.hr_name,
          supervisor_remarks: row.supervisor_remarks || '',
          manager_remarks: row.manager_remarks || '',
          hr_remarks: row.hr_remarks || '',
          total_score: row.total_score
        },
        items: []
      });
    }
    
    if (row.competency_id) {
      clMap.get(clId).items.push({
        competency_name: row.competency_name || '',
        mplr_level: row.mplr_level || '',
        assigned_level: row.assigned_level || '',
        weight: row.weight || '',
        score: row.score || '',
        justification: row.justification || ''
      });
    }
  });
  
  const csvRows = [];
  
  // Headers
  csvRows.push([
    'Section',
    'CL ID',
    'Status', 
    'Employee ID',
    'Employee Name',
    'Department',
    'Position',
    'Supervisor',
    'Manager',
    'HR Representative',
    'Created Date',
    'Updated Date',
    'Competency Name',
    'Target Level',
    'Assigned Level',
    'Weight',
    'Score',
    'Justification',
    'Total Score',
    'Supervisor Remarks',
    'Manager Remarks',
    'HR Remarks'
  ].join(','));
  
  clMap.forEach((cl, clId) => {
    const h = cl.header;
    
    if (cl.items.length === 0) {
      // CL with no competency items
      csvRows.push([
        '"Header"',
        `"${h.cl_id}"`,
        `"${h.status}"`,
        `"${h.employee_id}"`,
        `"${h.employee_name}"`,
        `"${h.department_name}"`,
        `"${h.position_title}"`,
        `"${h.supervisor_name || ''}"`,
        `"${h.manager_name || ''}"`,
        `"${h.hr_name || ''}"`,
        `"${h.created_at ? new Date(h.created_at).toLocaleDateString() : ''}"`,
        `"${h.updated_at ? new Date(h.updated_at).toLocaleDateString() : ''}"`,
        `"No competencies"`,
        `""`,
        `""`,
        `""`,
        `""`,
        `""`,
        `"${h.total_score || ''}"`,
        `"${h.supervisor_remarks.replace(/"/g, '""')}"`,
        `"${h.manager_remarks.replace(/"/g, '""')}"`,
        `"${h.hr_remarks.replace(/"/g, '""')}"`
      ].join(','));
    } else {
      // CL with competency items
      cl.items.forEach((item, idx) => {
        csvRows.push([
          idx === 0 ? '"Header"' : '"Item"',
          `"${h.cl_id}"`,
          `"${h.status}"`,
          `"${h.employee_id}"`,
          `"${h.employee_name}"`,
          `"${h.department_name}"`,
          `"${h.position_title}"`,
          `"${h.supervisor_name || ''}"`,
          `"${h.manager_name || ''}"`,
          `"${h.hr_name || ''}"`,
          `"${h.created_at ? new Date(h.created_at).toLocaleDateString() : ''}"`,
          `"${h.updated_at ? new Date(h.updated_at).toLocaleDateString() : ''}"`,
          `"${item.competency_name}"`,
          `"${item.mplr_level}"`,
          `"${item.assigned_level}"`,
          `"${item.weight}"`,
          `"${item.score}"`,
          `"${item.justification.replace(/"/g, '""')}"`,
          idx === 0 ? `"${h.total_score || ''}"` : '""',
          idx === 0 ? `"${h.supervisor_remarks.replace(/"/g, '""')}"` : '""',
          idx === 0 ? `"${h.manager_remarks.replace(/"/g, '""')}"` : '""',
          idx === 0 ? `"${h.hr_remarks.replace(/"/g, '""')}"` : '""'
        ].join(','));
      });
    }
  });
  
  return csvRows.join('\n');
}

// =====================
// CSV EXPORT FOR ASSISTANT MANAGER
// =====================
async function exportCLForAM({ startDate, endDate, department, status, amId }) {
  console.log('CL Export for AM params:', { startDate, endDate, department, status, amId });
  
  let sql = `
    SELECT 
      ch.id as cl_id,
      ch.status,
      ch.created_at,
      ch.updated_at,
      e.employee_id,
      e.name as employee_name,
      p.title as position_title,
      d.name as department_name,
      s.name as supervisor_name,
      am.name as am_name,
      m.name as manager_name,
      ch.remarks,
      ch.supervisor_remarks,
      ch.manager_remarks,
      ch.employee_remarks,
      ch.hr_decision,
      ch.hr_remarks
    FROM cl_headers ch
    JOIN users e ON ch.employee_id = e.id
    LEFT JOIN departments d ON ch.department_id = d.id
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN users s ON ch.supervisor_id = s.id
    LEFT JOIN users am ON e.am_id = am.id
    LEFT JOIN users m ON ch.manager_id = m.id
    WHERE 1 = 1
  `;
  
  const params = [];
  
  // Filter by AM assigned employees
  if (amId) {
    sql += ` AND e.am_id = ?`;
    params.push(amId);
  }
  
  if (startDate) {
    sql += ` AND ch.created_at >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND ch.created_at <= ?`;
    params.push(endDate);
  }
  
  if (department) {
    sql += ` AND d.name = ?`;
    params.push(department);
  }
  
  if (status && status !== 'ALL') {
    sql += ` AND ch.status = ?`;
    params.push(status);
  }
  
  sql += ` ORDER BY ch.created_at DESC`;
  
  const [rows] = await db.query(sql, params);
  console.log(`Found ${rows.length} CL records for AM export`);

  // If no CL rows were found, check whether this AM actually has any assigned employees.
  if (rows.length === 0) {
    try {
      const [empRows] = await db.query(`SELECT COUNT(*) as cnt FROM users WHERE am_id = ?`, [amId]);
      const count = (empRows && empRows[0] && empRows[0].cnt) ? empRows[0].cnt : 0;
      if (count === 0) {
        // No employees assigned to this AM — return CSV explaining the situation
        const headers = ['Message'];
        const csv = [headers.join(','), `"No employees are assigned to Assistant Manager ID ${amId}. Please assign employees to this AM before exporting."`].join('\n');
        return csv;
      }
    } catch (e) {
      // ignore and fall through to generic message
      console.error('Error checking employees for AM', e.message);
    }

    // At this point there are employees assigned to the AM, but no CL rows matched.
    // Try a fallback: export CLs by the AM's department (matches what AM dashboard shows).
    try {
      const [deptRows] = await db.query(`SELECT department_id FROM users WHERE id = ? LIMIT 1`, [amId]);
      const amDept = deptRows && deptRows[0] ? deptRows[0].department_id : null;
      if (amDept) {
        console.log('AM export fallback: searching CLs by department', { amId, amDept });
        let fallbackSql = `
          SELECT 
            ch.id as cl_id,
            ch.status,
            ch.created_at,
            ch.updated_at,
            e.employee_id,
            e.name as employee_name,
            p.title as position_title,
            d.name as department_name,
            s.name as supervisor_name,
            am.name as am_name,
            m.name as manager_name,
            ch.remarks,
            ch.supervisor_remarks,
            ch.manager_remarks,
            ch.employee_remarks,
            ch.hr_decision,
            ch.hr_remarks
          FROM cl_headers ch
          JOIN users e ON ch.employee_id = e.id
          LEFT JOIN departments d ON ch.department_id = d.id
          LEFT JOIN positions p ON e.position_id = p.id
          LEFT JOIN users s ON ch.supervisor_id = s.id
          LEFT JOIN users am ON e.am_id = am.id
          LEFT JOIN users m ON ch.manager_id = m.id
          WHERE e.department_id = ?
        `;

        const fallbackParams = [amDept];

        if (startDate) {
          fallbackSql += ` AND DATE(ch.created_at) >= DATE(?)`;
          fallbackParams.push(startDate);
        }
        if (endDate) {
          fallbackSql += ` AND DATE(ch.created_at) <= DATE(?)`;
          fallbackParams.push(endDate);
        }
        if (department) {
          fallbackSql += ` AND d.name = ?`;
          fallbackParams.push(department);
        }
        if (status && status !== 'ALL') {
          fallbackSql += ` AND ch.status = ?`;
          fallbackParams.push(status);
        }

        fallbackSql += ` ORDER BY ch.created_at DESC`;
        const [fallbackRows] = await db.query(fallbackSql, fallbackParams);
        console.log(`Found ${fallbackRows.length} CL records for AM export using department fallback`);
        if (fallbackRows.length === 0) {
          return 'No data found for the specified criteria';
        }

        // Build a simple CSV for fallbackRows (reuse AM headers)
        const headers = [
          'CL ID', 'Employee ID', 'Employee Name', 'Position', 'Department',
          'Supervisor', 'Assistant Manager', 'Manager', 'Status', 'General Remarks',
          'Supervisor Remarks', 'Manager Remarks', 'Employee Remarks',
          'HR Decision', 'HR Remarks', 'Created At', 'Updated At'
        ];
        const csvRows = [headers.join(',')];
        fallbackRows.forEach(row => {
          const csvRow = [
            row.cl_id || '',
            row.employee_id || '',
            `"${(row.employee_name || '').replace(/"/g, '""')}"`,
            `"${(row.position_title || '').replace(/"/g, '""')}"`,
            `"${(row.department_name || '').replace(/"/g, '""')}"`,
            `"${(row.supervisor_name || '').replace(/"/g, '""')}"`,
            `"${(row.am_name || '').replace(/"/g, '""')}"`,
            `"${(row.manager_name || '').replace(/"/g, '""')}"`,
            row.status || '',
            `"${(row.remarks || '').replace(/"/g, '""')}"`,
            `"${(row.supervisor_remarks || '').replace(/"/g, '""')}"`,
            `"${(row.manager_remarks || '').replace(/"/g, '""')}"`,
            `"${(row.employee_remarks || '').replace(/"/g, '""')}"`,
            row.hr_decision || '',
            `"${(row.hr_remarks || '').replace(/"/g, '""')}"`,
            row.created_at ? new Date(row.created_at).toISOString() : '',
            row.updated_at ? new Date(row.updated_at).toISOString() : ''
          ];
          csvRows.push(csvRow.join(','));
        });

        return csvRows.join('\n');
      }
    } catch (e) {
      console.error('AM export department fallback failed', e.message);
    }

    return 'No data found for the specified criteria';
  }

  // Generate CSV
  const headers = [
    'CL ID', 'Employee ID', 'Employee Name', 'Position', 'Department',
    'Supervisor', 'Assistant Manager', 'Manager', 'Status', 'General Remarks',
    'Supervisor Remarks', 'Manager Remarks', 'Employee Remarks',
    'HR Decision', 'HR Remarks', 'Created At', 'Updated At'
  ];

  const csvRows = [headers.join(',')];

  rows.forEach(row => {
    const csvRow = [
      row.cl_id || '',
      row.employee_id || '',
      `"${(row.employee_name || '').replace(/"/g, '""')}"`,
      `"${(row.position_title || '').replace(/"/g, '""')}"`,
      `"${(row.department_name || '').replace(/"/g, '""')}"`,
      `"${(row.supervisor_name || '').replace(/"/g, '""')}"`,
      `"${(row.am_name || '').replace(/"/g, '""')}"`,
      `"${(row.manager_name || '').replace(/"/g, '""')}"`,
      row.status || '',
      `"${(row.remarks || '').replace(/"/g, '""')}"`,
      `"${(row.supervisor_remarks || '').replace(/"/g, '""')}"`,
      `"${(row.manager_remarks || '').replace(/"/g, '""')}"`,
      `"${(row.employee_remarks || '').replace(/"/g, '""')}"`,
      row.hr_decision || '',
      `"${(row.hr_remarks || '').replace(/"/g, '""')}"`,
      row.created_at ? new Date(row.created_at).toISOString() : '',
      row.updated_at ? new Date(row.updated_at).toISOString() : ''
    ];
    csvRows.push(csvRow.join(','));
  });

  return csvRows.join('\n');
}

// =====================
// CSV EXPORT FOR MANAGER
// =====================
async function exportCLForManager({ startDate, endDate, department, status, managerId }) {
  console.log('CL Export for Manager params:', { startDate, endDate, department, status, managerId });
  
  let sql = `
    SELECT 
      ch.id as cl_id,
      ch.status,
      ch.created_at,
      ch.updated_at,
      e.employee_id,
      e.name as employee_name,
      p.title as position_title,
      d.name as department_name,
      s.name as supervisor_name,
      am.name as am_name,
      m.name as manager_name,
      ch.remarks,
      ch.supervisor_remarks,
      ch.manager_remarks,
      ch.employee_remarks,
      ch.hr_decision,
      ch.hr_remarks
    FROM cl_headers ch
    JOIN users e ON ch.employee_id = e.id
    LEFT JOIN departments d ON ch.department_id = d.id
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN users s ON ch.supervisor_id = s.id
    LEFT JOIN users am ON e.am_id = am.id
    LEFT JOIN users m ON ch.manager_id = m.id
    WHERE 1 = 1
  `;
  
  const params = [];
  
  // Filter by Manager: include CLs where the CL was assigned to this manager,
  // or the employee's manager is this manager, or the department's manager is this manager.
  if (managerId) {
    sql += ` AND (ch.manager_id = ? OR e.manager_id = ? OR d.manager_id = ?)`;
    params.push(managerId, managerId, managerId);
  }

  if (startDate) {
    sql += ` AND DATE(ch.created_at) >= DATE(?)`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND DATE(ch.created_at) <= DATE(?)`;
    params.push(endDate);
  }
  
  if (department) {
    sql += ` AND d.name = ?`;
    params.push(department);
  }
  
  if (status && status !== 'ALL') {
    sql += ` AND ch.status = ?`;
    params.push(status);
  }
  
  sql += ` ORDER BY ch.created_at DESC`;
  
  const [rows] = await db.query(sql, params);
  console.log(`Found ${rows.length} CL records for Manager export`);

  if (rows.length === 0) {
    return 'No data found for the specified criteria';
  }

  // Generate CSV
  const headers = [
    'CL ID', 'Employee ID', 'Employee Name', 'Position', 'Department',
    'Supervisor', 'Assistant Manager', 'Manager', 'Status', 'General Remarks',
    'Supervisor Remarks', 'Manager Remarks', 'Employee Remarks',
    'HR Decision', 'HR Remarks', 'Created At', 'Updated At'
  ];

  const csvRows = [headers.join(',')];

  rows.forEach(row => {
    const csvRow = [
      row.cl_id || '',
      row.employee_id || '',
      `"${(row.employee_name || '').replace(/"/g, '""')}"`,
      `"${(row.position_title || '').replace(/"/g, '""')}"`,
      `"${(row.department_name || '').replace(/"/g, '""')}"`,
      `"${(row.supervisor_name || '').replace(/"/g, '""')}"`,
      `"${(row.am_name || '').replace(/"/g, '""')}"`,
      `"${(row.manager_name || '').replace(/"/g, '""')}"`,
      row.status || '',
      `"${(row.remarks || '').replace(/"/g, '""')}"`,
      `"${(row.supervisor_remarks || '').replace(/"/g, '""')}"`,
      `"${(row.manager_remarks || '').replace(/"/g, '""')}"`,
      `"${(row.employee_remarks || '').replace(/"/g, '""')}"`,
      row.hr_decision || '',
      `"${(row.hr_remarks || '').replace(/"/g, '""')}"`,
      row.created_at ? new Date(row.created_at).toISOString() : '',
      row.updated_at ? new Date(row.updated_at).toISOString() : ''
    ];
    csvRows.push(csvRow.join(','));
  });

  return csvRows.join('\n');
}

// =====================
// CSV EXPORT (for HR - all data)
// =====================
async function exportCL({ startDate, endDate, department, status }) {
  console.log('CL Export params:', { startDate, endDate, department, status });
  
  let sql = `
    SELECT 
      ch.id as cl_id,
      ch.status,
      ch.created_at,
      ch.updated_at,
      e.employee_id,
      e.name as employee_name,
      e.email as employee_email,
      d.name as department_name,
      p.title as position_title,
      s.name as supervisor_name,
      m.name as manager_name,
      hr.name as hr_name,
      ch.supervisor_remarks,
      ch.manager_remarks,
      ch.hr_remarks,
      ci.competency_id,
      c.name as competency_name,
      ci.mplr_level,
      ci.assigned_level,
      ci.weight,
      ci.score,
      ci.justification,
      ROUND(
        (SELECT AVG(score) FROM cl_items WHERE cl_header_id = ch.id), 2
      ) as total_score
    FROM cl_headers ch
    JOIN users e ON ch.employee_id = e.id
    LEFT JOIN users s ON ch.supervisor_id = s.id  
    LEFT JOIN users m ON ch.manager_id = m.id
    LEFT JOIN users hr ON ch.hr_id = hr.id
    JOIN departments d ON ch.department_id = d.id
    JOIN positions p ON e.position_id = p.id
    LEFT JOIN cl_items ci ON ch.id = ci.cl_header_id
    LEFT JOIN competencies c ON ci.competency_id = c.id
    WHERE 1=1
  `;
  
  const params = [];
  
  // Only add date filter if dates are provided
  if (startDate && endDate) {
    sql += ' AND DATE(ch.created_at) >= DATE(?) AND DATE(ch.created_at) <= DATE(?)';
    params.push(startDate, endDate);
  }
  
  if (department && department !== 'ALL') {
    sql += ' AND d.name = ?';
    params.push(department);
  }
  
  if (status && status !== 'ALL') {
    sql += ' AND ch.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY ch.created_at DESC, ch.id, ci.id';
  
  console.log('CL Export SQL:', sql);
  console.log('CL Export params:', params);
  
  const [rows] = await db.query(sql, params);
  
  console.log(`CL Export found ${rows.length} rows`);
  
  // If no data found, return CSV with headers and a note
  if (rows.length === 0) {
    const headers = [
      'Section',
      'CL ID',
      'Status', 
      'Employee ID',
      'Employee Name',
      'Department',
      'Position',
      'Supervisor',
      'Manager',
      'Competency Name',
      'MPLR Level',
      'Assigned Level',
      'Weight (%)',
      'Score',
      'Total Score',
      'Justification',
      'Remarks',
      'Created Date'
    ];
    
    let csv = headers.join(',') + '\n';
    csv += `"No CL records found for the specified criteria",${','.repeat(headers.length - 1)}\n`;
    return csv;
  }
  
  // Convert to organized CSV structure
  const clMap = new Map();
  
  // Group rows by CL ID
  for (const row of rows) {
    if (!clMap.has(row.cl_id)) {
      clMap.set(row.cl_id, {
        header: {
          cl_id: row.cl_id,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          employee_email: row.employee_email,
          department_name: row.department_name,
          position_title: row.position_title,
          supervisor_name: row.supervisor_name,
          manager_name: row.manager_name,
          hr_name: row.hr_name,
          supervisor_remarks: row.supervisor_remarks,
          manager_remarks: row.manager_remarks,
          hr_remarks: row.hr_remarks,
          total_score: row.total_score
        },
        competencies: []
      });
    }
    
    if (row.competency_id) {
      clMap.get(row.cl_id).competencies.push({
        competency_id: row.competency_id,
        competency_name: row.competency_name,
        mplr_level: row.mplr_level,
        assigned_level: row.assigned_level,
        weight: row.weight,
        score: row.score,
        justification: row.justification
      });
    }
  }

  // Generate table-structured CSV
  const csvRows = [];
  
  const headers = [
    'Section',
    'CL ID',
    'Status', 
    'Employee ID',
    'Employee Name',
    'Department',
    'Position',
    'Supervisor',
    'Manager',
    'Competency Name',
    'MPLR Level',
    'Assigned Level',
    'Weight (%)',
    'Score',
    'Total Score',
    'Justification',
    'Remarks',
    'Created Date'
  ];
  
  csvRows.push(headers);
  
  for (const [clId, clData] of clMap.entries()) {
    const header = clData.header;
    
    // CL SUMMARY row
    csvRows.push([
      'CL SUMMARY',
      header.cl_id,
      header.status,
      header.employee_id,
      header.employee_name,
      header.department_name,
      header.position_title,
      header.supervisor_name,
      header.manager_name,
      `${clData.competencies.length} Competencies`,
      '',
      '',
      '',
      '',
      header.total_score,
      '',
      [header.supervisor_remarks, header.manager_remarks, header.hr_remarks].filter(Boolean).join(' | '),
      header.created_at ? new Date(header.created_at).toISOString().split('T')[0] : ''
    ]);

    // COMPETENCY rows
    for (let i = 0; i < clData.competencies.length; i++) {
      const comp = clData.competencies[i];
      
      csvRows.push([
        `COMPETENCY ${i + 1}`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        comp.competency_name,
        comp.mplr_level,
        comp.assigned_level,
        comp.weight,
        comp.score,
        '',
        comp.justification,
        '',
        ''
      ]);
    }

    // Empty separator row between CLs
    csvRows.push(Array(headers.length).fill(''));
  }
  
  // Convert to CSV string with proper escaping
  return csvRows.map(row => 
    row.map(field => {
      const value = String(field || '');
      // Escape quotes and wrap in quotes if contains commas, quotes, or newlines
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  ).join('\n');
}

module.exports = {
  getById,
  create,
  update,
  submit,
  getSupervisorSummary,
  getEmployeeHistory,
  getSupervisorAllCL,
  getSupervisorPending,
  getManagerAllCL,
  getManagerSummary,
  getManagerPending,
  getManagerDepartmentCL,
  getAMDepartmentCL,
  getEmployeePending,
  getAMSummary,
  getAMPending,
  getRecipientForStatus,
  getHRSummary,
  getHRPending,
  getHRIncomingCL,
  getCompetenciesForEmployee,
  generateCLPDF,
  managerApprove,
  getHRAllCL,
  managerReturn,
  amApprove,
  amReturn,
  employeeApprove,
  employeeReturn,
  hrApprove,
  hrReturn,
  getCLAuditTrail,
  exportCL,
  exportCLForSupervisor,
  exportCLForAM,
  exportCLForManager
};
