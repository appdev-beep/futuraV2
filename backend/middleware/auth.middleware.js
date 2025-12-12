// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

// Read JWT and attach req.user
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (!token || scheme !== 'Bearer') {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded: { id, employee_id, name, email, role, position_id, department_id, iat, exp }
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Basic role-based guard
function requireRole(...allowedRoles) {
  const roles = allowedRoles.filter(Boolean); // remove undefined/null if any

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // If no specific roles passed, just require authenticated
    if (roles.length === 0) {
      return next();
    }

    const userRole = req.user.role;

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        message: 'Forbidden: insufficient role',
        requiredRoles: roles,
        yourRole: userRole,
      });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
