// src/routes/idp.routes.js
const express = require('express');
const idpController = require('../controllers/idp.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

// GET /api/idp/:id
router.get('/:id', idpController.getById);

// POST /api/idp
// body: { cl_header_id, employee_id, supervisor_id, cycle_id }
router.post('/', idpController.create);

// PUT /api/idp/:id
router.put('/:id', idpController.update);

// PUT /api/idp/:id/submit
router.put('/:id/submit', idpController.submit);

module.exports = router;
