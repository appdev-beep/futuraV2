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

    // Fetch header to get supervisor/employee info for notifications/logging
    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const supervisorId = header.supervisor_id || null;
    const employeeId = header.employee_id || null;

    await conn.commit();

    // Log recent action and notify supervisor (do not block the main flow on failures)
    try {
      const [mgrRows] = await db.query('SELECT name FROM users WHERE id = ?', [managerId]);
      const managerName = (mgrRows[0] && mgrRows[0].name) || 'Manager';
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';

      await logRecentAction({
        actor_id: managerId,
        module: 'IDP',
        action_type: 'IDP_RETURNED',
        cl_id: null,
        employee_id: employeeId,
        title: `Returned IDP for ${employeeName}`,
        description: `IDP #${idpId} returned with remarks: ${remarks}`,
        url: `/supervisor/idp/view/${idpId}`,
      }).catch(() => {});

      if (supervisorId) {
        await createNotification({
          recipient_id: supervisorId,
          message: `IDP #${idpId} for ${employeeName} was returned by ${managerName}. Remarks: ${remarks}`,
          module: 'IDP',
        }).catch(() => {});
      }
    } catch (notifErr) {
      // swallow notification/log errors
      console.error('Failed to log/notify on manager return:', notifErr.message || notifErr);
    }

    logInfo('Manager returned IDP to supervisor', { idpId, managerId });
    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
// Manager approves IDP and routes it to the employee for acknowledgement
async function managerApprove(idpId, managerId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Verify IDP exists and is pending manager approval
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status = ? AND manager_id = ?', [idpId, 'PENDING_MANAGER', managerId]);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending manager approval.');
    }

    // Update status to PENDING_EMPLOYEE so the employee can view/acknowledge
    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['PENDING_EMPLOYEE', idpId]);

    // Fetch header for notifications
    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const employeeId = header.employee_id || null;

    await conn.commit();

    try {
      const [mgrRows] = await db.query('SELECT name FROM users WHERE id = ?', [managerId]);
      const managerName = (mgrRows[0] && mgrRows[0].name) || 'Manager';
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';

      await logRecentAction({
        actor_id: managerId,
        module: 'IDP',
        action_type: 'IDP_APPROVED_BY_MANAGER',
        cl_id: null,
        employee_id: employeeId,
        title: `Manager approved IDP for ${employeeName}`,
        description: `IDP #${idpId} approved by ${managerName}`,
        url: `/employee/idp/view/${idpId}`,
      }).catch(() => {});

      if (employeeId) {
        await createNotification({
          recipient_id: employeeId,
          message: `Your IDP #${idpId} has been approved by ${managerName}.`,
          module: 'IDP',
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.error('Failed to log/notify on manager approve:', notifErr.message || notifErr);
    }

    logInfo('Manager approved IDP', { idpId, managerId });
    return await getById(idpId);
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
    `SELECT ii.*, c.name AS competency_name, c.competency_area
     FROM idp_items ii
     JOIN competencies c ON ii.competency_id = c.id
     WHERE ii.idp_header_id = ?`,
    [id]
  );

  // Normalize DB column differences and parse JSON so frontend always receives an object
  const normalizedItems = (items || []).map(it => {
    const raw = it.development_activity || it.development_action || null;
    let parsed = null;
    if (raw) {
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      } else if (typeof raw === 'object') {
        parsed = raw;
      }
    }

    // Ensure common keys exist with friendly aliases
    const activity = parsed || {};
    const normalizeDate = (v) => {
      if (!v) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
      const d = new Date(v);
      if (!isNaN(d.getTime())) {
        const yy = d.getFullYear();
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const dd = String(d.getDate()).padStart(2,'0');
        return `${yy}-${mm}-${dd}`;
      }
      return '';
    };

    const normalized = {
      type: activity.type || activity.activityType || 'Education',
      activity: activity.activity || activity.developmentActivity || '',
      targetDate: normalizeDate(activity.targetDate || activity.targetCompletionDate || activity.target || ''),
      actualDate: normalizeDate(activity.actualDate || activity.actualCompletionDate || ''),
      status: activity.status || activity.completionStatus || '',
      pdfPath: activity.pdf_path || activity.pdfPath || activity.pdf || '',
      educationJustificationPdf: activity.educationJustificationPdf || activity.educationJustification || activity.education_justification_pdf || activity.education_pdf || '',
      expectedResults: activity.expectedResults || activity.expected_results || '',
      sharingMethod: activity.sharingMethod || activity.sharing_method || '',
      applicationMethod: activity.applicationMethod || activity.application_method || '',
      score: (typeof activity.score === 'number') ? activity.score : (activity.score ? Number(activity.score) : null),
      __raw: parsed || raw
    };

    return {
      ...it,
      development_activity: normalized
    };
  });

  return { header, items: normalizedItems };
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
async function update(id, payload, actorId = null, actorRole = null) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (Array.isArray(payload.items)) {
      for (const item of payload.items) {
        try { console.log('[idp.service.update] item:', { id: item.id, competency_id: item.competency_id, hasDevActivity: !!(item.development_activity || item.development_action) }); } catch(e) {}
        if (item.id) {
          // Update existing item: only update development_action to avoid schema mismatches
          await conn.query(
            `UPDATE idp_items
             SET development_action = ?, updated_at = NOW()
             WHERE id = ? AND idp_header_id = ?`,
            [
              item.development_activity || item.development_action || null,
              item.id,
              id
            ]
          );
          try { console.log('[idp.service.update] updated item id:', item.id); } catch(e) {}
        } else {
          // Insert new item with known columns (no current_level column in schema)
          await conn.query(
            `INSERT INTO idp_items
              (idp_header_id, competency_id, target_level, development_action, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'NOT_STARTED', NOW(), NOW())`,
            [
              id,
              item.competency_id,
              item.target_level || null,
              item.development_activity || item.development_action || null
            ]
          );
          try { console.log('[idp.service.update] inserted new item for competency:', item.competency_id); } catch(e) {}
        }
      }
    }

    // Update header-level fields if provided
    if (payload.reviewPeriod || payload.nextReviewDate) {
      await conn.query(
        `UPDATE idp_headers
         SET review_period = ?, next_review_date = ?, updated_at = NOW()
         WHERE id = ?`,
        [payload.reviewPeriod || null, payload.nextReviewDate || null, id]
      );
    } else {
      await conn.query(`UPDATE idp_headers SET updated_at = NOW() WHERE id = ?`, [id]);
    }

    await conn.commit();

    // After a successful update, if the IDP is in FOR_COMPLETION and the
    // supervisor made changes, notify AM, Manager, HR and Employee so all
    // stakeholders see the updates in their views.
    try {
      const [hdrRowsAfter] = await db.query('SELECT * FROM idp_headers WHERE id = ?', [id]);
      const headerAfter = hdrRowsAfter[0] || {};
      const statusAfter = headerAfter.status;

      // Notify stakeholders when a supervisor modifies the IDP.
      // Previously this only ran when status was FOR_COMPLETION; expand to notify
      // manager, AM (if any), employee and HR for any supervisor-made update.
      if (String(actorRole || '').toLowerCase() === 'supervisor') {
        // Actor name
        const [actorRows] = await db.query('SELECT name FROM users WHERE id = ?', [actorId]);
        const actorName = actorRows[0]?.name || 'Supervisor';

        // Employee name
        const employeeId = headerAfter.employee_id;
        const [empRows] = await db.query('SELECT name, department_id FROM users WHERE id = ?', [employeeId]);
        const employeeName = empRows[0]?.name || 'Employee';
        const departmentId = empRows[0]?.department_id || null;

        // Find AM and Manager for the employee's department
        let amId = null, managerId = null;
        if (departmentId) {
          const [amRows] = await db.query("SELECT id FROM users WHERE department_id = ? AND role = 'AM' LIMIT 1", [departmentId]);
          amId = amRows[0]?.id || null;
          const [managerRows] = await db.query("SELECT id FROM users WHERE department_id = ? AND role = 'Manager' LIMIT 1", [departmentId]);
          managerId = managerRows[0]?.id || null;
        }

        // HR
        const [hrRows] = await db.query("SELECT id FROM users WHERE role = 'HR' LIMIT 1");
        const hrId = hrRows[0]?.id || null;

        // Determine action type for logging
        const actionType = String(statusAfter).toUpperCase() === 'FOR_COMPLETION' ? 'IDP_UPDATED_FOR_COMPLETION' : 'IDP_UPDATED_BY_SUPERVISOR';

        // Log recent action
        await logRecentAction({
          actor_id: actorId,
          module: 'IDP',
          action_type: actionType,
          cl_id: null,
          employee_id: employeeId,
          title: `Supervisor updated IDP for ${employeeName}`,
          description: `Supervisor ${actorName} updated IDP #${id} (status: ${statusAfter})`,
          url: `/supervisor/idp/view/${id}`,
        }).catch(() => {});

        // Build notification message
        const note = `Supervisor ${actorName} updated IDP #${id} for ${employeeName}.` + (statusAfter ? ` Status: ${statusAfter}.` : '');

        // Notify employee
        if (employeeId) {
          await createNotification({ recipient_id: employeeId, message: note, module: 'IDP' }).catch(() => {});
        }
        // Notify supervisor (actor) - skip notifying self
        const supervisorId = headerAfter.supervisor_id || null;
        if (supervisorId && supervisorId !== actorId) {
          await createNotification({ recipient_id: supervisorId, message: note, module: 'IDP' }).catch(() => {});
        }
        // Notify AM
        if (amId) {
          await createNotification({ recipient_id: amId, message: note, module: 'IDP' }).catch(() => {});
        }
        // Notify Manager
        if (managerId) {
          await createNotification({ recipient_id: managerId, message: note, module: 'IDP' }).catch(() => {});
        }
        // Notify HR
        if (hrId) {
          await createNotification({ recipient_id: hrId, message: note, module: 'IDP' }).catch(() => {});
        }
      }
    } catch (notifyErr) {
      console.error('Failed to notify stakeholders after supervisor update in FOR_COMPLETION:', notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
    }

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

  // Determine next status. If the IDP was RETURNED and the last return was made by the employee,
  // route back to the employee for acknowledgement. Otherwise route to AM/Manager as usual.
  let nextStatus = hasAM ? 'PENDING_AM' : 'PENDING_MANAGER';
  // If HR previously marked this IDP as FOR_COMPLETION, supervisor updates should keep it in FOR_COMPLETION
  // until all competencies are completed. Do NOT change it back to PENDING_HR.
  if (String(header.status).toUpperCase() === 'FOR_COMPLETION') {
    nextStatus = 'FOR_COMPLETION';
  }
  if (header.status === 'RETURNED') {
    try {
        const [raRows] = await db.query(
          `SELECT actor_id, action_type, url, title, description
           FROM recent_actions
           WHERE module = 'IDP' AND (url LIKE ? OR title LIKE ? OR description LIKE ?)
           ORDER BY created_at DESC
           LIMIT 20`,
          [`%/idp/view/${id}%`, `%IDP #${id}%`, `%IDP #${id}%`]
        );
        let returnedByEmployee = false;
        for (const ra of raRows) {
          const action = String(ra.action_type || '').toLowerCase();
          const title = String(ra.title || '').toLowerCase();
          const desc = String(ra.description || '').toLowerCase();
          if (action.includes('return') || title.includes('return') || desc.includes('return')) {
            // Found a returned action; check actor role
            try {
              const [uRows] = await db.query('SELECT role FROM users WHERE id = ?', [ra.actor_id]);
              const role = (uRows[0] && uRows[0].role) || '';
              if (String(role).toLowerCase() === 'employee') {
                returnedByEmployee = true;
                break;
              }
            } catch (e) {
              // ignore lookup errors and continue searching
            }
          }
        }
      if (returnedByEmployee) {
        nextStatus = 'PENDING_EMPLOYEE';
      }
    } catch (e) {
      // If unable to determine recent action, fall back to default routing
      console.error('Failed to determine last return actor for IDP submit:', e && e.message ? e.message : e);
    }
  }

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

    // Notify next approver (AM/Manager or HR depending on routing)
    let approverId = null;
    if (String(nextStatus).toUpperCase() === 'PENDING_HR') {
      try {
        const [hrRows] = await db.query("SELECT id FROM users WHERE role = 'HR' LIMIT 1");
        approverId = hrRows[0]?.id || null;
      } catch (e) {
        approverId = null;
      }
    } else {
      approverId = hasAM ? amId : managerId;
    }

    if (approverId) {
      await createNotification({
        recipient_id: approverId,
        message: `IDP #${id} for ${employeeName} ${isResubmission ? 'resubmitted' : 'submitted'} by ${supervisorName} is awaiting your approval`,
        module: 'IDP'
      }).catch(() => {});
    }
    // Also notify manager, AM and HR so all stakeholders see the new submission
    try {
      if (managerId) {
        await createNotification({ recipient_id: managerId, message: `IDP #${id} for ${employeeName} has been submitted by ${supervisorName}.`, module: 'IDP' }).catch(() => {});
      }
      if (amId) {
        await createNotification({ recipient_id: amId, message: `IDP #${id} for ${employeeName} has been submitted by ${supervisorName}.`, module: 'IDP' }).catch(() => {});
      }
      try {
        const [hrRowsAll] = await db.query("SELECT id FROM users WHERE role = 'HR' LIMIT 1");
        const hrIdAll = hrRowsAll[0]?.id || null;
        if (hrIdAll) {
          await createNotification({ recipient_id: hrIdAll, message: `IDP #${id} for ${employeeName} has been submitted by ${supervisorName}.`, module: 'IDP' }).catch(() => {});
        }
      } catch (e) {
        // ignore HR lookup failures
      }
    } catch (e) {
      // swallow any additional notification failures
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
        `SELECT h.*, e.name AS employee_name, e.position_id, e.department_id,
          COALESCE(p.title, '') AS position_title
     FROM idp_headers h
     JOIN users e ON h.employee_id = e.id
     LEFT JOIN positions p ON e.position_id = p.id
     WHERE h.supervisor_id = ?
     ORDER BY h.created_at DESC`,
    [supervisorId]
  );

  // If users table contains a position title field, prefer that for display
  // Some rows may already include position_title; include it if present
  // Note: selecting e.position_title and e.position for broader compatibility

  // Group by status
  const grouped = {};
  for (const header of headers) {
    const status = header.status || 'UNKNOWN';
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(header);
  }
  return grouped;
}

// Get all IDPs for a manager, grouped by status
async function getIDPsGroupedByManager(managerId) {
  const [headers] = await db.query(
    `SELECT h.*, e.name AS employee_name, e.position_id, e.department_id,
      COALESCE(p.title, '') AS position_title
     FROM idp_headers h
     JOIN users e ON h.employee_id = e.id
     LEFT JOIN positions p ON e.position_id = p.id
     WHERE h.manager_id = ?
     ORDER BY h.created_at DESC`,
    [managerId]
  );

  const grouped = {};
  for (const header of headers) {
    const status = header.status || 'UNKNOWN';
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(header);
  }
  return grouped;
}

// Get IDPs for a specific employee
async function getIDPsForEmployee(employeeId) {
  const [rows] = await db.query(
    `SELECT h.*, u.name AS supervisor_name, u.employee_id AS supervisor_employee_code
     FROM idp_headers h
     LEFT JOIN users u ON h.supervisor_id = u.id
     WHERE h.employee_id = ?
     ORDER BY h.created_at DESC`,
    [employeeId]
  );
  return rows || [];
}

// Employee approves (acknowledges) an IDP
async function employeeApprove(idpId, employeeId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Verify IDP exists and is pending employee
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status = ?', [idpId, 'PENDING_EMPLOYEE']);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending employee acknowledgement.');
    }

    // Update status to PENDING_HR so HR can review/approve after employee acknowledgement
    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['PENDING_HR', idpId]);

    // Fetch header for notifications/logging
    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const supervisorId = header.supervisor_id || null;

    await conn.commit();

    try {
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';
      const [supRows] = await db.query('SELECT name FROM users WHERE id = ?', [supervisorId]);
      const supervisorName = (supRows[0] && supRows[0].name) || 'Supervisor';

      await logRecentAction({
        actor_id: employeeId,
        module: 'IDP',
        action_type: 'IDP_APPROVED_BY_EMPLOYEE',
        cl_id: null,
        employee_id: header.employee_id,
        title: `Employee acknowledged IDP for ${employeeName}`,
        description: `IDP #${idpId} acknowledged by employee ${employeeName}`,
        url: `/employee/idp/view/${idpId}`,
      }).catch(() => {});

      // Notify supervisor that the employee acknowledged
      if (supervisorId) {
        await createNotification({
          recipient_id: supervisorId,
          message: `Employee ${employeeName} acknowledged IDP #${idpId}.`,
          module: 'IDP',
        }).catch(() => {});
      }
      // Notify HR that the IDP is now pending HR review/approval
      try {
        const [hrRows] = await db.query(`SELECT id FROM users WHERE role = 'HR' LIMIT 1`);
        if (hrRows && hrRows.length > 0) {
          await createNotification({
            recipient_id: hrRows[0].id,
            message: `IDP #${idpId} for ${employeeName} is awaiting HR review after employee acknowledgement.`,
            module: 'IDP'
          }).catch(() => {});
        }
      } catch (hrErr) {
        console.error('Failed to notify HR on employee approve:', hrErr && hrErr.message ? hrErr.message : hrErr);
      }
    } catch (notifErr) {
      console.error('Failed to log/notify on employee approve:', notifErr.message || notifErr);
    }

    return await getById(idpId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Employee returns IDP back to supervisor for changes
async function employeeReturn(idpId, employeeId, remarks) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Verify IDP exists and is pending employee
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status = ?', [idpId, 'PENDING_EMPLOYEE']);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending employee acknowledgement.');
    }

    // Update status to RETURNED
    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['RETURNED', idpId]);

    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const supervisorId = header.supervisor_id || null;

    await conn.commit();

    try {
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';
      const [supRows] = await db.query('SELECT name FROM users WHERE id = ?', [supervisorId]);
      const supervisorName = (supRows[0] && supRows[0].name) || 'Supervisor';

      await logRecentAction({
        actor_id: employeeId,
        module: 'IDP',
        action_type: 'IDP_RETURNED_BY_EMPLOYEE',
        cl_id: null,
        employee_id: header.employee_id,
        title: `Employee returned IDP for ${employeeName}`,
        description: `IDP #${idpId} returned with remarks: ${remarks}`,
        url: `/supervisor/idp/view/${idpId}`,
      }).catch(() => {});

      if (supervisorId) {
        await createNotification({
          recipient_id: supervisorId,
          message: `Employee ${employeeName} returned IDP #${idpId}. Remarks: ${remarks}`,
          module: 'IDP',
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.error('Failed to log/notify on employee return:', notifErr.message || notifErr);
    }

    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// HR: get incoming IDPs optionally filtered by department name and/or status
async function getHRIncoming(hrId, departmentName = null, status = null) {
  // Build base query
  let sql = `SELECT h.*, u.name AS employee_name, d.name AS department_name, u.position_id, p.title AS position_title, sup.name AS supervisor_name
             FROM idp_headers h
             JOIN users u ON h.employee_id = u.id
             LEFT JOIN departments d ON u.department_id = d.id
             LEFT JOIN positions p ON u.position_id = p.id
             LEFT JOIN users sup ON h.supervisor_id = sup.id
             WHERE 1=1`;
  const params = [];

  // Optional status filter. Accept comma-separated list.
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(',');
      sql += ` AND h.status IN (${placeholders})`;
      params.push(...statuses);
    }
  }

  if (departmentName) {
    sql += ` AND d.name = ?`;
    params.push(departmentName);
  }

  sql += ` ORDER BY h.created_at DESC`;
  const [rows] = await db.query(sql, params);
  return rows || [];
}

// HR approves IDP: only allowed when all development activities are completed
async function hrApprove(idpId, hrId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND (status = ? OR status = ?)', [idpId, 'PENDING_HR', 'FOR_COMPLETION']);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending HR approval.');
    }

    // Load items to verify completion status
    const [items] = await conn.query('SELECT ii.*, c.name AS competency_name FROM idp_items ii LEFT JOIN competencies c ON ii.competency_id = c.id WHERE ii.idp_header_id = ?', [idpId]);

    const incomplete = [];
    for (const it of items) {
      const raw = it.development_action || it.development_activity || null;
      let parsed = null;
      if (raw) {
        if (typeof raw === 'string') {
          try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        } else if (typeof raw === 'object') parsed = raw;
      }
      const status = String((parsed && (parsed.status || parsed.completionStatus || parsed.completion_status)) || '').trim().toLowerCase();
      if (status !== 'completed') {
        incomplete.push(it.competency_name || `item ${it.id}`);
      }
    }

    if (incomplete.length > 0) {
      // Not all completed -> route back to supervisor for completion
      await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['FOR_COMPLETION', idpId]);

      const [hdrRowsFC] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
      const headerFC = hdrRowsFC[0] || {};
      const supervisorIdFC = headerFC.supervisor_id || null;
      const employeeIdFC = headerFC.employee_id || null;

      await conn.commit();

      // Notify supervisor (and optionally other stakeholders) that IDP requires completion
      try {
        const [hrRows] = await db.query('SELECT name FROM users WHERE id = ?', [hrId]);
        const hrName = (hrRows[0] && hrRows[0].name) || 'HR';
        const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeIdFC]);
        const employeeName = (empRows[0] && empRows[0].name) || 'Employee';

        await logRecentAction({
          actor_id: hrId,
          module: 'IDP',
          action_type: 'IDP_FOR_COMPLETION_BY_HR',
          cl_id: null,
          employee_id: employeeIdFC,
          title: `HR requested completion for IDP for ${employeeName}`,
          description: `IDP #${idpId} requires completion for competencies: ${incomplete.join(', ')}`,
          url: `/supervisor/idp/view/${idpId}`,
        }).catch(() => {});

        if (supervisorIdFC) {
          await createNotification({
            recipient_id: supervisorIdFC,
            message: `IDP #${idpId} for ${employeeName} requires completion (incomplete competencies: ${incomplete.join(', ')}). HR ${hrName} flagged it for completion.`,
            module: 'IDP',
          }).catch(() => {});
        }
      } catch (notifyErr) {
        console.error('Failed to log/notify on HR FOR_COMPLETION:', notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
      }

      return await getById(idpId);
    }

    // (moved HR helper functions to module scope below)

    // All completed -> mark CYCLE_COMPLETED so the record remains visible as finished
    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['CYCLE_COMPLETED', idpId]);

    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const employeeId = header.employee_id || null;
    const supervisorId = header.supervisor_id || null;

    await conn.commit();

    try {
      const [hrRows] = await db.query('SELECT name FROM users WHERE id = ?', [hrId]);
      const hrName = (hrRows[0] && hrRows[0].name) || 'HR';
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';

      await logRecentAction({
        actor_id: hrId,
        module: 'IDP',
        action_type: 'IDP_CYCLE_COMPLETED_BY_HR',
        cl_id: null,
        employee_id: employeeId,
        title: `HR completed IDP cycle for ${employeeName}`,
        description: `IDP #${idpId} marked Cycle Completed by ${hrName}`,
        url: `/employee/idp/view/${idpId}`,
      }).catch(() => {});

      if (employeeId) {
        await createNotification({
          recipient_id: employeeId,
          message: `Your IDP #${idpId} has been marked Cycle Completed by HR ${hrName}.`,
          module: 'IDP',
        }).catch(() => {});
      }
      if (supervisorId) {
        await createNotification({
          recipient_id: supervisorId,
          message: `IDP #${idpId} for ${employeeName} has been marked Cycle Completed by HR ${hrName}.`,
          module: 'IDP',
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.error('Failed to log/notify on HR approve:', notifErr && notifErr.message ? notifErr.message : notifErr);
    }

    return await getById(idpId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// HR returns IDP to supervisor for revision (status: RETURNED)
async function hrReturn(idpId, hrId, remarks) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status = ?', [idpId, 'PENDING_HR']);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending HR review.');
    }

    // Set status to RETURNED so supervisor can revise the IDP (return for revision)
    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['RETURNED', idpId]);

    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const supervisorId = header.supervisor_id || null;
    const employeeId = header.employee_id || null;

    await conn.commit();

    try {
      const [hrRows] = await db.query('SELECT name FROM users WHERE id = ?', [hrId]);
      const hrName = (hrRows[0] && hrRows[0].name) || 'HR';
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';

      await logRecentAction({
        actor_id: hrId,
        module: 'IDP',
        action_type: 'IDP_RETURNED_BY_HR',
        cl_id: null,
        employee_id: employeeId,
        title: `HR returned IDP for ${employeeName} (for revision)`,
        description: `IDP #${idpId} returned by HR ${hrName} for revision. Remarks: ${remarks}`,
        url: `/supervisor/idp/view/${idpId}`,
      }).catch(() => {});

      if (supervisorId) {
        await createNotification({
          recipient_id: supervisorId,
          message: `IDP #${idpId} for ${employeeName} was returned by HR ${hrName} for revision. Remarks: ${remarks}`,
          module: 'IDP',
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.error('Failed to log/notify on HR return:', notifErr && notifErr.message ? notifErr.message : notifErr);
    }

    return { success: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  getById,
  create,
  createWithItems,
  update,
  submit,
  getEmployeesForIDPCreation,
  getIDPsGroupedByStatus,
  getIDPsGroupedByManager,
  deleteById,
  getIDPsPendingManager,
  managerReturnIDP,
  managerApprove,
  getIDPsForEmployee,
  getHRIncoming,
  employeeApprove,
  employeeReturn,
  hrApprove,
  hrApproveForCompletion,
  hrForceCycleComplete,
  hrReturn,
};

// HR: explicitly mark IDP as FOR_COMPLETION (HR chooses to send back for completion)
async function hrApproveForCompletion(idpId, hrId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status = ?', [idpId, 'PENDING_HR']);
    if (rows.length === 0) throw new Error('IDP not found or not pending HR review.');

    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['FOR_COMPLETION', idpId]);

    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const supervisorId = header.supervisor_id || null;
    const employeeId = header.employee_id || null;

    await conn.commit();

    try {
      const [hrRows] = await db.query('SELECT name FROM users WHERE id = ?', [hrId]);
      const hrName = (hrRows[0] && hrRows[0].name) || 'HR';
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';

      await logRecentAction({
        actor_id: hrId,
        module: 'IDP',
        action_type: 'IDP_FOR_COMPLETION_BY_HR',
        cl_id: null,
        employee_id: employeeId,
        title: `HR requested completion for IDP for ${employeeName}`,
        description: `IDP #${idpId} requires completion per HR ${hrName}`,
        url: `/supervisor/idp/view/${idpId}`,
      }).catch(() => {});

      if (supervisorId) {
        await createNotification({ recipient_id: supervisorId, message: `IDP #${idpId} for ${employeeName} requires completion per HR ${hrName}.`, module: 'IDP' }).catch(() => {});
      }
    } catch (notifErr) {
      console.error('Failed to log/notify on HR FOR_COMPLETION (explicit):', notifErr && notifErr.message ? notifErr.message : notifErr);
    }

    return await getById(idpId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// HR: explicitly force CYCLE_COMPLETED (HR chooses to finalize the cycle)
async function hrForceCycleComplete(idpId, hrId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND (status = ? OR status = ?)', [idpId, 'PENDING_HR', 'FOR_COMPLETION']);
    if (rows.length === 0) throw new Error('IDP not found or not pending HR review.');

    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['CYCLE_COMPLETED', idpId]);

    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const employeeId = header.employee_id || null;
    const supervisorId = header.supervisor_id || null;

    await conn.commit();

    try {
      const [hrRows] = await db.query('SELECT name FROM users WHERE id = ?', [hrId]);
      const hrName = (hrRows[0] && hrRows[0].name) || 'HR';
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';

      await logRecentAction({
        actor_id: hrId,
        module: 'IDP',
        action_type: 'IDP_CYCLE_COMPLETED_BY_HR',
        cl_id: null,
        employee_id: employeeId,
        title: `HR completed IDP cycle for ${employeeName}`,
        description: `IDP #${idpId} marked Cycle Completed by ${hrName}`,
        url: `/employee/idp/view/${idpId}`,
      }).catch(() => {});

      if (employeeId) {
        await createNotification({ recipient_id: employeeId, message: `Your IDP #${idpId} has been marked Cycle Completed by HR ${hrName}.`, module: 'IDP' }).catch(() => {});
      }
      if (supervisorId) {
        await createNotification({ recipient_id: supervisorId, message: `IDP #${idpId} for ${employeeName} has been marked Cycle Completed by HR ${hrName}.`, module: 'IDP' }).catch(() => {});
      }
    } catch (notifErr) {
      console.error('Failed to log/notify on HR force cycle complete:', notifErr && notifErr.message ? notifErr.message : notifErr);
    }

    return await getById(idpId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

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
        (employee_id, supervisor_id, cycle_id, review_period, next_review_date, status, created_at, updated_at, manager_id, am_id)
       VALUES (?, ?, ?, ?, ?, 'DRAFT', NOW(), NOW(), ?, ?)` ,
      [
        payload.employeeId,
        payload.supervisorId,
        cycleId,
        payload.reviewPeriod || null,
        payload.nextReviewDate || null,
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
                  (idp_header_id, competency_id, target_level, development_action, timeline_months, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 'PLANNED', NOW(), NOW())`,
                [
                  idpId,
                  item.competencyId,
                  item.targetLevel || (item.currentLevel ? Number(item.currentLevel) + 1 : null),
                  JSON.stringify({
                    type: activity.type,
                    activity: activity.activity,
                    targetDate: activity.targetCompletionDate || activity.targetDate || activity.target || null,
                    actualDate: activity.actualCompletionDate || activity.actualDate || null,
                    status: activity.completionStatus || activity.status || null,
                    expectedResults: activity.expectedResults,
                    sharingMethod: activity.sharingMethod,
                    applicationMethod: activity.applicationMethod,
                    score: activity.score,
                    pdf_path: activity.pdf_path || activity.pdfPath || activity.pdf || null,
                    educationJustificationPdf: activity.educationJustificationPdf || activity.educationJustification || activity.education_justification_pdf || null,
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
