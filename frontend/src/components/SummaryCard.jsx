// src/components/SummaryCard.jsx
// Reusable summary card component for dashboard stats.
// Replaces 5+ duplicate implementations across pages.

import React from 'react';

/**
 * Summary card for displaying dashboard statistics
 * @param {string} label - Card label/title
 * @param {number|string} value - Value to display
 * @param {string} gradientClass - Tailwind gradient classes (e.g., "from-blue-500 to-blue-700")
 * @param {React.ReactNode} icon - Optional icon component
 * @param {Function} onClick - Optional click handler
 */
export function SummaryCard({ 
  label, 
  value, 
  gradientClass = 'from-blue-500 to-blue-700',
  icon,
  onClick,
}) {
  const cardClasses = `p-4 rounded shadow-md bg-gradient-to-r ${gradientClass}${onClick ? ' cursor-pointer hover:shadow-lg transition' : ''}`;
  
  const content = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm text-white/80">{label}</h3>
          <p className="text-3xl font-semibold text-white mt-1">{value}</p>
        </div>
        {icon && (
          <div className="text-white/80">
            {icon}
          </div>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cardClasses} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={cardClasses}>{content}</div>;
}

/**
 * White background summary card variant (used in Employee Dashboard)
 */
export function SummaryCardWhite({
  label,
  value,
  icon,
  iconBgClass = 'bg-blue-50',
  iconColorClass = 'text-blue-600',
  valueColorClass = 'text-blue-600',
  onClick,
}) {
  const cardClasses = `bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition${onClick ? ' cursor-pointer' : ''}`;

  const content = (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
        <p className={`text-3xl font-bold ${valueColorClass}`}>{value}</p>
      </div>
      {icon && (
        <div className={`w-12 h-12 rounded-lg ${iconBgClass} flex items-center justify-center`}>
          <span className={iconColorClass}>{icon}</span>
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" className={cardClasses} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={cardClasses}>{content}</div>;
}

export default SummaryCard;
