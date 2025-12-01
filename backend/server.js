// server.js (backend root)
const dotenv = require('dotenv');
dotenv.config(); // loads backend/.env if present

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./routes'); // routes/index.js
const { errorHandler } = require('./middleware/error.middleware');

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// API routes
app.use('/api', routes);

// global error handler
app.use(errorHandler);

// PORT from env or default 4000
const PORT = process.env.PORT || 4000;

// listen on all interfaces (0.0.0.0)
app.listen(PORT, () => {
  console.log(`FUTURA backend listening:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  LAN:     http://10.10.1.243:${PORT}`);
});
