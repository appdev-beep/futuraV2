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

    const { items } = req.body;
    const result = await idpService.update(id, { items: items || [] });
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
    // Only allow delete if status is DRAFT
    const idp = await idpService.getById(id);
    console.log('[IDP DELETE] IDP header:', idp && idp.header);
    if (!idp || !idp.header) {
      console.log('[IDP DELETE] IDP not found');
      return res.status(404).json({ message: 'IDP not found.' });
    }
    if (idp.header.status !== 'DRAFT') {
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

module.exports = {
  getById,
  create,
  createWithItems,
  update,
  submit,
  getSupervisorForCreation,
  getSupervisorIDPsGrouped,
  deleteIDP,
  getManagerPendingIDPs,
  managerReturnIDP,
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
