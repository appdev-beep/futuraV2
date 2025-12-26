// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

// Read JWT and attach req.user
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    console.log('AUTH DEBUG: header:', authHeader);
    if (!token || scheme !== 'Bearer') {
      console.log('AUTH DEBUG: Missing or invalid scheme/token');
      return res.status(401).json({ message: 'Authentication required' });
    }
    console.log('AUTH DEBUG: token:', token);
    console.log('AUTH DEBUG: JWT_SECRET:', process.env.JWT_SECRET);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      console.log('AUTH DEBUG: jwt.verify error:', e.message);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    console.log('AUTH DEBUG: decoded:', decoded);
    if (!decoded || !decoded.id) {
      console.log('AUTH DEBUG: Invalid token payload');
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
      console.log('ROLE DEBUG: No req.user');
      return res.status(401).json({ message: 'Authentication required' });
    }
    // If no specific roles passed, just require authenticated
    if (roles.length === 0) {
      return next();
    }
    const userRole = req.user.role;
    console.log('ROLE DEBUG: required:', roles, 'userRole:', userRole);
    if (!roles.includes(userRole)) {
      console.log('ROLE DEBUG: Forbidden, insufficient role');
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
