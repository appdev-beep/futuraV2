// src/services/idp.service.js
const { db } = require('../config/db');
const { logInfo } = require('../utils/logger');

// Return IDP header + items
async function getById(id) {
  const [headers] = await db.query(
    'SELECT * FROM idp_headers WHERE id = ?',
    [id]
  );
  if (headers.length === 0) return null;

  const header = headers[0];

  const [items] = await db.query(
    `SELECT ii.*, c.name AS competency_name
     FROM idp_items ii
     JOIN competencies c ON ii.competency_id = c.id
     WHERE ii.idp_header_id = ?`,
    [id]
  );

  return { header, items };
}

// Create IDP header
async function create(payload) {
  const [result] = await db.query(
    `INSERT INTO idp_headers
      (cl_header_id, employee_id, supervisor_id, cycle_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'DRAFT', NOW(), NOW())`,
    [
      payload.cl_header_id,
      payload.employee_id,
      payload.supervisor_id,
      payload.cycle_id
    ]
  );

  const idpId = result.insertId;
  logInfo('Created IDP header', { idpId });
  return { id: idpId };
}

// Update or insert IDP items
async function update(id, payload) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (Array.isArray(payload.items)) {
      for (const item of payload.items) {
        if (item.id) {
          // Update existing item
          await conn.query(
            `UPDATE idp_items
             SET development_activity = ?, development_type = ?, start_date = ?, end_date = ?, updated_at = NOW()
             WHERE id = ? AND idp_header_id = ?`,
            [
              item.development_activity,
              item.development_type,
              item.start_date || null,
              item.end_date || null,
              item.id,
              id
            ]
          );
        } else {
          // Insert new item
          await conn.query(
            `INSERT INTO idp_items
              (idp_header_id, competency_id, current_level, target_level, development_activity, development_type, start_date, end_date, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', NOW(), NOW())`,
            [
              id,
              item.competency_id,
              item.current_level,
              item.target_level,
              item.development_activity,
              item.development_type,
              item.start_date || null,
              item.end_date || null
            ]
          );
        }
      }
    }

    await conn.query(
      `UPDATE idp_headers
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

// Submit IDP (simple: mark as PENDING_AM)
async function submit(id) {
  await db.query(
    `UPDATE idp_headers
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
