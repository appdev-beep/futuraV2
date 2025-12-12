const clService = require('../services/cl.service');
const { db } = require('../config/db'); 
const path = require('path');           

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
    `SELECT id, status, department_id, employee_id, supervisor_id, has_assistant_manager
     FROM cl_headers
     WHERE id = ?
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

async function notifyNextByCurrentStatus(clId, actorRole, actionText) {
  const clHeader = await getCLHeaderBasic(clId);
  if (!clHeader) return;

  const recipient = await resolveRecipientFromStatus(clHeader);
  if (!recipient?.id) return;

  await createNotification({
    recipientId: recipient.id,
    module: 'Competency Leveling',
    message: `CL #${clId} ${actionText}. Current status: ${clHeader.status}. (Action by: ${actorRole})`
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
      'was created and routed to you for review'
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
      'was submitted and is now waiting for you'
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
// but ONLY if there is no manager history
// =====================================================
async function deleteCL(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const [rows] = await db.query(
      `SELECT id, supervisor_id, status FROM cl_headers WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'CL not found' });
    }

    const cl = rows[0];

    if (cl.supervisor_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: 'You can only delete your own CLs' });
    }

    if (cl.status !== 'DRAFT') {
      return res.status(400).json({
        message: 'You can only delete CLs that are still in DRAFT status.'
      });
    }

    const [logRows] = await db.query(
      `SELECT 1 FROM cl_manager_logs WHERE cl_id = ? LIMIT 1`,
      [id]
    );

    if (logRows.length > 0) {
      return res.status(400).json({
        message:
          'This CL already has Manager actions (approve/return). It cannot be deleted because there is history attached.'
      });
    }

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

    const result = await clService.managerApprove(
      id,
      req.user.id,
      remarks || null
    );

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'Manager',
      'was approved and moved forward'
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

    const result = await clService.managerReturn(id, req.user.id, remarks);

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'Manager',
      'was returned for revision'
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
    const summary = await clService.getHRSummary(req.user.id);
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
      'was approved and moved forward'
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
      'was returned for revision'
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

    const result = await clService.employeeApprove(
      id,
      req.user.id,
      remarks || null
    );

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'Employee',
      'was approved and moved forward'
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

    const result = await clService.employeeReturn(
      id,
      req.user.id,
      remarks
    );

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'Employee',
      'was returned for revision'
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

    const result = await clService.hrApprove(
      id,
      req.user.id,
      remarks || null
    );

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'HR',
      'was approved'
    );

    // Optional: if final APPROVED, also notify employee explicitly
    const clHeader = await getCLHeaderBasic(id);
    if (clHeader?.status === 'APPROVED') {
      await createNotification({
        recipientId: clHeader.employee_id,
        module: 'Competency Leveling',
        message: `CL #${id} has been fully approved.`
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

    const result = await clService.hrReturn(
      id,
      req.user.id,
      remarks
    );

    await notifyNextByCurrentStatus(
      id,
      req.user?.role || 'HR',
      'was returned for revision'
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
};
