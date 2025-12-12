const { db } = require('../config/db');
const bcrypt = require('bcryptjs');

async function findUserByEmail(email) {
  const [rows] = await db.query(
    `SELECT id, employee_id, name, email, position_id, department_id, role, password, is_active
     FROM users
     WHERE email = ?`,
    [email]
  );
  return rows[0] || null;
}

async function validateUserCredentials(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  if (!user.is_active) return null;

  const ok = await bcrypt.compare(password, user.password || '');
  if (!ok) return null;

  // Don’t return password
  delete user.password;
  return user;
}

module.exports = {
  findUserByEmail,
  validateUserCredentials
};
