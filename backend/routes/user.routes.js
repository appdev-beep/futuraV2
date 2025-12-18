const express = require('express');
const userController = require('../controllers/user.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('Admin', 'Supervisor', 'Manager', 'HR')); // Admin, Supervisor, Manager, and HR can access users

// GET /api/users
router.get('/', userController.getAll);

// POST /api/users
router.post('/', userController.create);

// DELETE /api/users/:id
router.delete('/:id', userController.deleteById);

module.exports = router;
