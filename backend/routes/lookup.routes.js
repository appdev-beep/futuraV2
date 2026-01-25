// routes/lookup.routes.js
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const lookupController = require('../controllers/lookup.controller');

const router = express.Router();

// Require authentication for lookup routes, but allow all authenticated
// users to GET lookup data. Only protect mutation endpoints with roles.
router.use(requireAuth);

// GET /api/lookup/departments
router.get('/departments', lookupController.getDepartments);

// GET /api/lookup/positions
router.get('/positions', lookupController.getPositions);

// GET /api/lookup/competencies
router.get('/competencies', lookupController.getCompetencies);

// GET /api/lookup/cycles
router.get('/cycles', lookupController.getAppraisalCycles);

// GET /api/lookup/supervisors/:departmentId
router.get('/supervisors/:departmentId', lookupController.getSupervisorsByDepartment);

// GET /api/lookup/managers/:departmentId
router.get('/managers/:departmentId', lookupController.getManagersByDepartment);

// GET /api/lookup/ams/:departmentId
router.get('/ams/:departmentId', lookupController.getAMsByDepartment);

// GET /api/lookup/review-periods
router.get('/review-periods', lookupController.getReviewPeriods);

// POST /api/lookup/review-periods (allow only Admin or HR to add centrally)
router.post('/review-periods', requireRole('Admin', 'HR'), lookupController.createReviewPeriod);

module.exports = router;
