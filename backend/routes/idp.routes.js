
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

// DELETE /api/idp/:id (delete DRAFT IDP)
router.delete(
  '/:id',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  idpController.deleteIDP
);

module.exports = router;
