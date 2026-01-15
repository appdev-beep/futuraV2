// src/constants/clConstants.js
// Centralized CL (Competency Leveling) related constants.

// CL form validation rules
export const CL_VALIDATION = {
  MIN_COMPETENCIES: 1,
  MAX_COMPETENCIES: 50,
  MIN_WEIGHT: 0,
  MAX_WEIGHT: 100,
  TOTAL_WEIGHT_REQUIRED: 100,
  MAX_JUSTIFICATION_LENGTH: 500,
};

// Proficiency levels for CL
export const PROFICIENCY_LEVELS = [
  { level: 1, name: 'Basic', description: 'Has basic knowledge or awareness of the competency. Requires significant guidance.' },
  { level: 2, name: 'Developing', description: 'Has developing skills. Can perform tasks with some guidance.' },
  { level: 3, name: 'Proficient', description: 'Has proficient skills. Can perform tasks independently.' },
  { level: 4, name: 'Advanced', description: 'Has advanced skills. Can guide others and handle complex situations.' },
  { level: 5, name: 'Expert', description: 'Has expert-level mastery. Recognized as a subject matter expert.' },
];

// Default empty CL item structure
export const EMPTY_CL_ITEM = {
  competency_id: null,
  competency_name: '',
  weight: 0,
  assigned_level: null,
  justification: '',
};

// Score-to-proficiency mapping
export const SCORE_TO_PROFICIENCY = {
  1: 'Basic',
  2: 'Developing',
  3: 'Proficient',
  4: 'Advanced',
  5: 'Expert',
};

/**
 * Calculate weighted score for a CL item
 * @param {number} weight - Weight percentage (0-100)
 * @param {number} level - Proficiency level (1-5)
 * @returns {number} Weighted score
 */
export function calculateWeightedScore(weight, level) {
  const w = Number(weight) || 0;
  const l = Number(level) || 0;
  return (w / 100) * l;
}

/**
 * Calculate total score from CL items
 * @param {Array} items - Array of CL items with weight and assigned_level
 * @returns {number} Total score
 */
export function calculateTotalScore(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return 0;
  
  return items.reduce((sum, item) => {
    return sum + calculateWeightedScore(item.weight, item.assigned_level);
  }, 0);
}

/**
 * Validate total weight equals 100%
 * @param {Array} items - Array of CL items with weight
 * @returns {boolean} True if total weight is 100
 */
export function validateTotalWeight(items) {
  if (!items || !Array.isArray(items) || items.length === 0) return false;
  
  const totalWeight = items.reduce((sum, item) => {
    return sum + (Number(item.weight) || 0);
  }, 0);
  
  return Math.abs(totalWeight - 100) < 0.01; // Allow small floating point variance
}

/**
 * Get proficiency level details by level number
 * @param {number} level - Proficiency level (1-5)
 * @returns {Object|null} Level details or null
 */
export function getProficiencyLevel(level) {
  const numLevel = Number(level);
  return PROFICIENCY_LEVELS.find((p) => p.level === numLevel) || null;
}

/**
 * Convert score to proficiency name
 * @param {number} score - Score value (1-5)
 * @returns {string} Proficiency name or '-'
 */
export function scoreToProficiency(score) {
  if (score == null || score === '') return '-';
  const numScore = Number(score);
  if (numScore < 1 || numScore > 5) return '-';
  return SCORE_TO_PROFICIENCY[numScore] || '-';
}

export default {
  CL_VALIDATION,
  PROFICIENCY_LEVELS,
  EMPTY_CL_ITEM,
  SCORE_TO_PROFICIENCY,
  calculateWeightedScore,
  calculateTotalScore,
  validateTotalWeight,
  getProficiencyLevel,
  scoreToProficiency,
};
