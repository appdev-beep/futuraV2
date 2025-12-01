// src/routes/index.js
const express = require('express');
const clRoutes = require('./cl.routes');
const idpRoutes = require('./idp.routes');

const router = express.Router();

router.use('/cl', clRoutes);
router.use('/idp', idpRoutes);

module.exports = router;
