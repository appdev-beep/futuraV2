// routes/lookup.routes.js
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const lookupController = require('../controllers/lookup.controller');

const router = express.Router();

// If only admins can see the lookups, keep this
router.use(requireAuth);
router.use(requireRole('Admin', 'Supervisor', 'HR', 'Manager'));

// GET /api/lookup/departments
router.get('/departments', lookupController.getDepartments);

// GET /api/lookup/positions
router.get('/positions', lookupController.getPositions);

// GET /api/lookup/competencies
router.get('/competencies', lookupController.getCompetencies);

// GET /api/lookup/cycles
router.get('/cycles', lookupController.getAppraisalCycles);

module.exports = router;
