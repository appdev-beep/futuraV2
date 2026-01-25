const jwt = require('jsonwebtoken');
const { validateUserCredentials } = require('../services/auth.service');
const { changeUserPassword } = require('../services/auth.service');

function signToken(user) {
  const payload = {
    id: user.id,
    employee_id: user.employee_id,
    name: user.name,
    email: user.email,
    role: user.role,
    position_id: user.position_id,
    department_id: user.department_id
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
}

// POST /api/auth/login
// body: { email, password }
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await validateUserCredentials(email, password);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user);

    res.json({
      token,
      user
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };

// POST /api/auth/change-password
// body: { currentPassword, newPassword }
async function changePassword(req, res, next) {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both currentPassword and newPassword are required' });
    }

    await changeUserPassword(userId, currentPassword, newPassword);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports.changePassword = changePassword;
