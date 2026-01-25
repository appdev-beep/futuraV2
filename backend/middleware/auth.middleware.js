// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

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

// Check if user can approve CL for specific employee
async function canApproveCLForEmployee(userId, employeeId) {
  try {
    const [empRows] = await db.query(
      `SELECT manager_id, am_id, supervisor_id, department_id FROM users WHERE id = ?`,
      [employeeId]
    );
    
    if (!empRows.length) return false;
    
    const emp = empRows[0];
    const [userRows] = await db.query(
      `SELECT role, department_id FROM users WHERE id = ?`,
      [userId]
    );
    
    if (!userRows.length) return false;
    
    const user = userRows[0];
    
    // Individual assignments take priority
    if (emp.manager_id === userId || emp.am_id === userId || emp.supervisor_id === userId) {
      return true;
    }
    
    // Fallback to department-based roles
    if (user.department_id === emp.department_id) {
      return ['Manager', 'AM', 'Supervisor', 'HR'].includes(user.role);
    }
    
    // HR can approve any CL
    return user.role === 'HR';
  } catch (err) {
    console.error('Error checking CL approval permission:', err);
    return false;
  }
}

// Check if user can approve IDP for specific employee
async function canApproveIDPForEmployee(userId, employeeId) {
  try {
    const [empRows] = await db.query(
      `SELECT manager_id, am_id, supervisor_id, department_id FROM users WHERE id = ?`,
      [employeeId]
    );
    
    if (!empRows.length) return false;
    
    const emp = empRows[0];
    const [userRows] = await db.query(
      `SELECT role, department_id FROM users WHERE id = ?`,
      [userId]
    );
    
    if (!userRows.length) return false;
    
    const user = userRows[0];
    
    // Individual assignments take priority
    if (emp.manager_id === userId || emp.am_id === userId || emp.supervisor_id === userId) {
      return true;
    }
    
    // Fallback to department-based roles
    if (user.department_id === emp.department_id) {
      return ['Manager', 'AM', 'Supervisor', 'HR'].includes(user.role);
    }
    
    // HR can approve any IDP
    return user.role === 'HR';
  } catch (err) {
    console.error('Error checking IDP approval permission:', err);
    return false;
  }
}

// Middleware for CL approval authorization
function requireCLApprovalPermission(req, res, next) {
  return async (req, res, next) => {
    try {
      const clId = req.params.id;
      
      // Get employee ID from CL
      const [clRows] = await db.query(
        `SELECT employee_id FROM cl_headers WHERE id = ?`,
        [clId]
      );
      
      if (!clRows.length) {
        return res.status(404).json({ message: 'CL not found' });
      }
      
      const employeeId = clRows[0].employee_id;
      const canApprove = await canApproveCLForEmployee(req.user.id, employeeId);
      
      if (!canApprove) {
        return res.status(403).json({ 
          message: 'You do not have permission to approve this CL' 
        });
      }
      
      next();
    } catch (err) {
      console.error('CL approval permission check failed:', err);
      return res.status(500).json({ message: 'Permission check failed' });
    }
  };
}

// Middleware for IDP approval authorization
function requireIDPApprovalPermission(req, res, next) {
  return async (req, res, next) => {
    try {
      const idpId = req.params.id;
      
      // Get employee ID from IDP
      const [idpRows] = await db.query(
        `SELECT employee_id FROM idp_headers WHERE id = ?`,
        [idpId]
      );
      
      if (!idpRows.length) {
        return res.status(404).json({ message: 'IDP not found' });
      }
      
      const employeeId = idpRows[0].employee_id;
      const canApprove = await canApproveIDPForEmployee(req.user.id, employeeId);
      
      if (!canApprove) {
        return res.status(403).json({ 
          message: 'You do not have permission to approve this IDP' 
        });
      }
      
      next();
    } catch (err) {
      console.error('IDP approval permission check failed:', err);
      return res.status(500).json({ message: 'Permission check failed' });
    }
  };
}

// Allow access if requesting own resource (req.params.id) or if user has one of the allowed roles
function allowSelfOrRole(...allowedRoles) {
  const roles = allowedRoles.filter(Boolean);
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });

    const targetId = req.params.id || req.params.employeeId || req.params.userId;
    if (targetId && String(req.user.id) === String(targetId)) {
      return next();
    }

    if (roles.length === 0) return next();

    if (roles.includes(req.user.role)) return next();

    return res.status(403).json({ message: 'Forbidden: insufficient role' });
  };
}

module.exports = { 
  requireAuth, 
  requireRole, 
  allowSelfOrRole,
  canApproveCLForEmployee,
  canApproveIDPForEmployee,
  requireCLApprovalPermission,
  requireIDPApprovalPermission
};

