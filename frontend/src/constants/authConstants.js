// src/constants/authConstants.js
// Authentication-related constants

// Role hierarchy for permission checks
export const ROLE_HIERARCHY = {
  Admin: 5,
  HR: 4,
  Manager: 3,
  AM: 2,
  Supervisor: 1,
  Employee: 0,
};

// Role-based redirect paths
export const ROLE_REDIRECTS = {
  Admin: '/admin',
  HR: '/hr',
  Manager: '/manager',
  AM: '/am',
  Supervisor: '/supervisor',
  Employee: '/employee',
};