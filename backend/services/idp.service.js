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

// =====================================
// SUPERVISOR DASHBOARD
// =====================================

// Get employees whose CL was approved by HR but have no IDP
async function getEmployeesForIDPCreation(supervisorId) {
  const [employees] = await db.query(
    `SELECT 
      u.id AS employee_id,
      u.name,
      p.title AS position,
      cl.id AS cl_id,
      cl.status AS cl_status,
      cl.updated_at AS cl_approved_date
    FROM cl_headers cl
    JOIN users u ON cl.employee_id = u.id
    JOIN positions p ON u.position_id = p.id
    LEFT JOIN idp_headers idp ON idp.cl_header_id = cl.id
    WHERE cl.supervisor_id = ?
      AND cl.status = 'APPROVED'
      AND idp.id IS NULL
    ORDER BY cl.updated_at DESC`,
    [supervisorId]
  );

  return employees.map(emp => ({
    employee_id: emp.employee_id,
    name: emp.name,
    position: emp.position,
    cl_id: emp.cl_id,
    cl_approved_date: emp.cl_approved_date
  }));
}

module.exports = {
  getById,
  create,
  createWithItems,
  update,
  submit,
  getEmployeesForIDPCreation
};

// Create IDP with full development plan
async function createWithItems(payload) {
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Get the active cycle or create with cycle 1
    const [cycleRows] = await conn.query('SELECT id FROM cycles WHERE is_active = 1 LIMIT 1');
    const cycleId = cycleRows.length > 0 ? cycleRows[0].id : 1;
    
    // 1. Create IDP header
    const [headerResult] = await conn.query(
      `INSERT INTO idp_headers
        (employee_id, supervisor_id, cycle_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'DRAFT', NOW(), NOW())`,
      [
        payload.employeeId,
        payload.supervisorId,
        cycleId
      ]
    );
    
    const idpId = headerResult.insertId;
    
    // 2. Create IDP items for each competency with development activities
    if (Array.isArray(payload.items)) {
      for (const item of payload.items) {
        // Create one entry per development activity (since we can have multiple activities per competency)
        if (Array.isArray(item.developmentActivities)) {
          for (const activity of item.developmentActivities) {
            await conn.query(
              `INSERT INTO idp_items
                (idp_header_id, competency_id, target_level, development_activity, timeline_months, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'PLANNED', NOW(), NOW())`,
              [
                idpId,
                item.competencyId,
                item.targetLevel || item.currentLevel + 1,
                JSON.stringify({
                  type: activity.type,
                  activity: activity.activity,
                  targetDate: activity.targetCompletionDate,
                  actualDate: activity.actualCompletionDate,
                  status: activity.completionStatus,
                  expectedResults: activity.expectedResults,
                  sharingMethod: activity.sharingMethod,
                  applicationMethod: activity.applicationMethod,
                  score: activity.score,
                  currentLevel: item.currentLevel,
                  developmentArea: item.developmentArea
                }),
                12 // Default 12 months timeline
              ]
            );
          }
        }
      }
    }
    
    await conn.commit();
    logInfo('Created comprehensive IDP', { idpId, employeeId: payload.employeeId });
    
    return { id: idpId };
    
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
