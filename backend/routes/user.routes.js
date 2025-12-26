const express = require('express');
const userController = require('../controllers/user.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);
// Allow authenticated users to fetch their own profile; role checks apply to other user management routes
router.get('/:id', userController.getById);

router.use(requireRole('Admin', 'Supervisor', 'Manager', 'HR', 'AM')); // Admin, Supervisor, Manager, HR, and AM can access users

// GET /api/users
router.get('/', userController.getAll);

// POST /api/users
router.post('/', userController.create);

// PUT /api/users/:id
router.put('/:id', userController.update);

// DELETE /api/users/:id
router.delete('/:id', userController.deleteById);

module.exports = router;
