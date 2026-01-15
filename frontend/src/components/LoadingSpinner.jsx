// src/components/LoadingSpinner.jsx
// Reusable loading spinner component.

import React from 'react';

/**
 * Loading spinner component
 * @param {string} size - Spinner size: 'sm' | 'md' | 'lg'
 * @param {string} message - Optional loading message
 * @param {boolean} fullPage - Whether to center in full page
 */
export function LoadingSpinner({ 
  size = 'md', 
  message = '',
  fullPage = false,
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  };

  const content = (
    <div className="inline-flex items-center gap-2 text-slate-600">
      <svg className={`animate-spin ${sizeClasses[size]}`} viewBox="0 0 24 24">
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4" 
          fill="none" 
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
        />
      </svg>
      {message && <span className="font-medium">{message}</span>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {content}
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      {content}
    </div>
  );
}

export default LoadingSpinner;
