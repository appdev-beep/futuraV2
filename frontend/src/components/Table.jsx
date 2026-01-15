// src/components/Table.jsx
// Reusable table components for consistent styling.
// Replaces duplicate Th/Td implementations across 5+ pages.

import React from 'react';

/**
 * Table header cell component
 */
export function Th({ children, className = '', ...props }) {
  return (
    <th 
      className={`px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

/**
 * Table data cell component
 */
export function Td({ children, className = '', ...props }) {
  return (
    <td 
      className={`px-4 py-2 text-gray-700 ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * Table wrapper component with standard styling
 */
export function Table({ children, className = '', ...props }) {
  return (
    <div className={`bg-white shadow rounded overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 text-sm" {...props}>
        {children}
      </table>
    </div>
  );
}

/**
 * Table header component
 */
export function TableHead({ children, className = '', ...props }) {
  return (
    <thead className={`bg-gray-50 ${className}`} {...props}>
      {children}
    </thead>
  );
}

/**
 * Table body component
 */
export function TableBody({ children, className = '', ...props }) {
  return (
    <tbody className={`divide-y divide-gray-200 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

/**
 * Table row component with hover effect
 */
export function TableRow({ children, className = '', onClick, ...props }) {
  const rowClasses = `hover:bg-gray-50${onClick ? ' cursor-pointer' : ''} ${className}`;
  
  return (
    <tr className={rowClasses} onClick={onClick} {...props}>
      {children}
    </tr>
  );
}

/**
 * Empty state for tables
 */
export function TableEmpty({ message = 'No data available', colSpan = 1 }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">
        {message}
      </td>
    </tr>
  );
}

/**
 * Loading state for tables
 */
export function TableLoading({ colSpan = 1, message = 'Loading...' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">
        <div className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
          <span>{message}</span>
        </div>
      </td>
    </tr>
  );
}

export default {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableEmpty,
  TableLoading,
  Th,
  Td,
};
