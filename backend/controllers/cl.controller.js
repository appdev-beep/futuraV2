const clService = require('../services/cl.service');
const { db } = require('../config/db'); // Needed to check department has_am
const path = require('path');           // 👈 NEW for building file path

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
// (currently thin wrapper around clService.submit)
// =====================================
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

    // 👉 pass remarks into the service
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
      filePath: relativePath, // 👈 this is what FE stores as pdf_path
    });
  } catch (err) {
    next(err);
  }
}

// =====================================
// DELETE CL (Supervisor can delete their own CLs)
// =====================================
async function deleteCL(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    // Get CL to check ownership
    const [rows] = await db.query(
      `SELECT id, supervisor_id, status FROM cl_headers WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'CL not found' });
    }

    const cl = rows[0];

    // Only allow supervisor to delete their own CLs
    if (cl.supervisor_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own CLs' });
    }

    // Delete the CL (will cascade delete cl_items due to FK constraint)
    await db.query(`DELETE FROM cl_headers WHERE id = ?`, [id]);

    res.json({ message: 'CL deleted successfully', id });
  } catch (err) {
    next(err);
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
      remarks || null      // 👈 pass through
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
// controller: employeeApprove
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
      remarks || null   // 👈 pass remarks
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
      remarks        // 👈 pass remarks
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}


// =====================================
// HR APPROVAL ACTIONS
// =====================================
// controllers/cl.controller.js

async function hrApprove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid CL id' });

    const { remarks } = req.body || {};

    const result = await clService.hrApprove(id, req.user.id, remarks || null);
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
    if (!remarks) return res.status(400).json({ message: 'Remarks are required' });

    const result = await clService.hrReturn(id, req.user.id, remarks);
    res.json(result);
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
  getSupervisorSummary,
  getSupervisorAllCL,
  getSupervisorPending,
  getManagerSummary,
  getManagerPending,
  getEmployeePending,
  getAMSummary,
  getAMPending,
  getHRSummary,
  getHRPending,
  getCompetenciesForEmployee,
  uploadJustificationFile,
  managerApprove,
  managerReturn,
  amApprove,
  amReturn,
  employeeApprove,
  employeeReturn,
  hrApprove,
  hrReturn,
};
