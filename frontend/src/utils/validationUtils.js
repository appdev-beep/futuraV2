// src/utils/validationUtils.js
// Form validation utilities.

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate required field
 * @param {*} value - Value to check
 * @returns {boolean} True if value is not empty
 */
export function isRequired(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Validate minimum length
 * @param {string} value - String to check
 * @param {number} min - Minimum length
 * @returns {boolean} True if meets minimum
 */
export function minLength(value, min) {
  if (!value) return false;
  return String(value).length >= min;
}

/**
 * Validate maximum length
 * @param {string} value - String to check
 * @param {number} max - Maximum length
 * @returns {boolean} True if within maximum
 */
export function maxLength(value, max) {
  if (!value) return true;
  return String(value).length <= max;
}

/**
 * Validate number range
 * @param {number} value - Number to check
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if within range
 */
export function inRange(value, min, max) {
  const num = Number(value);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
}

/**
 * Validate percentage (0-100)
 * @param {number} value - Value to check
 * @returns {boolean} True if valid percentage
 */
export function isValidPercentage(value) {
  return inRange(value, 0, 100);
}

/**
 * Validate CL total weight equals 100
 * @param {Array} items - CL items with weight property
 * @returns {Object} Validation result {valid, total, message}
 */
export function validateCLWeights(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      valid: false,
      total: 0,
      message: 'At least one competency is required',
    };
  }
  
  const total = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const valid = Math.abs(total - 100) < 0.01;
  
  return {
    valid,
    total,
    message: valid ? '' : `Total weight must equal 100% (currently ${total}%)`,
  };
}

/**
 * Validate file type
 * @param {File} file - File to validate
 * @param {Array} allowedTypes - Allowed extensions (e.g., ['.pdf', '.doc'])
 * @returns {boolean} True if file type is allowed
 */
export function isValidFileType(file, allowedTypes) {
  if (!file || !allowedTypes || allowedTypes.length === 0) return false;
  
  const fileName = file.name.toLowerCase();
  return allowedTypes.some((type) => fileName.endsWith(type.toLowerCase()));
}

/**
 * Validate file size
 * @param {File} file - File to validate
 * @param {number} maxSizeMB - Maximum size in MB
 * @returns {boolean} True if file size is within limit
 */
export function isValidFileSize(file, maxSizeMB) {
  if (!file) return false;
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
}

/**
 * Create a form validator
 * @param {Object} rules - Validation rules {fieldName: [validators]}
 * @returns {Function} Validator function
 */
export function createValidator(rules) {
  return (data) => {
    const errors = {};
    
    Object.entries(rules).forEach(([field, validators]) => {
      const value = data[field];
      
      for (const validator of validators) {
        const result = validator(value, data);
        if (result !== true) {
          errors[field] = result;
          break;
        }
      }
    });
    
    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  };
}

export default {
  isValidEmail,
  isRequired,
  minLength,
  maxLength,
  inRange,
  isValidPercentage,
  validateCLWeights,
  isValidFileType,
  isValidFileSize,
  createValidator,
};
