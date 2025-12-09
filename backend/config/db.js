require('dotenv').config();
const mysql = require('mysql2/promise');

// Validate required env vars
const requiredEnv = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_WAIT_FOR_CONNECTIONS',
  'DB_CONNECTION_LIMIT',
  'DB_QUEUE_LIMIT'
];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required DB environment variables:', missing.join(', '));
  throw new Error('Database configuration error: missing environment variables');
}

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === 'true',
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT),
  queueLimit: Number(process.env.DB_QUEUE_LIMIT)
};

console.log('DB CONFIG IN USE:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database
});

const db = mysql.createPool(dbConfig);

// Test connection at startup
(async () => {
  let conn;
  try {
    conn = await db.getConnection();
    const sql = 'SELECT 1 AS ok';
    console.log('Running test SQL:', sql);

    const [rows] = await conn.query(sql);
    console.log('✅ MySQL pool connected');
    console.log('Connection info:', rows[0]);
  } catch (err) {
    console.error('❌ MySQL connection error:');
    console.error('message:', err.message);
    if (err.sql) console.error('sql:', err.sql);
  } finally {
    if (conn) conn.release();
  }
})();

module.exports = { db };
