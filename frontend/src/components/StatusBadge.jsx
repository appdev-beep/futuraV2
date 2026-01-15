// src/components/StatusBadge.jsx
// Reusable status badge component for consistent status display.

import React from 'react';
import { displayStatus } from '../constants/statusConstants';

// Status-to-color mapping
const STATUS_STYLES = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-300',
  PENDING_EMPLOYEE: 'bg-yellow-50 text-yellow-700 border-yellow-300',
  PENDING_SUPERVISOR: 'bg-blue-50 text-blue-700 border-blue-300',
  PENDING_HR: 'bg-purple-50 text-purple-700 border-purple-300',
  PENDING_AM: 'bg-orange-50 text-orange-700 border-orange-300',
  PENDING_MANAGER: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  FOR_COMPLETION: 'bg-cyan-50 text-cyan-700 border-cyan-300',
  APPROVED: 'bg-green-50 text-green-700 border-green-300',
  CYCLE_COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  REJECTED: 'bg-red-50 text-red-700 border-red-300',
  RETURNED: 'bg-amber-50 text-amber-700 border-amber-300',
};

/**
 * Status badge component for displaying status with appropriate styling
 * @param {string} status - Status key (e.g., 'PENDING_EMPLOYEE', 'APPROVED')
 * @param {string} size - Badge size: 'sm' | 'md' | 'lg'
 * @param {boolean} showBorder - Whether to show border
 * @param {string} className - Additional CSS classes
 */
export function StatusBadge({ 
  status, 
  size = 'sm',
  showBorder = true,
  className = '',
}) {
  if (!status) return null;

  const normalizedStatus = String(status).toUpperCase();
  const displayText = displayStatus(status);
  
  // Find matching style or default to gray
  let styleClasses = STATUS_STYLES[normalizedStatus];
  if (!styleClasses) {
    // Check for PENDING_* prefix
    if (normalizedStatus.startsWith('PENDING_')) {
      styleClasses = 'bg-blue-50 text-blue-700 border-blue-300';
    } else {
      styleClasses = 'bg-gray-100 text-gray-700 border-gray-300';
    }
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const borderClass = showBorder ? 'border' : '';

  return (
    <span 
      className={`inline-flex items-center rounded-full font-medium ${styleClasses} ${sizeClasses[size]} ${borderClass} ${className}`}
    >
      {displayText}
    </span>
  );
}

/**
 * Module badge for CL/IDP indicators
 */
export function ModuleBadge({ module, className = '' }) {
  const styles = {
    CL: 'bg-blue-100 text-blue-700 border-blue-200',
    IDP: 'bg-green-100 text-green-700 border-green-200',
  };

  const styleClasses = styles[module] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span 
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${styleClasses} ${className}`}
    >
      {module}
    </span>
  );
}

export default StatusBadge;
