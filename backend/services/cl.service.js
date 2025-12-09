// src/services/cl.service.js
const { db } = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { logInfo } = require('../utils/logger');

// =====================
// GET CL BY ID
// =====================
async function getById(id) {
  const [headerRows] = await db.query(
    `SELECT * FROM cl_headers WHERE id = ?`,
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

  return { header, items };
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
// Decide next status based on department.has_am
// Generate PDF for submission
// =====================
async function submit(id) {
  // 1) Find the CL and department
  const [rows] = await db.query(
    `SELECT 
        ch.id,
        ch.employee_id,
        ch.supervisor_id,
        ch.department_id,
        ch.cycle_id,
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
  const hasAM = !!clHeader.has_am;
  const nextStatus = hasAM ? 'PENDING_AM' : 'PENDING_MANAGER';

  // 2) Generate PDF
  const pdfPath = await generateCLPDF(id, clHeader);

  // 3) Update header status and pdf_path for all items
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Update header status
    await conn.query(
      `UPDATE cl_headers SET status = ?, updated_at = NOW() WHERE id = ?`,
      [nextStatus, id]
    );

    // Update all items in this CL with the PDF path
    await conn.query(
      `UPDATE cl_items SET pdf_path = ?, updated_at = NOW() WHERE cl_header_id = ?`,
      [pdfPath, id]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // 4) Return latest CL data
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
      SUM(ch.status = 'DRAFT')       AS clPending,
      SUM(ch.status = 'IN_PROGRESS') AS clInProgress,
      SUM(ch.status = 'APPROVED')    AS clApproved
    FROM cl_headers ch
      JOIN users e ON ch.employee_id   = e.id
      JOIN users s ON ch.supervisor_id = s.id
    WHERE
      s.id = ?
      AND e.department_id = s.department_id
    `,
    [supervisorId]
  );

  // Fallback to zeroes if no rows
  return rows[0] || { clPending: 0, clInProgress: 0, clApproved: 0 };
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
async function managerApprove(id) {
  // Example: set final status to APPROVED
  await db.query(
    `UPDATE cl_headers
       SET status = 'APPROVED',
           updated_at = NOW()
     WHERE id = ?`,
    [id]
  );

  // return updated CL
  return await getById(id);
}

// =====================
// MANAGER RETURN CL TO SUPERVISOR
// =====================
async function managerReturn(id) {
  // You can decide the status name; here we use RETURNED_TO_SUPERVISOR
  await db.query(
    `UPDATE cl_headers
       SET status = 'RETURNED_TO_SUPERVISOR',
           updated_at = NOW()
     WHERE id = ?`,
    [id]
  );

  return await getById(id);
}

module.exports = {
  getById,
  create,
  update,
  submit,
  getSupervisorSummary,
  getSupervisorPending,
   managerApprove,       // 👈 add
  managerReturn,        // 👈 add
  getManagerSummary,
  getManagerPending,
  getCompetenciesForEmployee
};
