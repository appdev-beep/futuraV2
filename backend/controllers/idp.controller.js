// PUT /api/idp/:id/manager/return
// Body: { remarks }
async function managerReturnIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid IDP id' });
    }
    const { remarks } = req.body;
    if (!remarks) {
      return res.status(400).json({ message: 'Remarks are required.' });
    }
    const managerId = req.user.id;
    const result = await idpService.managerReturnIDP(id, managerId, remarks);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
// PUT /api/idp/:id/manager/approve
async function managerApproveIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid IDP id' });
    const managerId = req.user.id;
    const { remarks } = req.body || {};
    const result = await idpService.managerApprove(id, managerId, remarks || '');
    res.json(result);
  } catch (err) {
    next(err);
  }
}
// GET /api/idp/manager/pending
async function getManagerPendingIDPs(req, res, next) {
  try {
    const managerId = req.user.id;
    const idps = await idpService.getIDPsPendingManager(managerId);
    res.json(idps);
  } catch (err) {
    next(err);
  }
}

// GET /api/idp/manager/grouped
async function getManagerGroupedIDPs(req, res, next) {
  try {
    const managerId = req.user.id;
    const grouped = await idpService.getIDPsGroupedByManager(managerId);
    res.json(grouped);
  } catch (err) {
    next(err);
  }
}

// =====================================
// AM (ASSISTANT MANAGER) ENDPOINTS
// =====================================

// GET /api/idp/am/pending
async function getAMPendingIDPs(req, res, next) {
  try {
    const amId = req.user.id;
    const idps = await idpService.getIDPsPendingAM(amId);
    res.json(idps);
  } catch (err) {
    next(err);
  }
}

// GET /api/idp/am/grouped
async function getAMGroupedIDPs(req, res, next) {
  try {
    const amId = req.user.id;
    const grouped = await idpService.getIDPsGroupedByAM(amId);
    res.json(grouped);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/am/approve
async function amApproveIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid IDP id' });
    const amId = req.user.id;
    const { remarks } = req.body || {};
    const result = await idpService.amApprove(id, amId, remarks || '');
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/am/return
async function amReturnIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid IDP id' });
    }
    const { remarks } = req.body;
    if (!remarks) {
      return res.status(400).json({ message: 'Remarks are required.' });
    }
    const amId = req.user.id;
    const result = await idpService.amReturnIDP(id, amId, remarks);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/idp/employee/my - return IDPs for the logged-in employee
async function getEmployeeIDPs(req, res, next) {
  try {
    const employeeId = req.user.id;
    const idps = await idpService.getIDPsForEmployee(employeeId);
    res.json(idps);
  } catch (err) {
    next(err);
  }
}
// src/controllers/idp.controller.js
const idpService = require('../services/idp.service');

// GET /api/idp/:id
async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid IDP id' });
    }

    const idp = await idpService.getById(id);
    if (!idp) {
      return res.status(404).json({ message: 'IDP not found' });
    }

    res.json(idp);
  } catch (err) {
    next(err);
  }
}

// POST /api/idp
// Body: { cl_header_id, employee_id, supervisor_id, cycle_id }
async function create(req, res, next) {
  try {
    const { cl_header_id, employee_id, supervisor_id, cycle_id } = req.body;

    if (!cl_header_id || !employee_id || !supervisor_id || !cycle_id) {
      return res.status(400).json({
        message:
          'cl_header_id, employee_id, supervisor_id and cycle_id are required'
      });
    }

    const result = await idpService.create({
      cl_header_id,
      employee_id,
      supervisor_id,
      cycle_id
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id
// Body: { items: [ { id?, competency_id, current_level, target_level, development_activity, development_type, start_date?, end_date? }, ... ] }
async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid IDP id' });
    }

      const { items, reviewPeriod, nextReviewDate } = req.body;
    console.log('[IDP UPDATE] Received items payload:', JSON.stringify(items || []).slice(0, 1000));
      const actorId = req.user?.id || null;
      const actorRole = req.user?.role || null;
      const result = await idpService.update(id, { items: items || [], reviewPeriod, nextReviewDate }, actorId, actorRole);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/submit
async function submit(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid IDP id' });
    }

    const result = await idpService.submit(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/hr/resubmit
async function resubmitToHR(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid IDP id' });
    }

    const result = await idpService.resubmitToHR(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/manager/resubmit
async function resubmitToManager(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid IDP id' });
    }

    const result = await idpService.resubmitToManager(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================
// SUPERVISOR DASHBOARD
// =====================================

// GET /api/idp/supervisor/for-creation
// Returns employees whose CL was approved by HR but have no IDP
async function getSupervisorForCreation(req, res, next) {
  try {
    const supervisorId = req.user.id;
    const employees = await idpService.getEmployeesForIDPCreation(supervisorId);
    res.json(employees);
  } catch (err) {
    next(err);
  }
}

// GET /api/idp/supervisor/grouped
async function getSupervisorIDPsGrouped(req, res, next) {
  try {
    const supervisorId = req.user.id;
    const grouped = await idpService.getIDPsGroupedByStatus(supervisorId);
    res.json(grouped);
  } catch (err) {
    next(err);
  }
}

// GET /api/idp/hr/incoming
async function getHRIncomingIDPs(req, res, next) {
  try {
    const department = req.query.department || null;
    const status = req.query.status || null; // optional comma-separated statuses
    const rows = await idpService.getHRIncoming(req.user.id, department, status);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}


// DELETE /api/idp/:id (delete DRAFT IDP)
async function deleteIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    console.log('[IDP DELETE] Request to delete IDP:', id);
    if (!id) {
      console.log('[IDP DELETE] Invalid IDP id');
      return res.status(400).json({ message: 'Invalid IDP id' });
    }
    const user = req.user ? req.user.id : null;
    const role = req.user ? req.user.role : null;
    console.log(`[IDP DELETE] User: ${user}, Role: ${role}`);
    const idp = await idpService.getById(id);
    console.log('[IDP DELETE] IDP header:', idp && idp.header);
    if (!idp || !idp.header) {
      console.log('[IDP DELETE] IDP not found');
      return res.status(404).json({ message: 'IDP not found.' });
    }
    // Supervisors who own the IDP may delete it even if it's in approval.
    const isSupervisorOwner = role === 'Supervisor' && Number(idp.header.supervisor_id) === Number(user);
    if (!isSupervisorOwner && idp.header.status !== 'DRAFT') {
      console.log(`[IDP DELETE] Cannot delete, status is ${idp.header.status}`);
      return res.status(403).json({ message: 'Only DRAFT IDPs can be deleted.' });
    }
    try {
      await idpService.deleteById(id);
      console.log('[IDP DELETE] Deleted successfully');
      res.json({ message: 'IDP deleted successfully.' });
    } catch (deleteErr) {
      console.log('[IDP DELETE] Delete error:', deleteErr.message);
      return res.status(500).json({ message: 'Delete failed', error: deleteErr.message });
    }
  } catch (err) {
    console.log('[IDP DELETE] Unexpected error:', err.message);
    next(err);
  }
}

// PUT /api/idp/:id/employee/approve
async function employeeApproveIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid IDP id' });
    const employeeId = req.user.id;
    const result = await idpService.employeeApprove(id, employeeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/employee/return
async function employeeReturnIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid IDP id' });
    const { remarks } = req.body || {};
    if (!remarks) return res.status(400).json({ message: 'Remarks are required' });
    const employeeId = req.user.id;
    const result = await idpService.employeeReturn(id, employeeId, remarks);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/hr/approve
async function hrApproveIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid IDP id' });
    const hrId = req.user.id;
    const result = await idpService.hrApprove(id, hrId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/hr/approve-for-completion
async function hrApproveForCompletionIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid IDP id' });
    const hrId = req.user.id;
    const result = await idpService.hrApproveForCompletion(id, hrId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/hr/approve-cycle
async function hrApproveCycleIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid IDP id' });
    const hrId = req.user.id;
    const result = await idpService.hrForceCycleComplete(id, hrId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// PUT /api/idp/:id/hr/return
async function hrReturnIDP(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid IDP id' });
    const { remarks } = req.body || {};
    if (!remarks) return res.status(400).json({ message: 'Remarks are required' });
    const hrId = req.user.id;
    const result = await idpService.hrReturn(id, hrId, remarks);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// =====================================
// CSV EXPORT
// =====================================
async function exportIDP(req, res, next) {
  try {
    const { startDate, endDate, department, status } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }
    
    const csvData = await idpService.exportIDP({
      startDate,
      endDate,
      department: department || null,
      status: status || null
    });
    
    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="IDP_Export_${department || 'All'}_${startDate}_${endDate}.csv"`);
    
    res.send(csvData);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getById,
  create,
  createWithItems,
  update,
  submit,
  getSupervisorForCreation,
  getSupervisorIDPsGrouped,
  getManagerGroupedIDPs,
  deleteIDP,
  getManagerPendingIDPs,
  managerReturnIDP,
  managerApproveIDP,
  getAMPendingIDPs,
  getAMGroupedIDPs,
  amApproveIDP,
  amReturnIDP,
  getEmployeeIDPs,
  employeeApproveIDP,
  employeeReturnIDP,
  hrApproveIDP,
  hrApproveForCompletionIDP,
  hrApproveCycleIDP,
  hrReturnIDP,
  getHRIncomingIDPs,
  resubmitToHR,
  resubmitToManager,
  exportIDP,
};

// POST /api/idp/create
// Body: { employeeId, supervisorId, reviewPeriod, nextReviewDate, items: [{ competencyId, currentLevel, targetLevel, developmentArea, developmentActivities: [...] }] }
async function createWithItems(req, res, next) {
  try {
    const { employeeId, supervisorId, reviewPeriod, nextReviewDate, items } = req.body;

    if (!employeeId || !supervisorId) {
      return res.status(400).json({
        message: 'employeeId and supervisorId are required'
      });
    }

    const result = await idpService.createWithItems({
      employeeId,
      supervisorId,
      reviewPeriod,
      nextReviewDate,
      items: items || []
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
