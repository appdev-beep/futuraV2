const clService = require('../services/cl.service');
const { db } = require('../config/db'); 
const path = require('path');
const { logRecentAction } = require('../services/recentActions.service');

// =====================================================
// NOTIFICATION HELPERS
// =====================================================
async function createNotification({ recipientId, message, module = 'Competency Leveling' }) {
  if (!recipientId) return;

  await db.query(
    `INSERT INTO notifications (recipient_id, message, module, status, created_at)
     VALUES (?, ?, ?, 'Unread', NOW())`,
    [recipientId, message, module]
  );
}

async function getCLHeaderBasic(clId) {
  const [rows] = await db.query(
    `SELECT h.id, h.status, h.department_id, h.employee_id, h.supervisor_id, h.has_assistant_manager,
            e.name as employee_name, e.employee_id as employee_code,
            s.name as supervisor_name
     FROM cl_headers h
     LEFT JOIN users e ON h.employee_id = e.id
     LEFT JOIN users s ON h.supervisor_id = s.id
     WHERE h.id = ?
     LIMIT 1`,
    [clId]
  );
  return rows.length ? rows[0] : null;
}

async function findUserByRoleAndDepartment(role, departmentId) {
  const [rows] = await db.query(
    `SELECT id, name, role
     FROM users
     WHERE role = ? AND department_id = ? AND is_active = 1
     LIMIT 1`,
    [role, departmentId]
  );
  return rows.length ? rows[0] : null;
}

// HR might be global in some orgs, so fallback to any active HR if none in dept
async function findAnyActiveUserByRole(role) {
  const [rows] = await db.query(
    `SELECT id, name, role
     FROM users
     WHERE role = ? AND is_active = 1
     LIMIT 1`,
    [role]
  );
  return rows.length ? rows[0] : null;
}

async function resolveRecipientFromStatus(clHeader) {
  if (!clHeader) return null;

  const { status, department_id, employee_id, supervisor_id } = clHeader;

  // Route based on your cl_header_status enum
  if (status === 'PENDING_AM') {
    return (await findUserByRoleAndDepartment('AM', department_id)) || null;
  }
  if (status === 'PENDING_MANAGER') {
    return (await findUserByRoleAndDepartment('Manager', department_id)) || null;
  }
  if (status === 'PENDING_HR') {
    return (await findUserByRoleAndDepartment('HR', department_id)) ||
           (await findAnyActiveUserByRole('HR')) ||
           null;
  }
  if (status === 'PENDING_EMPLOYEE') {
    return { id: employee_id, role: 'Employee' };
  }

  // If returned to DRAFT, usually supervisor fixes it
  if (status === 'DRAFT') {
    return { id: supervisor_id, role: 'Supervisor' };
  }

  return null;
}

async function notifyNextByCurrentStatus(clId, actorRole, actionText, remarks = null) {
  const clHeader = await getCLHeaderBasic(clId);
  if (!clHeader) return;

  const recipient = await resolveRecipientFromStatus(clHeader);
  if (!recipient?.id) return;

  const employeeInfo = clHeader.employee_name 
    ? `${clHeader.employee_name} (${clHeader.employee_code || 'N/A'})`
    : `Employee ID ${clHeader.employee_id}`;

  let notificationMessage = `CL #${clId} for ${employeeInfo} ${actionText}. Current status: ${clHeader.status}. (Action by: ${actorRole})`;
  
  // Add remarks to notification if provided
  if (remarks && remarks.trim()) {
    notificationMessage += `\n\nRemarks: ${remarks}`;
  }

  await createNotification({
    recipientId: recipient.id,
    module: 'Competency Leveling',
    message: notificationMessage
  });
}

// =====================================================
// GET CL BY ID
// =====================================================
async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const cl = await clService.getById(id);
    if (!cl) return res.status(404).json({ message: 'CL not found' });

    res.json(cl);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// CREATE CL (Supervisor creates, auto-route to AM or Manager)
// + NOTIFY next approver
// =====================================================
async function create(req, res, next) {
  try {
    const { employee_id, supervisor_id, department_id, cycle_id } = req.body;

    if (!employee_id || !supervisor_id || !department_id || !cycle_id) {
      return res.status(400).json({
        message:
          'employee_id, supervisor_id, department_id and cycle_id are required'
      });
    }

    // 1. Create the CL (initially DRAFT inside service)
    const result = await clService.create({
      employee_id,
      supervisor_id,
      department_id,
      cycle_id
    });

    const clId = result.id;

    // 2. Check if the department has an Assistant Manager
    const [deptRows] = await db.query(
      `SELECT has_am FROM departments WHERE id = ?`,
      [department_id]
    );

    const hasAM = deptRows.length && deptRows[0].has_am === 1;
    const nextStatus = hasAM ? 'PENDING_AM' : 'PENDING_MANAGER';

    // 3. Update CL status to the correct workflow step
    await db.query(
      `UPDATE cl_headers SET status = ?, updated_at = NOW() WHERE id = ?`,
      [nextStatus, clId]
    );

    // 4. Notify next person
    //    (whoever receives the CL right after creation)
    await notifyNextByCurrentStatus(
      clId,
      req.user?.role || 'Supervisor',
      'was created and routed to you for review',
      null // No remarks on creation
    );

    // 5. Return updated information to frontend
    res.status(201).json({
      id: clId,
      status: nextStatus,
      routedTo: hasAM ? 'Assistant Manager' : 'Manager'
    });
  } catch (err) {
    next(err);
  }
}

// =====================================================
// UPDATE CL ITEMS
// =====================================================
async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { items } = req.body;
    const updated = await clService.update(id, { items: items || [] });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// SUBMIT CL (for next workflow step)
// Save supervisor remarks, then let service handle status logic
// + NOTIFY whoever is next (based on new status)
// =====================================================
async function submit(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body || {};

    console.log('CL SUBMIT body:', { id, remarks });

    const result = await clService.submit(id, remarks || null);

    // Notify next approver/recipient after submit
    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'Supervisor',
      'was submitted and is now waiting for you',
      remarks
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// SUPERVISOR DASHBOARD
// =====================================================
async function getSupervisorSummary(req, res, next) {
  try {
    const summary = await clService.getSupervisorSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function getSupervisorAllCL(req, res, next) {
  try {
    const grouped = await clService.getSupervisorAllCL(req.user.id);
    res.json(grouped);
  } catch (err) {
    next(err);
  }
}

async function getSupervisorPending(req, res, next) {
  try {
    const rows = await clService.getSupervisorPending(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// MANAGER DASHBOARD
// =====================================================
async function getManagerSummary(req, res, next) {
  try {
    const summary = await clService.getManagerSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function getManagerPending(req, res, next) {
  try {
    const rows = await clService.getManagerPending(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getManagerAllCL(req, res, next) {
  try {
    const rows = await clService.getManagerAllCL(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// EMPLOYEE COMPETENCIES (used by StartCLPage)
// =====================================================
async function getCompetenciesForEmployee(req, res, next) {
  try {
    const employeeId = Number(req.params.id);
    if (!employeeId)
      return res.status(400).json({ message: 'Invalid employee id' });

    const data = await clService.getCompetenciesForEmployee(employeeId);
    if (!data) return res.status(404).json({ message: 'Employee not found' });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// UPLOAD JUSTIFICATION PDF
// POST /api/cl/upload
// =====================================================
async function uploadJustificationFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const relativePath = path.posix.join('uploads', req.file.filename);

    return res.json({
      filePath: relativePath,
    });
  } catch (err) {
    next(err);
  }
}

// =====================================================
// DELETE CL (Supervisor can delete their own CLs)
// History will be preserved in recent_actions
// =====================================================
async function deleteCL(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const [rows] = await db.query(
      `SELECT 
        h.id, h.supervisor_id, h.status, h.employee_id,
        e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers h
       LEFT JOIN users e ON h.employee_id = e.id
       WHERE h.id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'CL not found' });
    }

    const cl = rows[0];

    // Only the supervisor who created it can delete
    if (cl.supervisor_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: 'You can only delete your own CLs' });
    }

    // Log to recent actions before deletion
    await logRecentAction({
      actor_id: req.user.id,
      module: 'CL',
      action_type: 'DELETE',
      cl_id: id,
      employee_id: cl.employee_id,
      title: `Deleted CL #${id}`,
      description: `Deleted Competency Leveling for ${cl.employee_name || 'Employee'} (${cl.employee_code || 'N/A'}). Status was: ${cl.status}`,
      url: `/supervisor`
    });

    // Delete all related records first (to avoid foreign key constraint errors)
    // Delete in order of dependencies
    await db.query(`DELETE FROM cl_manager_logs WHERE cl_id = ?`, [id]);
    await db.query(`DELETE FROM cl_employee_logs WHERE cl_id = ?`, [id]);
    await db.query(`DELETE FROM cl_hr_logs WHERE cl_id = ?`, [id]);
    await db.query(`DELETE FROM cl_approvals WHERE cl_header_id = ?`, [id]);
    await db.query(`DELETE FROM cl_items WHERE cl_header_id = ?`, [id]);
    
    // Finally delete the CL header
    await db.query(`DELETE FROM cl_headers WHERE id = ?`, [id]);

    res.json({ message: 'CL deleted successfully', id });
  } catch (err) {
    next(err);
  }
}

// =====================================================
// MANAGER ACTIONS: APPROVE / RETURN
// + NOTIFY next recipient
// =====================================================
async function managerApprove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body || {};

    // Get CL details for logging
    const [clDetails] = await db.query(
      `SELECT h.id, h.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers h
       LEFT JOIN users e ON h.employee_id = e.id
       WHERE h.id = ?`,
      [id]
    );

    const result = await clService.managerApprove(
      id,
      req.user.id,
      remarks || null
    );

    // Log recent action
    if (clDetails.length > 0) {
      const cl = clDetails[0];
      await logRecentAction({
        actor_id: req.user.id,
        module: 'CL',
        action_type: 'APPROVE',
        cl_id: id,
        employee_id: cl.employee_id,
        title: `Approved CL #${id}`,
        description: `Approved Competency Leveling for ${cl.employee_name || 'Employee'} (${cl.employee_code || 'N/A'})`,
        url: `/cl/submissions/${id}`
      });
    }

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'Manager',
      'was approved and moved forward',
      remarks
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function managerReturn(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body;
    if (!remarks) return res.status(400).json({ message: 'Remarks are required' });

    // Get CL details for logging
    const [clDetails] = await db.query(
      `SELECT h.id, h.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers h
       LEFT JOIN users e ON h.employee_id = e.id
       WHERE h.id = ?`,
      [id]
    );

    const result = await clService.managerReturn(id, req.user.id, remarks);

    // Log recent action
    if (clDetails.length > 0) {
      const cl = clDetails[0];
      await logRecentAction({
        actor_id: req.user.id,
        module: 'CL',
        action_type: 'RETURN',
        cl_id: id,
        employee_id: cl.employee_id,
        title: `Returned CL #${id}`,
        description: `Returned Competency Leveling for ${cl.employee_name || 'Employee'} (${cl.employee_code || 'N/A'}) for revision`,
        url: `/cl/submissions/${id}`
      });
    }

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'Manager',
      'was returned for revision',
      remarks
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// EMPLOYEE DASHBOARD
// =====================================================
async function getEmployeePending(req, res, next) {
  try {
    const rows = await clService.getEmployeePending(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// AM DASHBOARD
// =====================================================
async function getAMSummary(req, res, next) {
  try {
    const summary = await clService.getAMSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function getAMPending(req, res, next) {
  try {
    const rows = await clService.getAMPending(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// HR DASHBOARD
// =====================================================
async function getHRSummary(req, res, next) {
  try {
    const departmentName = req.query.department || null;
    const summary = await clService.getHRSummary(req.user.id, departmentName);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function getHRPending(req, res, next) {
  try {
    const rows = await clService.getHRPending(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getHRAllCL(req, res, next) {
  try {
    const rows = await clService.getHRAllCL(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getHRIncomingCL(req, res, next) {
  try {
    const rows = await clService.getHRIncomingCL();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// AM APPROVAL ACTIONS
// + NOTIFY next recipient
// =====================================================
async function amApprove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const result = await clService.amApprove(id, req.user.id, '');

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'AM',
      'was approved and moved forward',
      '' // AM doesn't use remarks for approval
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function amReturn(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body;
    if (!remarks) return res.status(400).json({ message: 'Remarks are required' });

    const result = await clService.amReturn(id, req.user.id, remarks);

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'AM',
      'was returned for revision',
      remarks
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// EMPLOYEE APPROVAL ACTIONS
// + NOTIFY next recipient
// =====================================================
async function employeeApprove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body || {};

    // Get CL details for logging
    const [clDetails] = await db.query(
      `SELECT h.id, h.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers h
       LEFT JOIN users e ON h.employee_id = e.id
       WHERE h.id = ?`,
      [id]
    );

    const result = await clService.employeeApprove(
      id,
      req.user.id,
      remarks || null
    );

    // Log recent action
    if (clDetails.length > 0) {
      const cl = clDetails[0];
      await logRecentAction({
        actor_id: req.user.id,
        module: 'CL',
        action_type: 'APPROVE',
        cl_id: id,
        employee_id: cl.employee_id,
        title: `Approved CL #${id}`,
        description: `Approved Competency Leveling for ${cl.employee_name || 'Employee'} (${cl.employee_code || 'N/A'})`,
        url: `/cl/employee/review/${id}`
      });
    }

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'Employee',
      'was approved and moved forward',
      remarks
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function employeeReturn(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body || {};
    if (!remarks) {
      return res.status(400).json({ message: 'Remarks are required' });
    }

    // Get CL details for logging
    const [clDetails] = await db.query(
      `SELECT h.id, h.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers h
       LEFT JOIN users e ON h.employee_id = e.id
       WHERE h.id = ?`,
      [id]
    );

    const result = await clService.employeeReturn(
      id,
      req.user.id,
      remarks
    );

    // Log recent action
    if (clDetails.length > 0) {
      const cl = clDetails[0];
      await logRecentAction({
        actor_id: req.user.id,
        module: 'CL',
        action_type: 'RETURN',
        cl_id: id,
        employee_id: cl.employee_id,
        title: `Returned CL #${id}`,
        description: `Returned Competency Leveling for ${cl.employee_name || 'Employee'} (${cl.employee_code || 'N/A'}) for revision`,
        url: `/cl/employee/review/${id}`
      });
    }

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'Employee',
      'was returned for revision',
      remarks
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// HR APPROVAL ACTIONS
// + NOTIFY next recipient
// =====================================================
async function hrApprove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body || {};

    // Get CL details for logging
    const [clDetails] = await db.query(
      `SELECT h.id, h.employee_id, h.supervisor_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers h
       LEFT JOIN users e ON h.employee_id = e.id
       WHERE h.id = ?`,
      [id]
    );

    const clHeader = clDetails.length > 0 ? clDetails[0] : null;
    if (!clHeader) {
      return res.status(404).json({ message: 'CL not found' });
    }

    const employeeInfo = clHeader.employee_name 
      ? `${clHeader.employee_name} (${clHeader.employee_code || 'N/A'})`
      : `Employee ID ${clHeader.employee_id}`;

    const result = await clService.hrApprove(
      id,
      req.user.id,
      remarks || null
    );

    // Log recent action
    await logRecentAction({
      actor_id: req.user.id,
      module: 'CL',
      action_type: 'APPROVE',
      cl_id: id,
      employee_id: clHeader.employee_id,
      title: `Approved CL #${id}`,
      description: `Approved Competency Leveling for ${clHeader.employee_name || 'Employee'} (${clHeader.employee_code || 'N/A'})`,
      url: `/cl/hr/review/${id}`
    });

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'HR',
      'was approved',
      req.body.remarks
    );

    // Notify employee
    await createNotification({
      recipientId: clHeader.employee_id,
      module: 'Competency Leveling',
      message: `CL #${id} for ${employeeInfo} has been fully approved.`
    });

    // Notify supervisor
    if (clHeader.supervisor_id) {
      await createNotification({
        recipientId: clHeader.supervisor_id,
        module: 'Competency Leveling',
        message: `CL #${id} for ${employeeInfo} has been fully approved by HR.`
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function hrReturn(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body || {};
    if (!remarks) {
      return res.status(400).json({ message: 'Remarks are required' });
    }

    // Get CL details for logging
    const [clDetails] = await db.query(
      `SELECT h.id, h.employee_id, e.name as employee_name, e.employee_id as employee_code
       FROM cl_headers h
       LEFT JOIN users e ON h.employee_id = e.id
       WHERE h.id = ?`,
      [id]
    );

    const result = await clService.hrReturn(
      id,
      req.user.id,
      remarks
    );

    // Log recent action
    if (clDetails.length > 0) {
      const cl = clDetails[0];
      await logRecentAction({
        actor_id: req.user.id,
        module: 'CL',
        action_type: 'RETURN',
        cl_id: id,
        employee_id: cl.employee_id,
        title: `Returned CL #${id}`,
        description: `Returned Competency Leveling for ${cl.employee_name || 'Employee'} (${cl.employee_code || 'N/A'}) for revision`,
        url: `/cl/hr/review/${id}`
      });
    }

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'HR',
      'was returned for revision',
      remarks
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// EMPLOYEE CL HISTORY
// =====================================================
async function getEmployeeHistory(req, res, next) {
  try {
    const employeeId = Number(req.params.id);
    if (!employeeId) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const rows = await clService.getEmployeeHistory(employeeId);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getMyHistory(req, res, next) {
  try {
    const employeeId = req.user.id;
    const rows = await clService.getEmployeeHistory(employeeId);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// =====================================================
// GET CL AUDIT TRAIL
// =====================================================
async function getCLAuditTrail(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const trail = await clService.getCLAuditTrail(id);
    res.json(trail);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getById,
  create,
  update,
  submit,
  deleteCL,

  // Supervisor
  getSupervisorSummary,
  getSupervisorAllCL,
  getSupervisorPending,

  // Employee history
  getEmployeeHistory,
  getMyHistory,

  // Manager
  getManagerSummary,
  getManagerPending,
  getManagerAllCL,

  // Employee dashboard
  getEmployeePending,

  // AM
  getAMSummary,
  getAMPending,

  // HR
  getHRSummary,
  getHRPending,
  getHRAllCL,
  getHRIncomingCL,

  // Misc
  getCompetenciesForEmployee,
  uploadJustificationFile,

  // Actions
  managerApprove,
  managerReturn,
  amApprove,
  amReturn,
  employeeApprove,
  employeeReturn,
  hrApprove,
  hrReturn,
  getCLAuditTrail,
};
