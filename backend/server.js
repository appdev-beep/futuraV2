// server.js (backend root)
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const routes = require('./routes'); // routes/index.js
const { errorHandler } = require('./middleware/error.middleware');

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ===============================
// SERVE UPLOADED PDF FILES
// ===============================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================
// API routes
// ===============================
// This already includes /api/cl/... including /api/cl/upload
app.use('/api', routes);

// global error handler
app.use(errorHandler);

// PORT from env or default 4000
const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FUTURA backend listening:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  LAN:     http://10.10.1.243:${PORT}`);
});
