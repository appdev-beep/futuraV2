// Manager returns IDP to supervisor
async function managerReturnIDP(idpId, managerId, remarks) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Check if IDP exists and is pending manager
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status = ? AND manager_id = ?', [idpId, 'PENDING_MANAGER', managerId]);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending manager approval.');
    }
    // Update status and remarks
    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['RETURNED', idpId]);
    // Optionally, store remarks in a remarks/history table or in idp_headers if a column exists
    // For now, assume a remarks column exists on idp_headers
    await conn.query('UPDATE idp_headers SET manager_remarks = ? WHERE id = ?', [remarks, idpId]);
    await conn.commit();
    logInfo('Manager returned IDP to supervisor', { idpId, managerId });
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
// Get all IDPs pending manager approval
async function getIDPsPendingManager(managerId) {
  const [headers] = await db.query(
    `SELECT h.*, e.name AS employee_name, e.position_id, e.department_id
     FROM idp_headers h
     JOIN users e ON h.employee_id = e.id
     WHERE h.status = 'PENDING_MANAGER' AND h.manager_id = ?
     ORDER BY h.created_at DESC`,
    [managerId]
  );
  return headers;
}
// Delete IDP by id (only DRAFT)
async function deleteById(id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Delete items first
    await conn.query('DELETE FROM idp_items WHERE idp_header_id = ?', [id]);
    // Delete header
    await conn.query('DELETE FROM idp_headers WHERE id = ?', [id]);
    await conn.commit();
    logInfo('Deleted DRAFT IDP', { id });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
// src/services/idp.service.js
const { db } = require('../config/db');
const { logInfo } = require('../utils/logger');
const { logRecentAction } = require('./recentActions.service');
const { createNotification } = require('./notification.service');

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
  // Get department info for employee
  const [userRows] = await db.query(
    `SELECT u.department_id, d.has_am FROM users u JOIN departments d ON u.department_id = d.id WHERE u.id = ?`,
    [payload.employee_id]
  );
  const departmentId = userRows[0]?.department_id;
  const hasAM = !!userRows[0]?.has_am;

  // Get AM and Manager for department
  let amId = null, managerId = null;
  if (hasAM) {
    const [amRows] = await db.query(
      `SELECT id FROM users WHERE department_id = ? AND role = 'AM' LIMIT 1`,
      [departmentId]
    );
    amId = amRows[0]?.id || null;
  }
  const [managerRows] = await db.query(
    `SELECT id FROM users WHERE department_id = ? AND role = 'Manager' LIMIT 1`,
    [departmentId]
  );
  managerId = managerRows[0]?.id || null;

  const [result] = await db.query(
    `INSERT INTO idp_headers
      (cl_header_id, employee_id, supervisor_id, cycle_id, status, created_at, updated_at, manager_id, am_id)
     VALUES (?, ?, ?, ?, 'DRAFT', NOW(), NOW(), ?, ?)` ,
    [
      payload.cl_header_id,
      payload.employee_id,
      payload.supervisor_id,
      payload.cycle_id,
      managerId,
      amId
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
          // Update existing item: only update development_activity to avoid schema mismatches
          await conn.query(
            `UPDATE idp_items
             SET development_activity = ?, updated_at = NOW()
             WHERE id = ? AND idp_header_id = ?`,
            [
              item.development_activity,
              item.id,
              id
            ]
          );
        } else {
          // Insert new item with minimal/known columns
          await conn.query(
            `INSERT INTO idp_items
              (idp_header_id, competency_id, current_level, target_level, development_activity, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'NOT_STARTED', NOW(), NOW())`,
            [
              id,
              item.competency_id,
              item.current_level || null,
              item.target_level || null,
              item.development_activity
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

// Submit IDP: route to AM if department has AM, else to Manager
async function submit(id) {
  // 1. Get the IDP header and department info
  const [headerRows] = await db.query(
    `SELECT ih.*, u.department_id, d.has_am
     FROM idp_headers ih
     JOIN users u ON ih.employee_id = u.id
     JOIN departments d ON u.department_id = d.id
     WHERE ih.id = ?`,
    [id]
  );
  if (!headerRows.length) throw new Error('IDP not found');
  const header = headerRows[0];
  const hasAM = !!header.has_am;
  let amId = null, managerId = null;
  if (hasAM) {
    const [amRows] = await db.query(
      `SELECT id FROM users WHERE department_id = ? AND role = 'AM' LIMIT 1`,
      [header.department_id]
    );
    amId = amRows[0]?.id || null;
  }
  const [managerRows] = await db.query(
    `SELECT id FROM users WHERE department_id = ? AND role = 'Manager' LIMIT 1`,
    [header.department_id]
  );
  managerId = managerRows[0]?.id || null;

  const nextStatus = hasAM ? 'PENDING_AM' : 'PENDING_MANAGER';
  // Update status and set am_id/manager_id as appropriate
  await db.query(
    `UPDATE idp_headers
     SET status = ?, updated_at = NOW(), am_id = ?, manager_id = ?
     WHERE id = ?`,
    [nextStatus, amId, managerId, id]
  );
  // Log recent action and create notifications similar to CL flow
  try {
    const isResubmission = header.status === 'RETURNED';
    const [empRows] = await db.query('SELECT name, employee_id FROM users WHERE id = ?', [header.employee_id]);
    const employeeName = empRows[0]?.name || 'Employee';

    const [superRows] = await db.query('SELECT name FROM users WHERE id = ?', [header.supervisor_id]);
    const supervisorName = superRows[0]?.name || 'Supervisor';

    await logRecentAction({
      actor_id: header.supervisor_id,
      module: 'IDP',
      action_type: isResubmission ? 'IDP_RESUBMITTED' : 'IDP_SUBMITTED',
      cl_id: null,
      employee_id: header.employee_id,
      title: isResubmission ? `Resubmitted IDP for ${employeeName}` : `Created IDP for ${employeeName}`,
      description: `IDP #${id}`,
      url: `/supervisor/idp/view/${id}`,
    }).catch(() => {});

    // Notify employee
    await createNotification({
      recipient_id: header.employee_id,
      message: `IDP #${id} ${isResubmission ? 'resubmitted' : 'created'} for you by ${supervisorName}`,
      module: 'IDP'
    }).catch(() => {});

    // Notify next approver (AM or Manager)
    const approverId = hasAM ? amId : managerId;
    if (approverId) {
      await createNotification({
        recipient_id: approverId,
        message: `IDP #${id} for ${employeeName} ${isResubmission ? 'resubmitted' : 'submitted'} by ${supervisorName} is awaiting your approval`,
        module: 'IDP'
      }).catch(() => {});
    }
  } catch (e) {
    // don't block submit on notification/log failures
    console.error('IDP post-submit notifications/logging failed', e);
  }

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

// Get all IDPs for a supervisor, grouped by status
async function getIDPsGroupedByStatus(supervisorId) {
  // Get all IDP headers for this supervisor

  const [headers] = await db.query(
    `SELECT h.*, e.name AS employee_name, e.position_id, e.department_id
     FROM idp_headers h
     JOIN users e ON h.employee_id = e.id
     WHERE h.supervisor_id = ?
     ORDER BY h.created_at DESC`,
    [supervisorId]
  );

  // Group by status
  const grouped = {};
  for (const header of headers) {
    const status = header.status || 'UNKNOWN';
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(header);
  }
  return grouped;
}

module.exports = {
  getById,
  create,
  createWithItems,
  update,
  submit,
  getEmployeesForIDPCreation,
  getIDPsGroupedByStatus,
  deleteById,
  getIDPsPendingManager,
  managerReturnIDP,
};

// Create IDP with full development plan
async function createWithItems(payload) {
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // Get the active cycle or create with cycle 1
    const [cycleRows] = await conn.query('SELECT id FROM cycles WHERE is_active = 1 LIMIT 1');
    const cycleId = cycleRows.length > 0 ? cycleRows[0].id : 1;
    
    // Get department info for employee
    const [userRows] = await conn.query(
      `SELECT u.department_id, d.has_am FROM users u JOIN departments d ON u.department_id = d.id WHERE u.id = ?`,
      [payload.employeeId]
    );
    const departmentId = userRows[0]?.department_id;
    const hasAM = !!userRows[0]?.has_am;

    // Get AM and Manager for department
    let amId = null, managerId = null;
    if (hasAM) {
      const [amRows] = await conn.query(
        `SELECT id FROM users WHERE department_id = ? AND role = 'AM' LIMIT 1`,
        [departmentId]
      );
      amId = amRows[0]?.id || null;
    }
    const [managerRows] = await conn.query(
      `SELECT id FROM users WHERE department_id = ? AND role = 'Manager' LIMIT 1`,
      [departmentId]
    );
    managerId = managerRows[0]?.id || null;

    // 1. Create IDP header
    const [headerResult] = await conn.query(
      `INSERT INTO idp_headers
        (employee_id, supervisor_id, cycle_id, status, created_at, updated_at, manager_id, am_id)
       VALUES (?, ?, ?, 'DRAFT', NOW(), NOW(), ?, ?)` ,
      [
        payload.employeeId,
        payload.supervisorId,
        cycleId,
        managerId,
        amId
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

    // Log recent action for IDP creation
    const { logRecentAction } = require('./recentActions.service');
    await logRecentAction({
      actor_id: payload.supervisorId,
      module: 'IDP',
      action_type: 'CREATE',
      employee_id: payload.employeeId,
      title: 'Created IDP',
      description: `Supervisor created IDP for employee ${payload.employeeId}`,
      url: `/supervisor/idp/view/${idpId}`
    });

    return { id: idpId };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
