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

  // Normalize DB column differences and parse JSON so frontend always receives an object
  const normalizedItems = await Promise.all((items || []).map(async (it) => {
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

    // Load extra tables and areas of exposure
    const [extraTables] = await db.query(
      `SELECT * FROM idp_extra_tables WHERE idp_item_id = ? ORDER BY id`,
      [it.id]
    );

    const extraTablesWithAreas = await Promise.all((extraTables || []).map(async (et) => {
      const [areas] = await db.query(
        `SELECT * FROM idp_areas_of_exposure WHERE extra_table_id = ? ORDER BY id`,
        [et.id]
      );

      return {
        id: et.id,
        quarter: et.quarter,
        targetCompletionDate: normalizeDate(et.target_completion_date),
        actualCompletionDate: normalizeDate(et.actual_completion_date),
        developmentActivity: et.development_activity,
        completionStatus: et.completion_status,
        score: et.score || 1,
        expectedResults: et.expected_results,
        sharingMethod: et.sharing_method,
        applicationMethod: et.application_method,
        pdfPath: et.pdf_path,
        educationJustificationPdf: et.education_justification_pdf,
        exposureStartDate: normalizeDate(et.exposure_start_date),
        learning: et.learning,
        areasOfExposure: (areas || []).map(a => ({
          id: a.id,
          area: a.area,
          status: a.status,
          datetime: a.datetime,
          durationHours: a.duration_hours,
          trainerName: a.trainer_name,
          comments: a.comments
        }))
      };
    }));

    return {
      ...it,
      development_activity: normalized,
      extra_tables: extraTablesWithAreas
    };
  }));

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
async function managerApprove(idpId, managerId, remarks = '') {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Verify IDP exists and is pending manager approval
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status = ? AND manager_id = ?', [idpId, 'PENDING_MANAGER', managerId]);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending manager approval.');
    }

    // Update status to PENDING_EMPLOYEE so the employee can view/acknowledge, and save remarks
    await conn.query('UPDATE idp_headers SET status = ?, manager_remarks = ?, updated_at = NOW() WHERE id = ?', ['PENDING_EMPLOYEE', remarks, idpId]);

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

// =====================================
// AM (ASSISTANT MANAGER) FUNCTIONS
// =====================================

// Get all IDPs pending AM approval
async function getIDPsPendingAM(amId) {
  const [headers] = await db.query(
    `SELECT h.*, e.name AS employee_name, e.position_id, e.department_id,
            s.name AS supervisor_name
     FROM idp_headers h
     JOIN users e ON h.employee_id = e.id
     LEFT JOIN users s ON h.supervisor_id = s.id
     WHERE h.status = 'PENDING_AM' AND h.am_id = ?
     ORDER BY h.created_at DESC`,
    [amId]
  );
  return headers;
}

// AM approves IDP and routes it to Manager
async function amApprove(idpId, amId, remarks = '') {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    // Verify IDP exists and is pending AM approval
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status = ? AND am_id = ?', [idpId, 'PENDING_AM', amId]);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending AM approval.');
    }

    // Update status to PENDING_MANAGER and save remarks
    await conn.query('UPDATE idp_headers SET status = ?, am_remarks = ?, updated_at = NOW() WHERE id = ?', ['PENDING_MANAGER', remarks, idpId]);

    // Fetch header for notifications
    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const employeeId = header.employee_id || null;
    const managerId = header.manager_id || null;

    await conn.commit();

    try {
      const [amRows] = await db.query('SELECT name FROM users WHERE id = ?', [amId]);
      const amName = (amRows[0] && amRows[0].name) || 'Assistant Manager';
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';

      await logRecentAction({
        actor_id: amId,
        module: 'IDP',
        action_type: 'IDP_APPROVED_BY_AM',
        cl_id: null,
        employee_id: employeeId,
        title: `AM approved IDP for ${employeeName}`,
        description: remarks || 'No remarks provided',
        url: `/idp/view/${idpId}`,
      }).catch(() => {});

      if (managerId) {
        await createNotification({
          recipient_id: managerId,
          message: `IDP #${idpId} for ${employeeName} has been approved by AM and requires your review.`,
          module: 'IDP',
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.error('Failed to log/notify on AM approve:', notifErr.message || notifErr);
    }

    logInfo('AM approved IDP', { idpId, amId });
    return await getById(idpId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// AM returns IDP to supervisor
async function amReturnIDP(idpId, amId, remarks) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    // Check if IDP exists and is pending AM
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status = ? AND am_id = ?', [idpId, 'PENDING_AM', amId]);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending AM approval.');
    }
    
    // Update status and remarks
    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', ['RETURNED', idpId]);
    await conn.query('UPDATE idp_headers SET am_remarks = ? WHERE id = ?', [remarks, idpId]);
    
    // Fetch header for notifications
    const [hdrRows] = await conn.query('SELECT * FROM idp_headers WHERE id = ?', [idpId]);
    const header = hdrRows[0] || {};
    const employeeId = header.employee_id || null;
    const supervisorId = header.supervisor_id || null;

    await conn.commit();

    try {
      const [amRows] = await db.query('SELECT name FROM users WHERE id = ?', [amId]);
      const amName = (amRows[0] && amRows[0].name) || 'Assistant Manager';
      const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [employeeId]);
      const employeeName = (empRows[0] && empRows[0].name) || 'Employee';

      await logRecentAction({
        actor_id: amId,
        module: 'IDP',
        action_type: 'IDP_RETURNED_BY_AM',
        cl_id: null,
        employee_id: employeeId,
        title: `AM returned IDP for ${employeeName}`,
        description: remarks || 'No remarks provided',
        url: `/idp/view/${idpId}`,
      }).catch(() => {});

      if (supervisorId) {
        await createNotification({
          recipient_id: supervisorId,
          message: `IDP #${idpId} for ${employeeName} has been returned by AM for revision.`,
          module: 'IDP',
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.error('Failed to log/notify on AM return:', notifErr.message || notifErr);
    }

    logInfo('AM returned IDP', { idpId, amId });
    return { message: 'IDP returned successfully.' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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

// Update or insert IDP items
async function update(id, payload, actorId = null, actorRole = null) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (Array.isArray(payload.items)) {
      for (const item of payload.items) {
        try { console.log('[idp.service.update] item:', { id: item.id, competency_id: item.competency_id, hasDevActivity: !!(item.development_activity || item.development_action) }); } catch(e) {}
        if (item.id) {
          // Update existing item with development_action (which contains the main activity as JSON)
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

          // Handle extraTables data - delete existing and re-insert
          if (Array.isArray(item.extraTables)) {
            // First delete existing extra tables for this item
            await conn.query('DELETE FROM idp_extra_tables WHERE idp_item_id = ?', [item.id]);
            
            // Then insert the updated ones
            for (const extraTable of item.extraTables) {
              const extraId = extraTable.id || null;
              const [extraTableInsertResult] = await conn.query(
                `INSERT INTO idp_extra_tables 
                 (idp_item_id, quarter, development_activity, target_completion_date, actual_completion_date, 
                  completion_status, score, expected_results, sharing_method, application_method, 
                  pdf_path, education_justification_pdf, exposure_start_date, learning, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                  item.id,
                  extraTable.quarter || null,
                  extraTable.developmentActivity || null,
                  extraTable.targetCompletionDate || null,
                  extraTable.actualCompletionDate || null,
                  extraTable.completionStatus || null,
                  extraTable.score || 1,
                  extraTable.expectedResults || null,
                  extraTable.sharingMethod || null,
                  extraTable.applicationMethod || null,
                  extraTable.pdfPath || null,
                  extraTable.educationJustificationPdf || null,
                  extraTable.exposureStartDate || null,
                  extraTable.learning || null
                ]
              );

              // Handle areas of exposure if they exist
              if (Array.isArray(extraTable.areasOfExposure) && extraTableInsertResult.insertId) {
                const newExtraTableId = extraTableInsertResult.insertId;
                
                for (const area of extraTable.areasOfExposure) {
                  // Validate duration_hours - must be a valid number or null/empty
                  let durationHours = area.durationHours;
                  if (durationHours !== null && durationHours !== undefined && durationHours !== '') {
                    const parsed = parseFloat(durationHours);
                    if (isNaN(parsed) || !isFinite(parsed)) {
                      throw new Error(`Invalid duration hours value: "${durationHours}". Duration must be a valid number.`);
                    }
                    durationHours = parsed;
                  } else {
                    durationHours = null;
                  }

                  await conn.query(
                    `INSERT INTO idp_areas_of_exposure 
                     (extra_table_id, area, status, datetime, duration_hours, trainer_name, comments, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                      newExtraTableId,
                      area.area || null,
                      area.status || null,
                      area.datetime || null,
                      durationHours,
                      area.trainerName || null,
                      area.comments || null
                    ]
                  );
                }
              }
            }
          }
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
  console.log(`[IDP SUBMIT DEBUG] Starting submit for IDP ${id}`);
  
  // 1. Get the IDP header, department info, and employee assignments
  const [headerRows] = await db.query(
    `SELECT ih.*, u.department_id, u.manager_id, u.am_id, d.has_am
     FROM idp_headers ih
     JOIN users u ON ih.employee_id = u.id
     JOIN departments d ON u.department_id = d.id
     WHERE ih.id = ?`,
    [id]
  );
  if (!headerRows.length) throw new Error('IDP not found');
  const header = headerRows[0];
  
  console.log(`[IDP SUBMIT DEBUG] Current status: ${header.status}`);
  
  // Determine AM and Manager IDs based on individual assignments first, then fallback to department
  let amId = header.am_id; // Use individually assigned AM first
  let managerId = header.manager_id; // Use individually assigned Manager first
  
  // If no individual assignments, fallback to department-based lookup
  if (!amId && header.has_am) {
    const [amRows] = await db.query(
      `SELECT id FROM users WHERE department_id = ? AND role = 'AM' AND is_active = 1 LIMIT 1`,
      [header.department_id]
    );
    amId = amRows[0]?.id || null;
  }
  
  if (!managerId) {
    const [managerRows] = await db.query(
      `SELECT id FROM users WHERE department_id = ? AND role = 'Manager' AND is_active = 1 LIMIT 1`,
      [header.department_id]
    );
    managerId = managerRows[0]?.id || null;
  }

  // Determine next status based on individual assignments
  let nextStatus;
  if (header.am_id) {
    nextStatus = 'PENDING_AM'; // Route to individually assigned AM
  } else if (header.manager_id) {
    nextStatus = 'PENDING_MANAGER'; // Route to individually assigned Manager
  } else {
    // Fallback to department-based routing
    const hasAM = !!header.has_am;
    nextStatus = hasAM ? 'PENDING_AM' : 'PENDING_MANAGER';
  }
  
  // If status is FOR_COMPLETION, supervisor is just updating activities, keep the same status
  if (String(header.status).toUpperCase() === 'FOR_COMPLETION') {
    nextStatus = 'FOR_COMPLETION';
    console.log(`[IDP SUBMIT DEBUG] FOR_COMPLETION detected, keeping status as FOR_COMPLETION`);
  } else if (header.status === 'RETURNED') {
    // When resubmitting a returned IDP, route back to whoever returned it
    try {
        console.log(`[IDP SUBMIT DEBUG] Looking for return action for IDP ${id}`);
        const [raRows] = await db.query(
          `SELECT actor_id, action_type, url, title, description
           FROM recent_actions
           WHERE module = 'IDP' AND (url LIKE ? OR title LIKE ? OR description LIKE ?)
           ORDER BY created_at DESC
           LIMIT 20`,
          [`%/idp/view/${id}%`, `%IDP #${id}%`, `%IDP #${id}%`]
        );
        
        console.log(`[IDP SUBMIT DEBUG] Found ${raRows.length} recent actions for IDP ${id}`);
        raRows.forEach((ra, index) => {
          console.log(`[IDP SUBMIT DEBUG] Action ${index}: ${ra.action_type}, actor: ${ra.actor_id}, title: "${ra.title}"`);
        });
        
        let returnerRole = null;
        let returnerActorId = null;
        for (const ra of raRows) {
          console.log(`[IDP SUBMIT DEBUG] Checking action: ${ra.action_type}, title: ${ra.title}`);
          const action = String(ra.action_type || '').toLowerCase();
          const title = String(ra.title || '').toLowerCase();
          
          // Look for any action that is clearly a return action (by action type or title)
          const isReturnAction = (
            action.includes('returned') || 
            action.includes('_return') ||
            action === 'idp_returned' || 
            action === 'idp_returned_by_am' || 
            action === 'idp_returned_by_manager' || 
            action === 'idp_returned_by_hr' ||
            action === 'idp_returned_by_employee' ||
            title.includes('returned idp') ||
            title.includes('return')
          );
          
          if (isReturnAction) {
            // Found a returned action; check actor role
            try {
              console.log(`[IDP SUBMIT DEBUG] Found return action! Actor ID: ${ra.actor_id}, Action: ${ra.action_type}`);
              const [uRows] = await db.query('SELECT role FROM users WHERE id = ?', [ra.actor_id]);
              if (uRows.length > 0) {
                const role = uRows[0].role;
                returnerRole = String(role).toLowerCase();
                returnerActorId = ra.actor_id;
                console.log(`[IDP SUBMIT DEBUG] Found returner with role: ${returnerRole} (actor ID: ${returnerActorId})`);
                break;
              } else {
                console.log(`[IDP SUBMIT DEBUG] No user found for actor ID: ${ra.actor_id}`);
              }
            } catch (e) {
              // ignore lookup errors and continue searching
              console.log(`[IDP SUBMIT DEBUG] Error looking up user role for actor ${ra.actor_id}: ${e.message}`);
            }
          }
        }
        
        console.log(`[IDP SUBMIT DEBUG] Final returner role determined: ${returnerRole}`);
        
        // Route back to whoever returned it
        if (returnerRole === 'employee') {
          nextStatus = 'PENDING_EMPLOYEE';
        } else if (returnerRole === 'am') {
          nextStatus = 'PENDING_AM';
        } else if (returnerRole === 'manager') {
          nextStatus = 'PENDING_MANAGER';
        } else if (returnerRole === 'hr') {
          nextStatus = 'PENDING_HR';
        } else {
          console.log(`[IDP SUBMIT DEBUG] No valid returner found, falling back to default routing`);
        }
        // If no returner found, fall back to default routing (AM or Manager)
        
        console.log(`[IDP SUBMIT DEBUG] Resubmission routing to: ${nextStatus} (returned by ${returnerRole || 'unknown'})`);
    } catch (e) {
      // If unable to determine recent action, fall back to default routing
      console.error('Failed to determine last return actor for IDP submit:', e && e.message ? e.message : e);
    }
  }

  // Update status and set am_id/manager_id as appropriate
  console.log(`[IDP SUBMIT DEBUG] Updating status from ${header.status} to ${nextStatus}`);
  
  await db.query(
    `UPDATE idp_headers
     SET status = ?, updated_at = NOW(), am_id = ?, manager_id = ?
     WHERE id = ?`,
    [nextStatus, amId, managerId, id]
  );
  
  console.log(`[IDP SUBMIT DEBUG] Status updated successfully, nextStatus: ${nextStatus}`);
  
  // Log recent action and create notifications similar to CL flow
  try {
    const isResubmission = header.status === 'RETURNED' || header.status === 'FOR_COMPLETION';
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
    // Do NOT notify if it's FOR_COMPLETION - supervisor is just updating activities
    let approverId = null;
    const shouldNotify = String(nextStatus).toUpperCase() !== 'FOR_COMPLETION';
    
    if (shouldNotify) {
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
    } else {
      console.log(`[IDP SUBMIT DEBUG] FOR_COMPLETION update - no notifications sent to approvers`);
    }
    
    // Also notify manager, AM and HR so all stakeholders see new submissions
    // Skip for FOR_COMPLETION updates to avoid spam
    if (shouldNotify) {
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
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status IN (?, ?)', [idpId, 'PENDING_HR', 'FOR_COMPLETION']);
    if (rows.length === 0) {
      throw new Error('IDP not found or not pending HR review.');
    }

    const currentStatus = rows[0].status;
    // If IDP was in FOR_COMPLETION, keep it in FOR_COMPLETION when returned
    // If IDP was in PENDING_HR, set it to RETURNED for revision
    const newStatus = currentStatus === 'FOR_COMPLETION' ? 'FOR_COMPLETION' : 'RETURNED';
    await conn.query('UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?', [newStatus, idpId]);

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

      const actionType = newStatus === 'FOR_COMPLETION' ? 'IDP_RETURNED_FOR_COMPLETION' : 'IDP_RETURNED_BY_HR';
      const titleSuffix = newStatus === 'FOR_COMPLETION' ? '(for completion updates)' : '(for revision)';
      const descriptionSuffix = newStatus === 'FOR_COMPLETION' ? 'for completion updates' : 'for revision';
      
      await logRecentAction({
        actor_id: hrId,
        module: 'IDP',
        action_type: actionType,
        cl_id: null,
        employee_id: employeeId,
        title: `HR returned IDP for ${employeeName} ${titleSuffix}`,
        description: `IDP #${idpId} returned by HR ${hrName} ${descriptionSuffix}. Remarks: ${remarks}`,
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

// Resubmit IDP directly to HR (when HR previously returned it)
async function resubmitToHR(id) {
  console.log(`[IDP RESUBMIT TO HR DEBUG] Starting resubmit to HR for IDP ${id}`);
  
  const [headerRows] = await db.query('SELECT * FROM idp_headers WHERE id = ?', [id]);
  if (!headerRows.length) throw new Error('IDP not found');
  const header = headerRows[0];
  
  console.log(`[IDP RESUBMIT TO HR DEBUG] Current status: ${header.status}`);
  
  // Set status directly to PENDING_HR
  await db.query(
    `UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?`,
    ['PENDING_HR', id]
  );
  
  console.log(`[IDP RESUBMIT TO HR DEBUG] Status updated to PENDING_HR`);
  
  // Create notifications
  try {
    const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [header.employee_id]);
    const employeeName = empRows[0]?.name || 'Employee';
    const [supRows] = await db.query('SELECT name FROM users WHERE id = ?', [header.supervisor_id]);
    const supervisorName = supRows[0]?.name || 'Supervisor';
    
    // Notify HR
    const [hrRows] = await db.query("SELECT id FROM users WHERE role = 'HR' LIMIT 1");
    const hrId = hrRows[0]?.id || null;
    if (hrId) {
      await createNotification({
        recipient_id: hrId,
        message: `IDP #${id} for ${employeeName} resubmitted by ${supervisorName} for your review`,
        module: 'IDP'
      }).catch(() => {});
    }
    
    await logRecentAction({
      actor_id: header.supervisor_id,
      module: 'IDP',
      action_type: 'IDP_RESUBMITTED_TO_HR',
      cl_id: null,
      employee_id: header.employee_id,
      title: `Resubmitted IDP to HR for ${employeeName}`,
      description: `IDP #${id}`,
      url: `/supervisor/idp/view/${id}`,
    }).catch(() => {});
  } catch (e) {
    console.error('IDP resubmit to HR notifications failed', e);
  }
  
  return await getById(id);
}

// Resubmit IDP directly to Manager (when Manager previously returned it)
async function resubmitToManager(id) {
  console.log(`[IDP RESUBMIT TO MANAGER DEBUG] Starting resubmit to Manager for IDP ${id}`);
  
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
  
  console.log(`[IDP RESUBMIT TO MANAGER DEBUG] Current status: ${header.status}`);
  
  const hasAM = !!header.has_am;
  const nextStatus = hasAM ? 'PENDING_AM' : 'PENDING_MANAGER';
  
  // Set status to pending manager/AM review
  await db.query(
    `UPDATE idp_headers SET status = ?, updated_at = NOW() WHERE id = ?`,
    [nextStatus, id]
  );
  
  console.log(`[IDP RESUBMIT TO MANAGER DEBUG] Status updated to ${nextStatus}`);
  
  // Create notifications
  try {
    const [empRows] = await db.query('SELECT name FROM users WHERE id = ?', [header.employee_id]);
    const employeeName = empRows[0]?.name || 'Employee';
    const [supRows] = await db.query('SELECT name FROM users WHERE id = ?', [header.supervisor_id]);
    const supervisorName = supRows[0]?.name || 'Supervisor';
    
    // Notify Manager/AM
    const approverId = hasAM ? header.am_id : header.manager_id;
    if (approverId) {
      await createNotification({
        recipient_id: approverId,
        message: `IDP #${id} for ${employeeName} resubmitted by ${supervisorName} for your review`,
        module: 'IDP'
      }).catch(() => {});
    }
    
    await logRecentAction({
      actor_id: header.supervisor_id,
      module: 'IDP',
      action_type: 'IDP_RESUBMITTED_TO_MANAGER',
      cl_id: null,
      employee_id: header.employee_id,
      title: `Resubmitted IDP to Manager for ${employeeName}`,
      description: `IDP #${id}`,
      url: `/supervisor/idp/view/${id}`,
    }).catch(() => {});
  } catch (e) {
    console.error('IDP resubmit to Manager notifications failed', e);
  }
  
  return await getById(id);
}

// =====================
// CSV EXPORT
// =====================
async function exportIDP({ startDate, endDate, department, status }) {
  console.log('IDP Export Query Params:', { startDate, endDate, department, status });
  
  // First, let's check if there are any IDPs at all
  const [totalCount] = await db.query('SELECT COUNT(*) as count FROM idp_headers');
  console.log('Total IDPs in database:', totalCount[0]?.count || 0);
  
  if (totalCount[0]?.count === 0) {
    return generateEmptyIDPCSV('No IDPs found in database');
  }
  
  // Get comprehensive IDP data including all related tables
  let sql = `
    SELECT 
      ih.id as idp_id,
      ih.status,
      ih.created_at,
      ih.updated_at,
      ih.review_period,
      ih.next_review_date,
      e.employee_id,
      e.name as employee_name,
      e.email as employee_email,
      d.name as department_name,
      p.title as position_title,
      s.name as supervisor_name,
      m.name as manager_name,
      am.name as am_name,
      ih.manager_remarks,
      ih.am_remarks,
      ii.id as item_id,
      ii.competency_id,
      c.name as competency_name,
      c.competency_area,
      ii.target_level,
      ii.timeline_months,
      ii.goal,
      ii.action_plan,
      ii.target_date,
      ii.status as item_status,
      ii.development_action
    FROM idp_headers ih
    JOIN users e ON ih.employee_id = e.id
    LEFT JOIN users s ON ih.supervisor_id = s.id  
    LEFT JOIN users m ON ih.manager_id = m.id
    LEFT JOIN users am ON ih.am_id = am.id
    JOIN departments d ON e.department_id = d.id
    JOIN positions p ON e.position_id = p.id
    LEFT JOIN idp_items ii ON ih.id = ii.idp_header_id
    LEFT JOIN competencies c ON ii.competency_id = c.id
    WHERE 1=1
  `;
  
  const params = [];
  
  // Only add date filter if dates are provided and valid
  if (startDate && endDate) {
    sql += ' AND DATE(ih.created_at) >= DATE(?) AND DATE(ih.created_at) <= DATE(?)';
    params.push(startDate, endDate);
  }
  
  if (department && department !== 'ALL') {
    sql += ' AND d.name = ?';
    params.push(department);
  }
  
  if (status && status !== 'ALL') {
    sql += ' AND ih.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY ih.created_at DESC, ih.id, ii.id';
  
  console.log('Final SQL:', sql);
  console.log('Final Params:', params);
  
  const [rows] = await db.query(sql, params);
  console.log('Query returned', rows.length, 'rows');
  
  // If no data found with filters, try without date filter
  if (rows.length === 0 && startDate && endDate) {
    console.log('No data found with date filters, trying without date restriction...');
    
    let broadSql = `
      SELECT 
        ih.id as idp_id,
        ih.status,
        ih.created_at,
        ih.updated_at,
        ih.review_period,
        ih.next_review_date,
        e.employee_id,
        e.name as employee_name,
        e.email as employee_email,
        d.name as department_name,
        p.title as position_title,
        s.name as supervisor_name,
        m.name as manager_name,
        am.name as am_name,
        ih.manager_remarks,
        ih.am_remarks,
        ii.id as item_id,
        ii.competency_id,
        c.name as competency_name,
        c.competency_area,
        ii.target_level,
        ii.timeline_months,
        ii.goal,
        ii.action_plan,
        ii.target_date,
        ii.status as item_status,
        ii.development_action
      FROM idp_headers ih
      JOIN users e ON ih.employee_id = e.id
      LEFT JOIN users s ON ih.supervisor_id = s.id  
      LEFT JOIN users m ON ih.manager_id = m.id
      LEFT JOIN users am ON ih.am_id = am.id
      JOIN departments d ON e.department_id = d.id
      JOIN positions p ON e.position_id = p.id
      LEFT JOIN idp_items ii ON ih.id = ii.idp_header_id
      LEFT JOIN competencies c ON ii.competency_id = c.id
      WHERE 1=1
    `;
    let broadParams = [];
    
    if (department && department !== 'ALL') {
      broadSql += ' AND d.name = ?';
      broadParams.push(department);
    }
    
    if (status && status !== 'ALL') {
      broadSql += ' AND ih.status = ?';
      broadParams.push(status);
    }
    
    broadSql += ' ORDER BY ih.created_at DESC, ih.id, ii.id LIMIT 100';
    
    const [broadRows] = await db.query(broadSql, broadParams);
    console.log('Broad search returned', broadRows.length, 'rows');
    
    if (broadRows.length > 0) {
      return generateComprehensiveIDPCSV(broadRows, `Note: No data found for ${startDate} to ${endDate}, showing recent IDPs instead`);
    }
  }
  
  return generateComprehensiveIDPCSV(rows);
}

async function generateComprehensiveIDPCSV(rows, note = null) {
  if (rows.length === 0) {
    return generateEmptyIDPCSV(note);
  }

  // Group rows by IDP and items to handle complex data structure
  const idpMap = new Map();
  
  for (const row of rows) {
    if (!idpMap.has(row.idp_id)) {
      idpMap.set(row.idp_id, {
        header: {
          idp_id: row.idp_id,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          review_period: row.review_period,
          next_review_date: row.next_review_date,
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          employee_email: row.employee_email,
          department_name: row.department_name,
          position_title: row.position_title,
          supervisor_name: row.supervisor_name,
          manager_name: row.manager_name,
          am_name: row.am_name,
          manager_remarks: row.manager_remarks,
          am_remarks: row.am_remarks
        },
        items: []
      });
    }
    
    if (row.item_id && row.competency_id) {
      idpMap.get(row.idp_id).items.push({
        item_id: row.item_id,
        competency_id: row.competency_id,
        competency_name: row.competency_name,
        competency_area: row.competency_area,
        target_level: row.target_level,
        timeline_months: row.timeline_months,
        goal: row.goal,
        action_plan: row.action_plan,
        target_date: row.target_date,
        item_status: row.item_status,
        development_action: row.development_action
      });
    }
  }

  // Generate table-structured CSV matching the exact format shown
  const csvRows = [];
  
  // Headers exactly as shown in the table
  const headers = [
    'Section', 'IDP ID', 'Employee', 'Department', 'Status', 'Competency', 
    'Target Level', 'Activity Type', 'Activity Details', 'Quarter', 
    'Completion Status', 'Duration (hrs)', 'Trainer', 'Comments/Remarks', 'Created Date'
  ];
  
  csvRows.push(headers);
  
  if (note) {
    csvRows.push([note, ...Array(headers.length - 1).fill('')]);
  }
  
  for (const [idpId, idpData] of idpMap.entries()) {
    const header = idpData.header;
    
    // IDP SUMMARY row
    csvRows.push([
      'IDP SUMMARY',
      header.idp_id,
      `${header.employee_name} (${header.employee_id})`,
      header.department_name || '',
      header.status || '',
      `${idpData.items.length} Competencies`,
      '',
      header.supervisor_name ? `Supervisor: ${header.supervisor_name}` : '',
      [header.manager_remarks, header.am_remarks].filter(Boolean).join(' | '),
      '',
      '',
      '',
      '',
      [header.manager_remarks, header.am_remarks].filter(Boolean).join(' | '),
      header.created_at ? new Date(header.created_at).toISOString().split('T')[0] : ''
    ]);

    // Process each competency
    for (let i = 0; i < idpData.items.length; i++) {
      const item = idpData.items[i];
      
      // Parse development action
      let developmentAction = null;
      if (item.development_action) {
        try {
          developmentAction = typeof item.development_action === 'string' 
            ? JSON.parse(item.development_action) 
            : item.development_action;
        } catch (e) {
          console.error('Failed to parse development_action for item:', item.item_id);
        }
      }

      // COMPETENCY row
      csvRows.push([
        `COMPETENCY ${i + 1}`,
        '',
        '',
        '',
        '',
        item.competency_name || '',
        item.target_level || '',
        developmentAction?.type || '',
        developmentAction?.activity || '',
        '',
        developmentAction?.status || developmentAction?.completionStatus || '',
        '',
        '',
        [item.action_plan, item.goal].filter(Boolean).join(' | '),
        ''
      ]);

      // Get and add extra tables (activities)
      const [extraTables] = await db.query(
        `SELECT * FROM idp_extra_tables WHERE idp_item_id = ? ORDER BY id`,
        [item.item_id]
      );

      for (let j = 0; j < extraTables.length; j++) {
        const extraTable = extraTables[j];
        
        // ACTIVITY row
        csvRows.push([
          `ACTIVITY ${j + 1}`,
          '',
          '',
          '',
          '',
          '',
          '',
          'Experience/Exposure',
          extraTable.development_activity || '',
          extraTable.quarter || '',
          extraTable.completion_status || '',
          '',
          '',
          [
            extraTable.expected_results && `Expected: ${extraTable.expected_results}`,
            extraTable.learning && `Learning: ${extraTable.learning}`, 
            extraTable.sharing_method && `Sharing: ${extraTable.sharing_method}`,
            extraTable.application_method && `Application: ${extraTable.application_method}`
          ].filter(Boolean).join(' | '),
          ''
        ]);

        // Get and add areas of exposure
        const [areasOfExposure] = await db.query(
          `SELECT * FROM idp_areas_of_exposure WHERE extra_table_id = ? ORDER BY id`,
          [extraTable.id]
        );

        // EXPOSURE rows
        for (const area of areasOfExposure) {
          csvRows.push([
            'EXPOSURE',
            '',
            '',
            '',
            '',
            '',
            '',
            'Area of Exposure',
            area.area || '',
            '',
            area.status || '',
            area.duration_hours || '',
            area.trainer_name || '',
            area.comments || '',
            area.datetime ? new Date(area.datetime).toISOString().split('T')[0] : ''
          ]);
        }
      }
    }

    // Empty separator row between IDPs
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

function generateEmptyIDPCSV(note = null) {
  const headers = [
    'IDP ID', 'Status', 'Created Date', 'Updated Date', 'Review Period', 'Next Review Date',
    'Employee ID', 'Employee Name', 'Employee Email', 'Department', 'Position',
    'Supervisor', 'Manager', 'Assistant Manager', 'Manager Remarks', 'AM Remarks',
    'Item ID', 'Competency ID', 'Competency Name', 'Competency Area', 'Target Level', 
    'Timeline (Months)', 'Goal', 'Action Plan', 'Target Date', 'Item Status',
    'Activity Type', 'Activity Name', 'Activity Target Date', 'Activity Actual Date', 
    'Activity Status', 'Activity Score', 'Expected Results', 'Sharing Method', 
    'Application Method', 'PDF Path', 'Education Justification PDF',
    'Extra Table ID', 'Quarter', 'Extra Development Activity', 'Extra Target Completion', 
    'Extra Actual Completion', 'Extra Completion Status', 'Extra Score', 'Extra Expected Results',
    'Extra Sharing Method', 'Extra Application Method', 'Extra PDF Path', 'Extra Education PDF',
    'Exposure Start Date', 'Learning',
    'Area ID', 'Exposure Area', 'Exposure Status', 'Exposure DateTime', 'Duration Hours', 
    'Trainer Name', 'Area Comments'
  ];
  
  let csv = headers.join(',') + '\n';
  
  if (note) {
    csv += `"${note}",${','.repeat(headers.length - 1)}\n`;
  } else {
    csv += '"No data found",' + ','.repeat(headers.length - 1) + '\n';
  }
  
  return csv;
}

// HR: explicitly mark IDP as FOR_COMPLETION (HR chooses to send back for completion)
async function hrApproveForCompletion(idpId, hrId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM idp_headers WHERE id = ? AND status IN (?, ?)', [idpId, 'PENDING_HR', 'FOR_COMPLETION']);
    if (rows.length === 0) throw new Error('IDP not found or not available for HR completion approval.');

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
        // Create one entry per development activity
        if (Array.isArray(item.developmentActivities)) {
          for (const activity of item.developmentActivities) {
            const [itemResult] = await conn.query(
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
            
            const itemId = itemResult.insertId;

            // 3. Create extra tables (for Experience/Exposure activities)
            if (Array.isArray(item.extraTables)) {
              for (const extraTable of item.extraTables) {
                const [extraResult] = await conn.query(
                  `INSERT INTO idp_extra_tables
                    (idp_item_id, quarter, development_activity, target_completion_date, actual_completion_date, 
                     completion_status, score, expected_results, sharing_method, application_method, 
                     pdf_path, education_justification_pdf, exposure_start_date, learning, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                  [
                    itemId,
                    extraTable.quarter || null,
                    extraTable.developmentActivity || null,
                    extraTable.targetCompletionDate || null,
                    extraTable.actualCompletionDate || null,
                    extraTable.completionStatus || null,
                    extraTable.score || 1,
                    extraTable.expectedResults || null,
                    extraTable.sharingMethod || null,
                    extraTable.applicationMethod || null,
                    extraTable.pdfPath || null,
                    extraTable.educationJustificationPdf || null,
                    extraTable.exposureStartDate || null,
                    extraTable.learning || null
                  ]
                );
                
                const extraTableId = extraResult.insertId;

                // 4. Create areas of exposure
                if (Array.isArray(extraTable.areasOfExposure)) {
                  for (const area of extraTable.areasOfExposure) {
                    await conn.query(
                      `INSERT INTO idp_areas_of_exposure
                        (extra_table_id, area, status, datetime, duration_hours, trainer_name, comments, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                      [
                        extraTableId,
                        area.area || null,
                        area.status || 'Not Started',
                        area.datetime || null,
                        area.durationHours || null,
                        area.trainerName || null,
                        area.comments || null
                      ]
                    );
                  }
                }
              }
            }
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

module.exports = {
  getById,
  create,
  createWithItems,
  update,
  submit,
  resubmitToHR,
  resubmitToManager,
  getEmployeesForIDPCreation,
  getIDPsGroupedByStatus,
  getIDPsGroupedByManager,
  deleteById,
  getIDPsPendingManager,
  managerReturnIDP,
  managerApprove,
  getIDPsPendingAM,
  amApprove,
  amReturnIDP,
  getIDPsForEmployee,
  getHRIncoming,
  employeeApprove,
  employeeReturn,
  hrApprove,
  hrApproveForCompletion,
  hrForceCycleComplete,
  hrReturn,
  exportIDP,
};
