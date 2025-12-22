const { db } = require('../config/db');
const bcrypt = require('bcryptjs');

const ALLOWED_ROLES = ['Employee', 'Supervisor', 'AM', 'Manager', 'HR', 'Admin'];

async function createUser({
  employee_id,
  name,
  email,
  position_id,
  department_id,
  role,
  password
}) {
  if (!ALLOWED_ROLES.includes(role)) {
    const err = new Error('Invalid role');
    err.statusCode = 400;
    throw err;
  }

  // Check if user with this email already exists
  const [existingUsers] = await db.query(
    'SELECT id, is_active FROM users WHERE email = ?',
    [email]
  );

  if (existingUsers.length > 0) {
    const existingUser = existingUsers[0];
    
    if (existingUser.is_active === 1) {
      const err = new Error('A user with this email already exists');
      err.statusCode = 400;
      throw err;
    } else {
      // User exists but is inactive - reactivate them
      const passwordHash = await bcrypt.hash(password, 10);
      
      await db.query(
        `
        UPDATE users
        SET employee_id = ?, name = ?, position_id = ?, department_id = ?, 
            role = ?, password = ?, is_active = 1, updated_at = NOW()
        WHERE id = ?
        `,
        [employee_id, name, position_id, department_id, role, passwordHash, existingUser.id]
      );

      const userId = existingUser.id;

      // Return updated user with department_name and position_title
      const [rows] = await db.query(
        `
        SELECT
          u.id,
          u.employee_id,
          u.name,
          u.email,
          u.position_id,
          u.department_id,
          u.role,
          u.is_active,
          d.name  AS department_name,
          p.title AS position_title,
          u.created_at,
          u.updated_at
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN positions   p ON u.position_id = p.id
        WHERE u.id = ?
        `,
        [userId]
      );

      return rows[0];
    }
  }

  // Create new user
  const passwordHash = await bcrypt.hash(password, 10);

  const [result] = await db.query(
    `
    INSERT INTO users
      (employee_id, name, email, position_id, department_id, role, password, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `,
    [employee_id, name, email, position_id, department_id, role, passwordHash]
  );

  const userId = result.insertId;

  // Return user with department_name and position_title for consistency
  const [rows] = await db.query(
    `
    SELECT
      u.id,
      u.employee_id,
      u.name,
      u.email,
      u.position_id,
      u.department_id,
      u.role,
      u.is_active,
      d.name  AS department_name,
      p.title AS position_title,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN positions   p ON u.position_id = p.id
    WHERE u.id = ?
    `,
    [userId]
  );

  return rows[0];
}

async function listUsers() {
  const [rows] = await db.query(
    `
    SELECT
      u.id,
      u.employee_id,
      u.name,
      u.email,
      u.position_id,
      u.department_id,
      u.role,
      u.is_active,
      d.name  AS department_name,
      p.title AS position_title,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN positions   p ON u.position_id = p.id
    WHERE u.is_active = 1
    ORDER BY u.created_at DESC
    `
  );
  return rows;
}

async function getUserById(userId) {
  // First, fetch user with department and position names (avoid joining on supervisor_id which may not exist)
  const [rows] = await db.query(
    `
    SELECT
      u.id,
      u.employee_id,
      u.name,
      u.email,
      u.position_id,
      u.department_id,
      u.role,
      u.is_active,
      d.name  AS department_name,
      p.title AS position_title,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN positions   p ON u.position_id = p.id
    WHERE u.id = ?
    `,
    [userId]
  );

  if (!rows || rows.length === 0) return null;

  const user = rows[0];

  // Try to determine supervisor name:
  // 1) If users table has supervisor_id column, a previous join would have returned it; but since schema may not include it,
  //    fall back to finding a user with role='Supervisor' in the same department.
  try {
    const [srows] = await db.query(
      `SELECT name FROM users WHERE role = 'Supervisor' AND department_id = ? LIMIT 1`,
      [user.department_id]
    );

    user.supervisor_name = (srows && srows[0] && srows[0].name) ? srows[0].name : null;
  } catch (err) {
    // If query fails for any reason, just set supervisor_name null and continue
    user.supervisor_name = null;
  }

  return user;
}

async function deleteUser(userId) {
  // Hard delete - permanently remove from database
  const [result] = await db.query(
    'DELETE FROM users WHERE id = ?',
    [userId]
  );

  if (result.affectedRows === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return { message: 'User deleted successfully', userId };
}

module.exports = {
  createUser,
  listUsers,
  deleteUser,
  getUserById
};
