// routes/index.js (or whatever your main router file is)
const express = require('express');
const clRoutes = require('./cl.routes');
const idpRoutes = require('./idp.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const lookupRoutes = require('./lookup.routes'); // ⬅️ add this

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);        // Admin-only user management
router.use('/lookup', lookupRoutes);     // ⬅️ IMPORTANT: this makes /api/lookup/... exist
router.use('/cl', clRoutes);
router.use('/idp', idpRoutes);

module.exports = router;
