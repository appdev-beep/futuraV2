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
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Basic role-based guard
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
