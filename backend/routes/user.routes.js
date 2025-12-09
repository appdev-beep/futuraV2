const express = require('express');
const userController = require('../controllers/user.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('Admin', 'Supervisor')); // Admin and Supervisor can manage users

// GET /api/users
router.get('/', userController.getAll);

// POST /api/users
router.post('/', userController.create);

module.exports = router;
