// backend/routes/notifications.routes.js
const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth.middleware');
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notifications.controller');

router.get('/', requireAuth, getMyNotifications);
router.patch('/mark-all-read', requireAuth, markAllAsRead);
router.patch('/:id/read', requireAuth, markAsRead);

module.exports = router;
