// src/components/NotificationPanel.jsx
// Reusable notification panel component for sidebars.
// Consolidates notification display logic from dashboards.

import React from 'react';
import { BellIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import { ModuleBadge } from './StatusBadge';

/**
 * Notification panel for dashboard sidebars
 * @param {Array} notifications - Array of notification objects
 * @param {number} unreadCount - Count of unread notifications
 * @param {string} filter - Current filter value ('ALL', 'CL', 'IDP')
 * @param {Function} onFilterChange - Filter change handler
 * @param {Function} onNotificationClick - Notification click handler
 * @param {Function} onExpandClick - Expand button click handler
 */
export function NotificationPanel({
  notifications = [],
  unreadCount = 0,
  filter = 'ALL',
  onFilterChange,
  onNotificationClick,
  onExpandClick,
}) {
  return (
    <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
      {/* Header */}
      <button
        onClick={onExpandClick}
        className="p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-2">
          <BellIcon className="w-5 h-5 text-orange-500" />
          <span className="text-sm font-semibold text-gray-700">Notifications</span>
          <ArrowsPointingOutIcon className="w-4 h-4 text-gray-400" />
        </div>

        {unreadCount > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500 text-white">
            {unreadCount}
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
                ? 'bg-orange-50 border-orange-300 text-orange-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2 no-scrollbar">
        {notifications.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No notifications.</p>
        ) : (
          notifications.map((n, idx) => {
            const isUnread = String(n.status || '').toLowerCase() === 'unread';
            return (
              <button
                key={`${n.id}-${idx}`}
                type="button"
                onClick={() => onNotificationClick?.(n)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                  isUnread ? 'bg-orange-50 hover:bg-orange-100' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {n.module && <ModuleBadge module={n.module} />}
                  <p className="font-medium text-gray-800 whitespace-pre-wrap">
                    {n.message || n.title || 'Notification'}
                  </p>
                </div>
                {n.created_at && (
                  <p className="text-[11px] text-gray-400">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default NotificationPanel;
