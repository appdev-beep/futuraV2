// backend/routes/recentActions.routes.js
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const recentActionsController = require('../controllers/recentActions.controller');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/', // ✅ IMPORTANT: use "/" so mount path controls the URL
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  recentActionsController.getRecentActions
);

module.exports = router;
