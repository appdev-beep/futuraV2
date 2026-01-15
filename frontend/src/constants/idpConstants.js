// src/constants/idpConstants.js
// Centralized IDP-related constants.
// Migrated from pages/Supervisor/idpConstants.js for shared access.

// IDP completion status options for dropdowns
export const COMPLETION_STATUS_OPTIONS = [
  'Not Started/In Progress (<50%)',
  'In Progress (50-79% Completed)',
  'Completed & Met Expectations',
  'Completed & Above Target Expectation',
  'Completed & Exceeded Competency',
];

// Development activity types (70-20-10 model)
export const DEVELOPMENT_TYPES = ['Education', 'Experience', 'Exposure'];

// Education/training justification options
export const EDUCATION_JUSTIFICATIONS = [
  'Course/Training',
  'Certification',
  'Degree Program',
  'Conference/Workshop',
  'On-the-job/Project',
  'Self-study',
  'Other',
];

// IDP scoring guide for supervisor evaluation
export const SCORING_GUIDE = [
  {
    score: 5,
    description: 'Exceptional & Completed: Exceeded expectations, demonstrated mastery beyond the target level. Project/activity is completed, and impact is notable.',
    status: 'Completed & Exceeded Competency',
  },
  {
    score: 4,
    description: 'Advanced & Completed: Fully met expectations with proficiency at or slightly above the target level. The project/activity is fully completed.',
    status: 'Completed & Above Target Expectation',
  },
  {
    score: 3,
    description: 'Proficient & Completed: Met most expectations, demonstrated proficiency at the target level. The project/activity is fully completed.',
    status: 'Completed & Met Expectations',
  },
  {
    score: 2,
    description: 'Developing & Incomplete: Some progress made, but competency is below the target level. The project/activity is incomplete or partially completed.',
    status: 'In Progress (50-79% Completed)',
  },
  {
    score: 1,
    description: 'Basic & Not Started: Little to no progress in competency development. The project/activity is not started or significantly behind schedule.',
    status: 'Not Started/In Progress (<50%)',
  },
];

// Default empty IDP activity structure
export const EMPTY_ACTIVITY = {
  development_type: '',
  description: '',
  target_start_date: '',
  target_end_date: '',
  actual_start_date: '',
  actual_end_date: '',
  justification: '',
  completion_status: '',
  supervisor_score: null,
  supervisor_remarks: '',
  attachments: [],
};

// IDP form validation rules
export const IDP_VALIDATION = {
  MIN_ACTIVITIES: 1,
  MAX_ACTIVITIES: 20,
  MIN_DESCRIPTION_LENGTH: 10,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_REMARKS_LENGTH: 500,
  ALLOWED_FILE_TYPES: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'],
  MAX_FILE_SIZE_MB: 10,
};

export default {
  COMPLETION_STATUS_OPTIONS,
  DEVELOPMENT_TYPES,
  EDUCATION_JUSTIFICATIONS,
  SCORING_GUIDE,
  EMPTY_ACTIVITY,
  IDP_VALIDATION,
};
