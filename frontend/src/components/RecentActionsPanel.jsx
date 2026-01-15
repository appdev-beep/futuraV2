// src/components/RecentActionsPanel.jsx
// Reusable recent actions panel component for sidebars.
// Consolidates recent actions display logic from dashboards.

import React from 'react';
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import { ModuleBadge } from './StatusBadge';

/**
 * Recent actions panel for dashboard sidebars
 * @param {Array} recentActions - Array of action objects
 * @param {string} filter - Current filter value ('ALL', 'CL', 'IDP')
 * @param {Function} onFilterChange - Filter change handler
 * @param {Function} onActionClick - Action click handler
 * @param {Function} onExpandClick - Expand button click handler
 * @param {number} maxItems - Maximum items to show (default: 10)
 */
export function RecentActionsPanel({
  recentActions = [],
  filter = 'ALL',
  onFilterChange,
  onActionClick,
  onExpandClick,
  maxItems = 10,
}) {
  return (
    <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
      {/* Header */}
      <button
        onClick={onExpandClick}
        className="p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Recent Actions</span>
          <ArrowsPointingOutIcon className="w-4 h-4 text-gray-400" />
        </div>
        {recentActions.length > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white">
            {recentActions.length}
          </span>
        )}
      </button>

      {/* Filter controls */}
      <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-200">
        {['ALL', 'CL', 'IDP'].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onFilterChange?.(opt)}
            className={`px-2 py-1 rounded text-xs border transition ${
              filter === opt
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Actions list */}
      <div className="flex-1 p-2 overflow-y-auto no-scrollbar">
        {recentActions.length === 0 ? (
          <p className="text-xs text-gray-400 italic px-2">No recent actions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left font-semibold text-gray-600">Action</th>
                  <th className="px-2 py-1 text-left font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentActions.slice(0, maxItems).map((a, idx) => (
                  <tr
                    key={`${a.id}-${idx}`}
                    onClick={() => onActionClick?.(a)}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-2 py-2">
                      <p className="font-medium text-gray-800 truncate">{a.title || 'Action'}</p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-600">
                        {a.module && <ModuleBadge module={a.module} />}
                        {a.description && (
                          <span className="truncate">{a.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-gray-500 whitespace-nowrap">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecentActionsPanel;
