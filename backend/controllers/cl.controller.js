const clService = require('../services/cl.service');
const { db } = require('../config/db'); // Needed to check department has_am
const path = require('path');           // for building file path

// =====================================
// GET CL BY ID
// =====================================
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

// =====================================
// CREATE CL (Supervisor creates, auto-route to AM or Manager)
// =====================================
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

    // 4. Return updated information to frontend
    res.status(201).json({
      id: clId,
      status: nextStatus,
      routedTo: hasAM ? 'Assistant Manager' : 'Manager'
    });
  } catch (err) {
    next(err);
  }
}

// =====================================
// UPDATE CL ITEMS
// =====================================
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

// =====================================
// SUBMIT CL (for next workflow step)
// Save supervisor remarks, then let service handle status logic
// =====================================
async function submit(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body || {};

    console.log('CL SUBMIT body:', { id, remarks });

    const result = await clService.submit(id, remarks || null);

    res.json(result);
  } catch (err) {
    next(err);
  }










  




}

// =====================================
// SUPERVISOR DASHBOARD
// =====================================
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

// =====================================
// MANAGER DASHBOARD
// =====================================
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

// MANAGER ALL / HISTORY
async function getManagerAllCL(req, res, next) {
  try {
    const rows = await clService.getManagerAllCL(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// GET all CLs for manager's department
async function getManagerDepartmentCL(req, res, next) {
  try {
    const managerId = req.user.id;
    const rows = await clService.getManagerDepartmentCL(managerId);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// HR incoming CLs (all departments)
async function getHRIncomingCL(req, res, next) {
  try {
    const rows = await clService.getHRIncomingCL();
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// =====================================
// EMPLOYEE COMPETENCIES (used by StartCLPage)
// =====================================
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

// =====================================
// UPLOAD JUSTIFICATION PDF
// POST /api/cl/upload
// =====================================
async function uploadJustificationFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // This builds a relative path like "uploads/myfile_12345.pdf"
    const relativePath = path.posix.join('uploads', req.file.filename);

    return res.json({
      filePath: relativePath, // this is what FE stores as pdf_path
    });
  } catch (err) {
    next(err);
  }
}

// =====================================
// DELETE CL (Supervisor can delete their own CLs)
// =====================================
// =====================================
// DELETE CL (Supervisor can delete their own CLs)
// =====================================
async function deleteCL(req, res, next) {
  const conn = await db.getConnection();
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    // Get CL details before deleting for logging
    const [clRows] = await conn.query(
      `SELECT ch.id, ch.status, e.id as employee_id, e.name as employee_name
       FROM cl_headers ch
       JOIN users e ON ch.employee_id = e.id
       WHERE ch.id = ?`,
      [id]
    );

    if (!clRows.length) {
      return res.status(404).json({ message: 'CL not found' });
    }

    const cl = clRows[0];

    await conn.beginTransaction();

    // Delete all related records first to avoid foreign key constraint errors
    await conn.query('DELETE FROM cl_employee_logs WHERE cl_id = ?', [id]);
    await conn.query('DELETE FROM cl_manager_logs WHERE cl_id = ?', [id]);
    await conn.query('DELETE FROM cl_hr_logs WHERE cl_id = ?', [id]);
    await conn.query('DELETE FROM cl_items WHERE cl_header_id = ?', [id]);
    await conn.query('DELETE FROM cl_approvals WHERE cl_header_id = ?', [id]);
    await conn.query('DELETE FROM notifications WHERE message LIKE ?', [`%CL #${id}%`]);
    // ✅ DO NOT DELETE recent_actions - they are permanent audit logs
    await conn.query('DELETE FROM cl_headers WHERE id = ?', [id]);

    // Log deletion to recent actions
    await conn.query(
      `INSERT INTO recent_actions (actor_id, module, action_type, cl_id, employee_id, title, description, url, created_at)
       VALUES (?, 'CL', 'CL_DELETED', NULL, ?, ?, ?, NULL, NOW())`,
      [
        req.user.id,
        cl.employee_id,
        `Deleted CL for ${cl.employee_name}`,
        `CL #${id} (was in ${cl.status} status)`
      ]
    );

    await conn.commit();
    res.json({ message: 'CL deleted successfully', id });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// =====================================
// MANAGER ACTIONS: APPROVE / RETURN
// =====================================
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
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================
// EMPLOYEE DASHBOARD
// =====================================
async function getEmployeePending(req, res, next) {
  try {
    const rows = await clService.getEmployeePending(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// =====================================
// AM DASHBOARD
// =====================================
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

// =====================================
// HR DASHBOARD
// =====================================
// AM DASHBOARD: Use manager logic for now
async function getAMAllCL(req, res, next) {
  // Reuse manager logic for AM
  return getManagerAllCL(req, res, next);
}

async function getAMDepartmentCL(req, res, next) {
  // Reuse manager logic for AM
  return getManagerDepartmentCL(req, res, next);
}
async function getHRSummary(req, res, next) {
  try {
    const department = req.query.department || null;
    const summary = await clService.getHRSummary(req.user.id, department);
  getAMAllCL,
  getAMDepartmentCL,
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

// HR ALL / HISTORY
async function getHRAllCL(req, res, next) {
  try {
    const rows = await clService.getHRAllCL(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// =====================================
// AM APPROVAL ACTIONS
// =====================================
async function amApprove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const result = await clService.amApprove(id, req.user.id, '');
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
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================
// EMPLOYEE APPROVAL ACTIONS
// =====================================
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
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================
// HR APPROVAL ACTIONS
// =====================================
async function hrApprove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body || {};

    const result = await clService.hrApprove(
      id,
      req.user.id,        // approverId
      remarks || null
    );

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
      req.user.id,        // approverId
      remarks
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================
// EMPLOYEE CL HISTORY (used by StartCLPage & others)
// GET /api/cl/employee/:id/history
// =====================================
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

// GET CL audit trail
async function getCLAuditTrail(req, res, next) {
  try {
    const clId = Number(req.params.id);
    if (!clId) return res.status(400).json({ message: 'Invalid CL id' });

    const trail = await clService.getCLAuditTrail(clId);
    res.json(trail);
  } catch (err) {
    next(err);
  }
}

// =====================================
// MY CL HISTORY (for logged-in Employee)
// GET /api/cl/employee/my/history
// =====================================
async function getMyHistory(req, res, next) {
  try {
    const employeeId = req.user.id; // logged-in user
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
  getManagerDepartmentCL,

  // Employee dashboard
  getEmployeePending,

  // AM
  getAMSummary,
  getAMPending,
  getAMAllCL,
  getAMDepartmentCL,

  // HR
  getHRSummary,
  getHRPending,
  getHRAllCL,
  getHRIncomingCL,

  // Misc
  getCompetenciesForEmployee,
  uploadJustificationFile,

  // Audit
  getCLAuditTrail,

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
