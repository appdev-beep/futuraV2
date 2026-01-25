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

// Change user password after verifying current password
async function changeUserPassword(userId, currentPassword, newPassword) {
  const [rows] = await db.query(
    `SELECT password FROM users WHERE id = ?`,
    [userId]
  );
  const user = rows[0];
  if (!user) throw new Error('User not found');

  const ok = await bcrypt.compare(currentPassword, user.password || '');
  if (!ok) {
    const err = new Error('Current password is incorrect');
    err.status = 400;
    throw err;
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await db.query(`UPDATE users SET password = ? WHERE id = ?`, [hashed, userId]);
  return true;
}

module.exports.changeUserPassword = changeUserPassword;
