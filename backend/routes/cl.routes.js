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
// EMPLOYEE COMPETENCY LOOKUP
// MUST BE ABOVE "/:id"
// =====================================

// GET /api/cl/employee/:id/competencies
router.get(
  '/employee/:id/competencies',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  clController.getCompetenciesForEmployee
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
// MUST ALWAYS BE LAST
// GET CL BY ID  → GET /api/cl/:id
// =====================================
router.get('/:id', clController.getById);

module.exports = router;
