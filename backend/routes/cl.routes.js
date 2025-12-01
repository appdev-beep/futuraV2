// src/routes/cl.routes.js
const express = require('express');
const clController = require('../controllers/cl.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

// GET /api/cl/:id
router.get('/:id', clController.getById);

// POST /api/cl
// body: { employee_id, supervisor_id, department_id, cycle_id }
router.post('/', clController.create);

// PUT /api/cl/:id
// body: { items: [ { id, assigned_level, weight, justification }, ... ] }
router.put('/:id', clController.update);

// PUT /api/cl/:id/submit
router.put('/:id/submit', clController.submit);

module.exports = router;
