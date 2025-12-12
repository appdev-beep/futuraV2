const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const recentActionsController = require('../controllers/recentActions.controller');

const router = express.Router();
router.use(requireAuth);

router.get(
  '/recent-actions',
  requireRole('Supervisor', 'AM', 'Manager', 'HR', 'Admin'),
  recentActionsController.getRecentActions
);

module.exports = router;
