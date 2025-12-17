// src/routes/cl.routes.js
const express = require('express');
const clController = require('../controllers/cl.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware'); // for PDF uploads

const router = express.Router();

// All CL routes require authentication
router.use(requireAuth);

// =====================================
// SUPERVISOR DASHBOARD ROUTES
// =====================================

// GET /api/cl/supervisor/summary
router.get(
  '/supervisor/summary',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.getSupervisorSummary
);

// GET /api/cl/supervisor/all
router.get(
  '/supervisor/all',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.getSupervisorAllCL
);

// GET /api/cl/supervisor/pending
router.get(
  '/supervisor/pending',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.getSupervisorPending
);

// =====================================
// MANAGER DASHBOARD ROUTES
// =====================================

// GET /api/cl/manager/summary
router.get(
  '/manager/summary',
  requireRole('Manager', 'HR', 'Admin'),
  clController.getManagerSummary
);

// GET /api/cl/manager/pending
router.get(
  '/manager/pending',
  requireRole('Manager', 'HR', 'Admin'),
  clController.getManagerPending
);

// GET /api/cl/manager/all (history)
router.get(
  '/manager/all',
  requireRole('Manager', 'HR', 'Admin'),
  clController.getManagerAllCL
);

// =====================================
// EMPLOYEE DASHBOARD ROUTES
// =====================================

// GET /api/cl/employee/pending
router.get(
  '/employee/pending',
  requireRole('Employee'),
  clController.getEmployeePending
);

// EMPLOYEE SELF HISTORY
// GET /api/cl/employee/my/history
router.get(
  '/employee/my/history',
  requireRole('Employee'),
  clController.getMyHistory
);

// =====================================
// AM DASHBOARD ROUTES
// =====================================

// GET /api/cl/am/summary
router.get(
  '/am/summary',
  requireRole('AM'),
  clController.getAMSummary
);

// GET /api/cl/am/pending
router.get(
  '/am/pending',
  requireRole('AM'),
  clController.getAMPending
);

// =====================================
// HR DASHBOARD ROUTES
// =====================================

// GET /api/cl/hr/summary
router.get(
  '/hr/summary',
  requireRole('HR', 'Admin'),
  clController.getHRSummary
);

// GET /api/cl/hr/pending
router.get(
  '/hr/pending',
  requireRole('HR', 'Admin'),
  clController.getHRPending
);

// GET /api/cl/hr/all (history)
router.get(
  '/hr/all',
  requireRole('HR', 'Admin'),
  clController.getHRAllCL   // make sure this exists in cl.controller
);

// GET /api/cl/hr/incoming (all CLs from all departments)
router.get(
  '/hr/incoming',
  requireRole('HR', 'Admin'),
  clController.getHRIncomingCL
);

// =====================================
// PDF UPLOAD (JUSTIFICATION ATTACHMENT)
// POST /api/cl/upload
// =====================================
router.post(
  '/upload',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  upload.single('file'),
  clController.uploadJustificationFile
);

// =====================================
// EMPLOYEE-SPECIFIC DATA (for supervisors/AM/Manager/HR/Admin)
// MUST BE ABOVE "/:id"
// =====================================

// GET /api/cl/employee/:id/competencies
router.get(
  '/employee/:id/competencies',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.getCompetenciesForEmployee
);

// GET /api/cl/employee/:id/history
router.get(
  '/employee/:id/history',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.getEmployeeHistory
);

// =====================================
// STANDARD CL ROUTES
// =====================================

// CREATE CL
router.post(
  '/',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.create
);

// UPDATE CL ITEMS
router.put(
  '/:id',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.update
);

// DELETE CL (Supervisor can delete DRAFT CLs)
router.delete(
  '/:id',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.deleteCL
);

// SUBMIT CL (Supervisor → AM/Manager workflow)
router.post(
  '/:id/submit',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.submit
);

// =====================================
// MANAGER ACTION ROUTES (APPROVE / RETURN)
// =====================================

// POST /api/cl/:id/manager/approve
router.post(
  '/:id/manager/approve',
  requireRole('Manager', 'HR', 'Admin'),
  clController.managerApprove
);

// POST /api/cl/:id/manager/return
router.post(
  '/:id/manager/return',
  requireRole('Manager', 'HR', 'Admin'),
  clController.managerReturn
);

// =====================================
// AM ACTION ROUTES (APPROVE / RETURN)
// =====================================

// POST /api/cl/:id/am/approve
router.post(
  '/:id/am/approve',
  requireRole('AM', 'HR', 'Admin'),
  clController.amApprove
);

// POST /api/cl/:id/am/return
router.post(
  '/:id/am/return',
  requireRole('AM', 'HR', 'Admin'),
  clController.amReturn
);

// =====================================
// EMPLOYEE ACTION ROUTES (APPROVE / RETURN)
// =====================================

// POST /api/cl/:id/employee/approve
router.post(
  '/:id/employee/approve',
  requireRole('Employee', 'HR', 'Admin'),
  clController.employeeApprove
);

// POST /api/cl/:id/employee/return
router.post(
  '/:id/employee/return',
  requireRole('Employee', 'HR', 'Admin'),
  clController.employeeReturn
);

// =====================================
// HR ACTION ROUTES (APPROVE / RETURN)
// =====================================

// POST /api/cl/:id/hr/approve
router.post(
  '/:id/hr/approve',
  requireRole('HR', 'Admin'),
  clController.hrApprove
);

// POST /api/cl/:id/hr/return
router.post(
  '/:id/hr/return',
  requireRole('HR', 'Admin'),
  clController.hrReturn
);

// =====================================
// GET CL AUDIT TRAIL
// =====================================
router.get('/:id/audit-trail', clController.getCLAuditTrail);

// =====================================
// MUST ALWAYS BE LAST
// GET CL BY ID  → GET /api/cl/:id
// =====================================
router.get('/:id', clController.getById);

module.exports = router;
