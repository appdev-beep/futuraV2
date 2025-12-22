const express = require('express');
const idpController = require('../controllers/idp.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

// GET /api/idp/:id  (everyone logged in can view – later: ownership rules)
router.get('/:id', idpController.getById);

// POST /api/idp  (create IDP – supervisors & above)
router.post(
  '/',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.create
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

// =====================================
// SUPERVISOR DASHBOARD ROUTES
// =====================================

// GET /api/idp/supervisor/for-creation
router.get(
  '/supervisor/for-creation',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.getSupervisorForCreation
);

module.exports = router;
