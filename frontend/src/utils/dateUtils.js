// src/utils/dateUtils.js
// Date formatting and manipulation utilities.

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  if (!date) return '-';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(undefined, { ...defaultOptions, ...options });
  } catch {
    return '-';
  }
}

/**
 * Format date and time for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(date) {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  } catch {
    return '-';
  }
}

/**
 * Format date for input fields (YYYY-MM-DD)
 * @param {string|Date} date - Date to format
 * @returns {string} ISO date string
 */
export function formatDateForInput(date) {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {string|Date} date - Date to compare
 * @returns {string} Relative time string
 */
export function getRelativeTime(date) {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    
    const now = new Date();
    const diffMs = now - d;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return formatDate(date);
  } catch {
    return '-';
  }
}

/**
 * Check if date is in the past
 * @param {string|Date} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isPastDate(date) {
  if (!date) return false;
  
  try {
    const d = new Date(date);
    return d < new Date();
  } catch {
    return false;
  }
}

/**
 * Check if date is within a range
 * @param {string|Date} date - Date to check
 * @param {string|Date} start - Range start
 * @param {string|Date} end - Range end
 * @returns {boolean} True if date is within range
 */
export function isDateInRange(date, start, end) {
  if (!date || !start || !end) return false;
  
  try {
    const d = new Date(date);
    const s = new Date(start);
    const e = new Date(end);
    return d >= s && d <= e;
  } catch {
    return false;
  }
}

export default {
  formatDate,
  formatDateTime,
  formatDateForInput,
  getRelativeTime,
  isPastDate,
  isDateInRange,
};
