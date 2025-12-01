const mysql = require('mysql2/promise');

const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'Root@1234',
  database: 'futura',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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
