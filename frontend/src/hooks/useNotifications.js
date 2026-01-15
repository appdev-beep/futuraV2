// src/hooks/useNotifications.js
// Custom hook for notification polling and management.
// Consolidates notification logic from EmployeeDashboard, ManagerDashboard, SupervisorDashboard.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiRequest } from '../api/client';

/**
 * Custom hook for managing notifications with polling
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether to enable polling (default: true)
 * @param {number} options.pollingInterval - Polling interval in ms (default: 15000)
 * @param {string} options.initialFilter - Initial filter value (default: 'ALL')
 * @returns {Object} Notification state and control functions
 */
export function useNotifications(options = {}) {
  const {
    enabled = true,
    pollingInterval = 15000,
    initialFilter = 'ALL',
  } = options;

  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState(initialFilter);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      const query = filter === 'ALL' ? '' : `?module=${filter}`;
      const data = await apiRequest(`/api/notifications${query}`);
      setNotifications(data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [enabled, filter]);

  // Initial load and polling
  useEffect(() => {
    if (!enabled) return;

    loadNotifications();
    const timer = setInterval(loadNotifications, pollingInterval);

    return () => clearInterval(timer);
  }, [enabled, pollingInterval, loadNotifications]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiRequest(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
      // Reload to get updated list
      await loadNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [loadNotifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiRequest('/api/notifications/mark-all-read', { method: 'PATCH' });
      // Reload to get updated list
      await loadNotifications();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [loadNotifications]);

  // Count unread notifications
  const unreadCount = useMemo(() => {
    return notifications.filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  // Filter notifications by module
  const filteredNotifications = useMemo(() => {
    if (filter === 'ALL') return notifications;
    return notifications.filter((n) => n.module === filter);
  }, [notifications, filter]);

  return {
    notifications,
    filteredNotifications,
    filter,
    setFilter,
    loading,
    error,
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications,
  };
}

export default useNotifications;
