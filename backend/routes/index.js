// backend/routes/index.js
const express = require('express');
const clRoutes = require('./cl.routes');
const idpRoutes = require('./idp.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const lookupRoutes = require('./lookup.routes');
const notificationsRoutes = require('./notifications.routes');
const recentActionsRoutes = require('./recentActions.routes'); // ✅ ADD

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/lookup', lookupRoutes);

router.use('/notifications', notificationsRoutes);   // ✅ /api/notifications
router.use('/recent-actions', recentActionsRoutes);  // ✅ /api/recent-actions

router.use('/cl', clRoutes);
router.use('/idp', idpRoutes);

module.exports = router;
