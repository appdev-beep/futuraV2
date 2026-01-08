
const express = require('express');
const idpController = require('../controllers/idp.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();


router.use(requireAuth);

// GET /api/idp/manager/pending (IDPs pending manager approval)
router.get(
  '/manager/pending',
  requireRole('Manager', 'HR', 'Admin'),
  idpController.getManagerPendingIDPs
);

// GET /api/idp/employee/my (IDPs for current employee)
router.get(
  '/employee/my',
  requireRole('Employee', 'Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.getEmployeeIDPs
);

// GET /api/idp/:id  (everyone logged in can view – later: ownership rules)
router.get('/:id', idpController.getById);

// POST /api/idp  (create IDP – supervisors & above)
router.post(
  '/',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.create
);

// POST /api/idp/create (create comprehensive IDP with development plan)
router.post(
  '/create',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.createWithItems
);

// PUT /api/idp/:id (update IDP items)
router.put(
  '/:id',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.update
);

// PUT /api/idp/:id/submit
router.put(
  '/:id/submit',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.submit
);

// PUT /api/idp/:id/manager/return (Manager returns IDP to supervisor)
router.put(
  '/:id/manager/return',
  requireRole('Manager', 'HR', 'Admin'),
  idpController.managerReturnIDP
);

// PUT /api/idp/:id/manager/approve (Manager approves IDP and routes to employee)
router.put(
  '/:id/manager/approve',
  requireRole('Manager', 'HR', 'Admin'),
  idpController.managerApproveIDP
);

// PUT /api/idp/:id/employee/approve (Employee acknowledges/approves IDP)
router.put(
  '/:id/employee/approve',
  requireRole('Employee'),
  idpController.employeeApproveIDP
);

// PUT /api/idp/:id/employee/return (Employee returns IDP to supervisor)
router.put(
  '/:id/employee/return',
  requireRole('Employee'),
  idpController.employeeReturnIDP
);

// =====================================
// SUPERVISOR DASHBOARD ROUTES
// =====================================

// GET /api/idp/supervisor/for-creation
router.get(
  '/supervisor/for-creation',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.getSupervisorForCreation
);

// GET /api/idp/supervisor/grouped
router.get(
  '/supervisor/grouped',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.getSupervisorIDPsGrouped
);

// HR incoming IDPs (filterable by department)
router.get(
  '/hr/incoming',
  requireRole('HR', 'Admin'),
  idpController.getHRIncomingIDPs
);

// PUT /api/idp/:id/hr/approve (HR approves IDP if all competencies completed)
router.put(
  '/:id/hr/approve',
  requireRole('HR', 'Admin'),
  idpController.hrApproveIDP
);

// PUT /api/idp/:id/hr/approve-for-completion (HR explicitly mark FOR_COMPLETION)
router.put(
  '/:id/hr/approve-for-completion',
  requireRole('HR', 'Admin'),
  idpController.hrApproveForCompletionIDP
);

// PUT /api/idp/:id/hr/approve-cycle (HR explicitly mark Cycle Completed)
router.put(
  '/:id/hr/approve-cycle',
  requireRole('HR', 'Admin'),
  idpController.hrApproveCycleIDP
);

// PUT /api/idp/:id/hr/return (HR returns IDP to supervisor for completion)
router.put(
  '/:id/hr/return',
  requireRole('HR', 'Admin'),
  idpController.hrReturnIDP
);

// DELETE /api/idp/:id (delete DRAFT IDP)
router.delete(
  '/:id',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.deleteIDP
);

module.exports = router;
