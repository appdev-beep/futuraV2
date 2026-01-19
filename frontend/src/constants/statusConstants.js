// src/constants/statusConstants.js
// Centralized status-related constants and mappings.
// Used across CL and IDP features for consistent status display.

// Status keys used in the system
export const STATUS_KEYS = {
  DRAFT: 'DRAFT',
  PENDING_EMPLOYEE: 'PENDING_EMPLOYEE',
  PENDING_SUPERVISOR: 'PENDING_SUPERVISOR',
  PENDING_HR: 'PENDING_HR',
  PENDING_AM: 'PENDING_AM',
  PENDING_MANAGER: 'PENDING_MANAGER',
  FOR_COMPLETION: 'FOR_COMPLETION',
  APPROVED: 'APPROVED',
  CYCLE_COMPLETED: 'CYCLE_COMPLETED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
};

// Human-readable status display mapping
export const STATUS_DISPLAY_MAP = {
  PENDING_EMPLOYEE: 'For Employee Approval',
  'PENDING - EMPLOYEE': 'For Employee Approval',
  EMPLOYEE: 'For Employee Approval',
  PENDING_SUPERVISOR: 'For Supervisor Approval',
  PENDING_MANAGER: 'For Manager Approval',
  PENDING_HR: 'For HR Approval',
  PENDING_AM: 'For Assistant Manager Review',
  PENDING_AM_APPROVAL: 'For Assistant Manager Review',
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  CYCLE_COMPLETED: 'Cycle Completed',
  FOR_COMPLETION: 'For Completion',
  REJECTED: 'Rejected',
  RETURNED: 'Returned for Review',
  UNREAD: 'Unread',
};

// CL Status sections for sidebar navigation
export const CL_STATUS_SECTIONS_BASE = [
  { key: 'DRAFT', label: 'Returned for Review' },
  { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee' },
  { key: 'PENDING_HR', label: 'For Approval by HR' },
  // PENDING_AM is conditionally added based on department.has_am
  { key: 'PENDING_MANAGER', label: 'For Approval by Manager' },
  { key: 'APPROVED', label: 'Approved' },
];

// IDP Status sections for sidebar navigation
export const IDP_STATUS_SECTIONS_BASE = [
  { key: 'DRAFT', label: 'Returned for Review' },
  { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee' },
  { key: 'PENDING_HR', label: 'For Approval by HR' },
  // PENDING_AM is conditionally added based on department.has_am
  { key: 'FOR_COMPLETION', label: 'For Completion' },
  { key: 'PENDING_MANAGER', label: 'For Approval by Manager' },
  { key: 'CYCLE_COMPLETED', label: 'Cycle Completed' },
];

// Notification status values
export const NOTIFICATION_STATUS = {
  READ: 'read',
  UNREAD: 'unread',
};

// Module types for filtering
export const MODULE_TYPES = {
  CL: 'CL',
  IDP: 'IDP',
  ALL: 'ALL',
};

/**
 * Get human-readable status display string
 * @param {string} status - The status key
 * @returns {string} Human-readable status
 */
export function displayStatus(status) {
  if (status === null || status === undefined) return status;
  const key = String(status).trim().toUpperCase();

  // First check the explicit mapping
  if (STATUS_DISPLAY_MAP[key]) {
    return STATUS_DISPLAY_MAP[key];
  }

  // Handle dynamic PENDING_* statuses only if not in explicit mapping
  if (key.startsWith('PENDING_')) {
    const rest = key.slice('PENDING_'.length).toLowerCase();
    return `For ${rest.charAt(0).toUpperCase() + rest.slice(1)} Approval`;
  }

  return String(status);
}

/**
 * Build CL status sections based on department configuration
 * @param {Object} department - Department object with has_am flag
 * @returns {Array} Status sections array
 */
export function buildCLStatusSections(department) {
  const sections = [
    { key: 'DRAFT', label: 'Returned for Review' },
    { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee' },
    { key: 'PENDING_HR', label: 'For Approval by HR' },
  ];
  
  if (department && department.has_am) {
    sections.push({ key: 'PENDING_AM', label: 'For Assistant Manager Review' });
  }
  
  sections.push({ key: 'PENDING_MANAGER', label: 'For Approval by Manager' });
  sections.push({ key: 'APPROVED', label: 'Approved' });
  
  return sections;
}

/**
 * Build IDP status sections based on department configuration
 * @param {Object} department - Department object with has_am flag
 * @returns {Array} Status sections array
 */
export function buildIDPStatusSections(department) {
  const sections = [
    { key: 'DRAFT', label: 'Returned for Review' },
    { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee' },
    { key: 'PENDING_HR', label: 'For Approval by HR' },
  ];
  
  if (department && department.has_am) {
    sections.push({ key: 'PENDING_AM', label: 'For Assistant Manager Review' });
  }
  
  sections.push({ key: 'FOR_COMPLETION', label: 'For Completion' });
  sections.push({ key: 'PENDING_MANAGER', label: 'For Approval by Manager' });
  sections.push({ key: 'CYCLE_COMPLETED', label: 'Cycle Completed' });
  
  return sections;
}

export default {
  STATUS_KEYS,
  STATUS_DISPLAY_MAP,
  displayStatus,
  buildCLStatusSections,
  buildIDPStatusSections,
};
