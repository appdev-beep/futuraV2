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
  password,
  supervisor_id
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
            role = ?, password = ?, supervisor_id = ?, is_active = 1, updated_at = NOW()
        WHERE id = ?
        `,
        [employee_id, name, position_id, department_id, role, passwordHash, supervisor_id || null, existingUser.id]
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
      (employee_id, name, email, position_id, department_id, role, password, supervisor_id, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `,
    [employee_id, name, email, position_id, department_id, role, passwordHash, supervisor_id || null]
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
      u.supervisor_id,
      d.name  AS department_name,
      p.title AS position_title,
      s.name  AS supervisor_name,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN positions   p ON u.position_id = p.id
    LEFT JOIN users       s ON u.supervisor_id = s.id
    WHERE u.is_active = 1
    ORDER BY u.created_at DESC
    `
  );
  return rows;
}

async function getUserById(userId) {
  // Fetch user with department, position, and supervisor names
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
      u.supervisor_id,
      d.name  AS department_name,
      p.title AS position_title,
      s.name  AS supervisor_name,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN positions   p ON u.position_id = p.id
    LEFT JOIN users       s ON u.supervisor_id = s.id
    WHERE u.id = ?
    `,
    [userId]
  );

  if (!rows || rows.length === 0) return null;

  return rows[0];
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

async function updateUser(userId, {
  employee_id,
  name,
  email,
  position_id,
  department_id,
  role,
  password,
  supervisor_id
}) {
  if (!ALLOWED_ROLES.includes(role)) {
    const err = new Error('Invalid role');
    err.statusCode = 400;
    throw err;
  }

  // Check if email is being changed and if it conflicts with another user
  const [existingUsers] = await db.query(
    'SELECT id FROM users WHERE email = ? AND id != ?',
    [email, userId]
  );

  if (existingUsers.length > 0) {
    const err = new Error('A user with this email already exists');
    err.statusCode = 400;
    throw err;
  }

  let updateQuery = `
    UPDATE users
    SET employee_id = ?, name = ?, email = ?, position_id = ?, 
        department_id = ?, role = ?, supervisor_id = ?, updated_at = NOW()
  `;
  let params = [employee_id, name, email, position_id, department_id, role, supervisor_id || null];

  // Only update password if provided
  if (password) {
    const passwordHash = await bcrypt.hash(password, 10);
    updateQuery += ', password = ?';
    params.push(passwordHash);
  }

  updateQuery += ' WHERE id = ?';
  params.push(userId);

  await db.query(updateQuery, params);

  // Return updated user
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
      u.supervisor_id,
      d.name  AS department_name,
      p.title AS position_title,
      s.name  AS supervisor_name,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN positions   p ON u.position_id = p.id
    LEFT JOIN users       s ON u.supervisor_id = s.id
    WHERE u.id = ?
    `,
    [userId]
  );

  return rows[0];
}

module.exports = {
  createUser,
  listUsers,
  deleteUser,
  getUserById,
  updateUser
};
