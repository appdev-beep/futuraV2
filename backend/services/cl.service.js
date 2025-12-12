// src/services/cl.service.js
const { db } = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { logInfo } = require('../utils/logger');
const { logRecentAction } = require('./recentActions.service');


// =====================
// GET CL BY ID
// =====================
async function getById(id) {
  const [headerRows] = await db.query(
    `SELECT 
       ch.*,
       e.name as employee_name,
       e.employee_id,
       d.name as department_name,
       p.title as position_title
     FROM cl_headers ch
     JOIN users e ON ch.employee_id = e.id
     JOIN departments d ON ch.department_id = d.id
     JOIN positions p ON e.position_id = p.id
     WHERE ch.id = ?`,
    [id]
  );

  if (!headerRows.length) return null;

  const header = headerRows[0];

  const [items] = await db.query(
    `SELECT 
        ci.*,
        c.name AS competency_name,
        c.description AS competency_description
     FROM cl_items ci
     JOIN competencies c ON ci.competency_id = c.id
     WHERE ci.cl_header_id = ?`,
    [id]
  );

  // Recalculate score for each item before returning
  return {
    id: header.id,
    status: header.status,

    // 👇 ADD THIS (and any other remarks you want exposed)
    supervisor_remarks: header.supervisor_remarks,
    am_remarks: header.am_remarks,
    manager_remarks: header.manager_remarks,
    employee_remarks: header.employee_remarks,
    hr_remarks: header.hr_remarks,

    employee_name: header.employee_name,
    employee_id: header.employee_id,
    department_name: header.department_name,
    position_title: header.position_title,
    cycle_id: header.cycle_id,
    created_at: header.created_at,
    pdf_path: items.length > 0 ? items[0].pdf_path : null,
    items: items.map(item => {
      const score = (Number(item.weight) / 100) * Number(item.assigned_level);
      return {
        id: item.id,
        competency_id: item.competency_id,
        competency_name: item.competency_name,
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
    })
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
    const [empRows] = await conn.query(
      `SELECT position_id FROM users WHERE id = ?`,
      [payload.employee_id]
    );

    if (!empRows.length) throw new Error('Employee not found');

    const positionId = empRows[0].position_id;

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
        await conn.query(
          `UPDATE cl_items
             SET assigned_level = ?,
                 weight         = ?,
                 justification  = ?,
                 score          = (weight / 100.0) * assigned_level,
                 pdf_path       = COALESCE(?, pdf_path),
                 updated_at     = NOW()
           WHERE id = ? AND cl_header_id = ?`,
          [
            item.assigned_level,
            item.weight,
            item.justification || '',
            item.pdf_path || null,  // 👈 will overwrite only if a new path is provided
            item.id,
            id
          ]
        );
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
        d.has_am
     FROM cl_headers ch
     JOIN departments d ON d.id = ch.department_id
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

  // 2) Determine next status
  let nextStatus;

  if (clHeader.awaiting_approval_from) {
    nextStatus = clHeader.awaiting_approval_from;
  } else {
    const hasAM = !!clHeader.has_am;
    nextStatus = hasAM ? 'PENDING_AM' : 'PENDING_MANAGER';
  }

  // 3) Generate PDF
  const pdfPath = await generateCLPDF(id, clHeader);

  // 4) Decide what to store in supervisor_remarks
  let newSupervisorRemarks = clHeader.supervisor_remarks;

  if (
    (!newSupervisorRemarks || newSupervisorRemarks.trim() === '') &&
    supervisorRemarks &&
    supervisorRemarks.trim() !== ''
  ) {
    newSupervisorRemarks = supervisorRemarks;
  }

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

    await conn.query(
      `UPDATE cl_items 
          SET pdf_path = ?, 
              updated_at = NOW() 
        WHERE cl_header_id = ?`,
      [pdfPath, id]
    );

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

  // 7) Return latest CL data
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
      JOIN users s ON ch.supervisor_id = s.id
    WHERE
      s.id = ?
      AND e.department_id = s.department_id
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
        ch.created_at AS submitted_at
      FROM cl_headers ch
        JOIN users e       ON ch.employee_id   = e.id
        JOIN users s       ON ch.supervisor_id = s.id
        JOIN departments d ON e.department_id  = d.id
        JOIN positions   p ON e.position_id    = p.id
      WHERE
        s.id = ?
        AND e.department_id = s.department_id
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
      JOIN users s       ON ch.supervisor_id = s.id
      JOIN departments d ON e.department_id  = d.id
      JOIN positions   p ON e.position_id    = p.id
    WHERE
      s.id = ?
      AND e.department_id = s.department_id
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
      SUM(ch.status = 'APPROVED')        AS clApproved
    FROM cl_headers ch
      JOIN users e ON ch.employee_id = e.id
      JOIN users m ON e.department_id = m.department_id
    WHERE
      m.id = ?
    `,
    [managerId]
  );

  return rows[0] || { clPending: 0, clInProgress: 0, clApproved: 0 };
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
      e.name        AS employee_name,
      e.employee_id AS employee_code,
      d.name        AS department_name,
      p.title       AS position_title,
      ch.status,
      ch.created_at AS submitted_at
    FROM cl_headers ch
      JOIN users e       ON ch.employee_id  = e.id
      JOIN users m       ON e.department_id = m.department_id
      JOIN departments d ON e.department_id = d.id
      JOIN positions   p ON e.position_id   = p.id
    WHERE
      m.id = ?
      AND ch.status IN ('PENDING_MANAGER', 'MANAGER_REVIEW')
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
        u.position_id,
        u.department_id,
        p.title AS position_title,
        d.name  AS department_name
     FROM users u
     JOIN positions   p ON u.position_id   = p.id
     JOIN departments d ON u.department_id = d.id
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

    // Move CL to next stage
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'PENDING_EMPLOYEE',
           updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await conn.commit();
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

    // Move CL back to supervisor
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'DRAFT',
           awaiting_approval_from = 'PENDING_MANAGER',
           updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await conn.commit();
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
       SUM(ch.status = 'REJECTED') as clReturned
     FROM cl_headers ch
     JOIN departments d ON ch.department_id = d.id
     WHERE d.has_am = 1`,
    []
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
         s.name as supervisor_name,
         d.name as department_name,
         ch.status,
         ch.created_at
       FROM cl_headers ch
       JOIN users u ON ch.employee_id = u.id
       JOIN users s ON ch.supervisor_id = s.id
       JOIN departments d ON ch.department_id = d.id
       WHERE ch.status = 'PENDING_AM' AND d.has_am = 1
       ORDER BY ch.created_at DESC`,
      []
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
async function getHRSummary(hrId) {
  const [rows] = await db.query(
    `SELECT
       SUM(ch.status = 'PENDING_HR') as clPending,
       SUM(ch.status = 'APPROVED') as clApproved,
       SUM(ch.status = 'REJECTED') as clReturned
     FROM cl_headers ch`,
    []
  );

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

    // Update CL status to PENDING_EMPLOYEE
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'PENDING_EMPLOYEE', updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await conn.commit();
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

    // Update CL status back to DRAFT and mark where it should go on resubmit
    await conn.query(
      `UPDATE cl_headers 
       SET status = 'DRAFT', awaiting_approval_from = 'PENDING_AM', updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await conn.commit();
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
      e.name AS employee_name,
      e.employee_id AS employee_code,
      d.name AS department_name,
      p.title AS position_title,

      -- log fields
      ml.action AS manager_decision,
      ml.remarks AS manager_remarks,
      ml.created_at AS manager_decided_at

    FROM cl_headers ch
    JOIN users e ON ch.employee_id = e.id
    JOIN users m ON e.department_id = m.department_id
    JOIN departments d ON e.department_id = d.id
    JOIN positions p ON e.position_id = p.id

    LEFT JOIN cl_manager_logs ml ON ml.cl_id = ch.id AND ml.manager_id = ?

    WHERE m.id = ?
    ORDER BY ml.created_at DESC
    `,
    [managerId, managerId]
  );

  return rows;
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

// Find a user by role in same department (simple approach)
async function findApproverByRole(department_id, role) {
  // adjust query to your DB layer
  return db.users.findFirst({
    where: { department_id, role, is_active: true },
  });
}

async function getRecipientForStatus(clHeader) {
  const { status, department_id, employee_id, supervisor_id } = clHeader;

  if (status === "PENDING_EMPLOYEE") return { recipient_id: employee_id, role: "Employee" };
  if (status === "PENDING_AM") return { recipient_id: (await findApproverByRole(department_id, "AM"))?.id, role: "AM" };
  if (status === "PENDING_MANAGER") return { recipient_id: (await findApproverByRole(department_id, "Manager"))?.id, role: "Manager" };
  if (status === "PENDING_HR") return { recipient_id: (await findApproverByRole(department_id, "HR"))?.id, role: "HR" };

  return null;
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
  getEmployeePending,
  getAMSummary,
  getAMPending,
  getRecipientForStatus,
  getHRSummary,
  getHRPending,
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
  hrReturn
};
