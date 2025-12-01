// src/services/cl.service.js
const { db } = require('../config/db');
const { logInfo } = require('../utils/logger');


// Return CL header + items
async function getById(id) {
  const [headers] = await db.query(
    'SELECT * FROM cl_headers WHERE id = ?',
    [id]
  );
  if (headers.length === 0) return null;

  const header = headers[0];

  const [items] = await db.query(
    `SELECT ci.*, c.name AS competency_name
     FROM cl_items ci
     JOIN competencies c ON ci.competency_id = c.id
     WHERE ci.cl_header_id = ?`,
    [id]
  );

  return { header, items };
}

// Create CL header and preload competencies based on employee position
async function create(payload) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO cl_headers
        (employee_id, supervisor_id, department_id, cycle_id, status, has_assistant_manager, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'DRAFT', 0, NOW(), NOW())`,
      [
        payload.employee_id,
        payload.supervisor_id,
        payload.department_id,
        payload.cycle_id
      ]
    );

    const clId = result.insertId;

    // Get employee position
    const [empRows] = await conn.query(
      `SELECT position_id
       FROM users
       WHERE id = ?`,
      [payload.employee_id]
    );

    if (empRows.length > 0) {
      const positionId = empRows[0].position_id;

      // Get all competencies mapped to that position
      const [posComps] = await conn.query(
        `SELECT pc.competency_id, pc.required_level
         FROM position_competencies pc
         WHERE pc.position_id = ?`,
        [positionId]
      );

      // Insert one CL item per competency (weight 0, justification empty)
      for (const row of posComps) {
        await conn.query(
          `INSERT INTO cl_items
            (cl_header_id, competency_id, mplr_level, assigned_level, weight, justification, score, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, '', 0, NOW(), NOW())`,
          [clId, row.competency_id, row.required_level, row.required_level]
        );
      }
    }

    await conn.commit();
    logInfo('Created CL header', { clId });
    return { id: clId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Update item levels/weights/justification and recompute scores
async function update(id, payload) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (Array.isArray(payload.items)) {
      for (const item of payload.items) {
        await conn.query(
          `UPDATE cl_items
           SET assigned_level = ?, weight = ?, justification = ?, score = (weight / 100.0) * assigned_level, updated_at = NOW()
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

    await conn.query(
      `UPDATE cl_headers
       SET updated_at = NOW()
       WHERE id = ?`,
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

// Submit CL for approval (simple: mark as PENDING_AM)
async function submit(id) {
  await db.query(
    `UPDATE cl_headers
     SET status = 'PENDING_AM', updated_at = NOW()
     WHERE id = ?`,
    [id]
  );

  return await getById(id);
}

module.exports = {
  getById,
  create,
  update,
  submit
};
