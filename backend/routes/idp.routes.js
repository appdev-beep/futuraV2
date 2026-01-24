
const express = require('express');
const idpController = require('../controllers/idp.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();


router.use(requireAuth);

// =====================================
// AM (ASSISTANT MANAGER) ROUTES
// =====================================

// GET /api/idp/am/pending (IDPs pending AM approval)
router.get(
  '/am/pending',
  requireRole('AM', 'HR', 'Admin'),
  idpController.getAMPendingIDPs
);

// GET /api/idp/am/grouped (IDPs for AM, grouped by status)
router.get(
  '/am/grouped',
  requireRole('AM', 'HR', 'Admin'),
  idpController.getAMGroupedIDPs
);

// PUT /api/idp/:id/am/approve (AM approves IDP and routes to Manager)
router.put(
  '/:id/am/approve',
  requireRole('AM', 'HR', 'Admin'),
  idpController.amApproveIDP
);

// PUT /api/idp/:id/am/return (AM returns IDP to supervisor)
router.put(
  '/:id/am/return',
  requireRole('AM', 'HR', 'Admin'),
  idpController.amReturnIDP
);

// GET /api/idp/am/export (CSV export for assistant managers)
router.get(
  '/am/export',
  requireRole('AM', 'HR', 'Admin'),
  idpController.exportIDPForAM
);

// GET /api/idp/manager/pending (IDPs pending manager approval)
router.get(
  '/manager/pending',
  requireRole('Manager', 'HR', 'Admin'),
  idpController.getManagerPendingIDPs
);

// GET /api/idp/manager/grouped (IDPs for manager, grouped by status)
router.get(
  '/manager/grouped',
  requireRole('Manager', 'HR', 'Admin'),
  idpController.getManagerGroupedIDPs
);

// GET /api/idp/manager/export (CSV export for managers)
router.get(
  '/manager/export',
  requireRole('Manager', 'HR', 'Admin'),
  idpController.exportIDPForManager
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

// DEV: debug endpoint to trigger IDP creation email for a single IDP (Admin only, disabled in production)
if (process.env.NODE_ENV !== 'production') {
  router.post(
    '/debug/:id/send-email',
    requireRole('Admin'),
    idpController.debugSendIDPEmail
  );
}

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

// PUT /api/idp/:id/hr/resubmit (Supervisor resubmits to HR after HR returned it)
router.put(
  '/:id/hr/resubmit',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.resubmitToHR
);

// PUT /api/idp/:id/manager/resubmit (Supervisor resubmits to Manager after Manager returned it)
router.put(
  '/:id/manager/resubmit',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.resubmitToManager
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

// GET /api/idp/supervisor/export (CSV export for supervisors)
router.get(
  '/supervisor/export',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.exportIDPForSupervisor
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

// GET /api/idp/hr/export (CSV export)
router.get(
  '/hr/export',
  requireRole('HR', 'Admin'),
  idpController.exportIDP
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
