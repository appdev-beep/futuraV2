// src/hooks/useProficiency.js
// Custom hook for proficiency level calculations and mappings.
// Consolidates proficiency logic scattered across review pages.

import { useMemo, useCallback } from 'react';

// Proficiency levels and their descriptions
export const PROFICIENCY_LEVELS = [
  { level: 1, name: 'Basic', description: 'Has basic knowledge or awareness of the competency. Requires significant guidance.' },
  { level: 2, name: 'Developing', description: 'Has developing skills. Can perform tasks with some guidance.' },
  { level: 3, name: 'Proficient', description: 'Has proficient skills. Can perform tasks independently.' },
  { level: 4, name: 'Advanced', description: 'Has advanced skills. Can guide others and handle complex situations.' },
  { level: 5, name: 'Expert', description: 'Has expert-level mastery. Recognized as a subject matter expert.' },
];

// Score-to-proficiency mapping
const SCORE_TO_PROFICIENCY = {
  1: 'Basic',
  2: 'Developing',
  3: 'Proficient',
  4: 'Advanced',
  5: 'Expert',
};

// Scoring guide for IDP (matching SupervisorDashboard.jsx)
export const SCORING_GUIDE = [
  { score: 5, description: 'Exceptional & Completed: Exceeded expectations, demonstrated mastery beyond the target level. Project/activity is completed, and impact is notable.', status: 'Completed & Exceeded Competency' },
  { score: 4, description: 'Advanced & Completed: Fully met expectations with proficiency at or slightly above the target level. The project/activity is fully completed.', status: 'Completed & Above Target Expectation' },
  { score: 3, description: 'Proficient & Completed: Met most expectations, demonstrated proficiency at the target level. The project/activity is fully completed.', status: 'Completed & Met Expectations' },
  { score: 2, description: 'Developing & Incomplete: Some progress made, but competency is below the target level. The project/activity is incomplete or partially completed.', status: 'In Progress (50-79% Completed)' },
  { score: 1, description: 'Basic & Not Started: Little to no progress in competency development. The project/activity is not started or significantly behind schedule.', status: 'Not Started/In Progress (<50%)' },
];

/**
 * Custom hook for proficiency calculations
 * @returns {Object} Proficiency utilities and constants
 */
export function useProficiency() {
  // Convert score to proficiency name
  const scoreToProficiency = useCallback((score) => {
    if (score == null || score === '') return '-';
    const numScore = Number(score);
    if (numScore < 1 || numScore > 5) return '-';
    return SCORE_TO_PROFICIENCY[numScore] || '-';
  }, []);

  // Calculate weighted score for CL items
  const calculateWeightedScore = useCallback((weight, level) => {
    const w = Number(weight) || 0;
    const l = Number(level) || 0;
    return ((w / 100) * l).toFixed(2);
  }, []);

  // Calculate total score from CL items
  const calculateTotalScore = useCallback((items) => {
    if (!items || !Array.isArray(items) || items.length === 0) return 0;
    
    return items.reduce((sum, item) => {
      const weight = Number(item.weight) || 0;
      const level = Number(item.assigned_level) || 0;
      return sum + (weight / 100) * level;
    }, 0);
  }, []);

  // Get proficiency level object by level number
  const getProficiencyLevel = useCallback((level) => {
    const numLevel = Number(level);
    return PROFICIENCY_LEVELS.find((p) => p.level === numLevel) || null;
  }, []);

  // Get scoring guide entry by score
  const getScoringGuide = useCallback((score) => {
    const numScore = Number(score);
    return SCORING_GUIDE.find((s) => s.score === numScore) || null;
  }, []);

  // Memoized proficiency level options for dropdowns
  const proficiencyOptions = useMemo(() => {
    return PROFICIENCY_LEVELS.map((p) => ({
      value: p.level,
      label: `${p.level} - ${p.name}`,
      description: p.description,
    }));
  }, []);

  // Memoized scoring options for dropdowns
  const scoringOptions = useMemo(() => {
    return SCORING_GUIDE.map((s) => ({
      value: s.score,
      label: `${s.score} - ${s.status}`,
      description: s.description,
    }));
  }, []);

  return {
    // Constants
    PROFICIENCY_LEVELS,
    SCORING_GUIDE,
    
    // Functions
    scoreToProficiency,
    calculateWeightedScore,
    calculateTotalScore,
    getProficiencyLevel,
    getScoringGuide,
    
    // Options for dropdowns
    proficiencyOptions,
    scoringOptions,
  };
}

export default useProficiency;
