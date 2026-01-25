const express = require('express');
const { login, changePassword } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/change-password (protected)
router.post('/change-password', requireAuth, changePassword);

module.exports = router;
