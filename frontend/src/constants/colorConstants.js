// src/constants/colorConstants.js
// Centralized color constants for consistent theming.
// These map to Tailwind CSS classes and raw hex values.

// Crayon/palette colors for color pickers (IDP activities, etc.)
export const CRAYON_COLORS = [
  '#FF6B35', '#F7931E', '#FFD23F', '#FFF200', '#8BC34A', '#4CAF50', '#009688', '#00BCD4',
  '#2196F3', '#3F51B5', '#9C27B0', '#E91E63', '#F44336', '#FF5722', '#795548', '#9E9E9E',
  '#607D8B', '#FFE0B2', '#FFCCBC', '#D7CCC8', '#F1F8E9', '#E8F5E8', '#E0F2F1', '#E0F7FA',
  '#E1F5FE', '#E3F2FD', '#E8EAF6', '#F3E5F5', '#FCE4EC', '#FFEBEE', '#FFF3E0', '#F9FBE7',
  '#FF80AB', '#FF4081', '#AD1457', '#880E4F', '#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA',
  '#9C27B0', '#AB47BC', '#BA68C8', '#CE93D8', '#DA80CB', '#F8BBD9', '#F48FB1', '#F06292',
  '#EC407A', '#E91E63', '#C2185B', '#AD1457', '#880E4F', '#FF1744', '#F44336', '#E53935',
  '#D32F2F', '#C62828', '#B71C1C', '#FF5722', '#F4511E', '#E64A19', '#D84315', '#BF360C',
  '#FF9800', '#F57C00', '#EF6C00', '#E65100', '#FF6F00', '#FF8F00', '#FFA000', '#FFB300',
  '#FFC107', '#FFD54F', '#FFEB3B', '#F9A825', '#F57F17', '#827717', '#9E9D24', '#AFB42B',
  '#CDDC39', '#D4E157', '#DCEDC8', '#C5E1A5', '#AED581', '#9CCC65', '#8BC34A', '#7CB342',
  '#689F38', '#558B2F', '#33691E', '#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#4CAF50',
  '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9', '#E8F5E8', '#00C853', '#00E676', '#69F0AE',
  '#B9F6CA', '#00695C', '#00796B', '#00897B', '#009688', '#26A69A', '#4DB6AC', '#80CBC4',
  '#B2DFDB', '#E0F2F1', '#A7FFEB', '#64FFDA', '#1DE9B6', '#00BFA5', '#006064', '#00838F',
  '#0097A7', '#00ACC1', '#00BCD4', '#26C6DA', '#4DD0E1', '#80DEEA', '#B2EBF2', '#E0F7FA',
  '#84FFFF', '#18FFFF', '#00E5FF', '#00B8D4', '#01579B', '#0277BD', '#0288D1', '#039BE5',
  '#03A9F4', '#29B6F6', '#4FC3F7', '#81D4FA', '#B3E5FC', '#E1F5FE', '#80D8FF', '#40C4FF',
  '#00B0FF', '#0091EA', '#1A237E', '#283593', '#303F9F', '#3949AB', '#3F51B5', '#5C6BC0',
  '#7986CB', '#9FA8DA', '#C5CAE9', '#E8EAF6', '#8C9EFF', '#536DFE', '#3D5AFE', '#304FFE',
  '#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA', '#9C27B0', '#AB47BC', '#BA68C8', '#CE93D8',
  '#E1BEE7', '#F3E5F5', '#EA80FC', '#E040FB', '#D500F9', '#AA00FF', '#3E2723', '#5D4037',
  '#6D4C41', '#795548', '#8D6E63', '#A1887F', '#BCAAA4', '#D7CCC8', '#EFEBE9', '#8D6E63',
  '#A1887F', '#BCAAA4', '#263238', '#37474F', '#455A64', '#546E7A', '#607D8B', '#78909C',
  '#90A4AE', '#B0BEC5', '#CFD8DC', '#ECEFF1', '#90A4AE', '#B0BEC5', '#CFD8DC', '#000000',
  '#212121', '#424242', '#616161', '#757575', '#9E9E9E', '#BDBDBD', '#E0E0E0', '#EEEEEE',
  '#F5F5F5', '#FAFAFA', '#FFFFFF',
];

// Status badge colors (Tailwind class suffixes)
export const STATUS_COLORS = {
  DRAFT: 'gray',
  PENDING_EMPLOYEE: 'yellow',
  PENDING_SUPERVISOR: 'blue',
  PENDING_HR: 'purple',
  PENDING_AM: 'orange',
  PENDING_MANAGER: 'indigo',
  FOR_COMPLETION: 'cyan',
  APPROVED: 'green',
  CYCLE_COMPLETED: 'emerald',
  REJECTED: 'red',
  RETURNED: 'amber',
};

// Gradient classes for summary cards
export const GRADIENT_CLASSES = {
  blue: 'from-blue-500 to-blue-700',
  green: 'from-green-500 to-green-700',
  purple: 'from-purple-500 to-purple-700',
  orange: 'from-orange-500 to-orange-700',
  red: 'from-red-500 to-red-700',
  indigo: 'from-indigo-500 to-indigo-700',
  cyan: 'from-cyan-500 to-cyan-700',
  emerald: 'from-emerald-500 to-emerald-700',
  gray: 'from-gray-500 to-gray-700',
};

// Background colors for sections
export const SECTION_BG_COLORS = {
  CL: 'bg-blue-50',
  IDP: 'bg-green-50',
  neutral: 'bg-gray-50',
};

// Icon colors by module
export const ICON_COLORS = {
  CL: 'text-blue-600',
  IDP: 'text-green-600',
  notification: 'text-orange-500',
  action: 'text-gray-600',
};

/**
 * Get Tailwind color classes for a status
 * @param {string} status - Status key
 * @returns {Object} Object with bg, text, and border classes
 */
export function getStatusColorClasses(status) {
  const color = STATUS_COLORS[status] || 'gray';
  return {
    bg: `bg-${color}-100`,
    text: `text-${color}-700`,
    border: `border-${color}-300`,
    badge: `bg-${color}-50 text-${color}-700 border-${color}-200`,
  };
}

export default {
  CRAYON_COLORS,
  STATUS_COLORS,
  GRADIENT_CLASSES,
  SECTION_BG_COLORS,
  ICON_COLORS,
  getStatusColorClasses,
};
