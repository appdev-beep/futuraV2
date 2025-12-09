// seed-admin.js
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const password = 'Admin@1234'; // change if you want
    const passwordHash = await bcrypt.hash(password, 10);

    // Adjust these if your admin should belong to a different position/department
    const [posRows] = await conn.query(
      'SELECT id FROM positions WHERE title = ? LIMIT 1',
      ['HR Manager']
    );
    const [deptRows] = await conn.query(
      'SELECT id FROM departments WHERE name = ? LIMIT 1',
      ['Human Resources']
    );

    if (!posRows.length || !deptRows.length) {
      throw new Error('HR Manager position or Human Resources department not found');
    }

    const positionId = posRows[0].id;
    const departmentId = deptRows[0].id;

    const [result] = await conn.query(
      `INSERT INTO users (
         employee_id,
         name,
         email,
         position_id,
         department_id,
         role,
         password,
         is_active,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        'EMP-ADMIN-001',
        'System Administrator',
        'admin@futura.local', // change email if needed
        positionId,
        departmentId,
        'Admin',
        passwordHash
      ]
    );

    console.log('✅ Admin user created with id:', result.insertId);
  } catch (err) {
    console.error('❌ Failed to seed admin user:', err.message);
  } finally {
    await conn.end();
  }
})();
