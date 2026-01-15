// src/hooks/useRecentActions.js
// Custom hook for recent actions management.
// Consolidates recent actions logic from dashboard pages.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiRequest } from '../api/client';

/**
 * Custom hook for managing recent actions
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether to enable loading (default: true)
 * @param {string} options.initialFilter - Initial filter value (default: 'ALL')
 * @returns {Object} Recent actions state and control functions
 */
export function useRecentActions(options = {}) {
  const {
    enabled = true,
    initialFilter = 'ALL',
  } = options;

  const [recentActions, setRecentActions] = useState([]);
  const [filter, setFilter] = useState(initialFilter);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load recent actions from API
  const loadRecentActions = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      const query = filter === 'ALL' ? '' : `?module=${filter}`;
      const data = await apiRequest(`/api/recent-actions${query}`);
      setRecentActions(data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load recent actions:', err);
      setError(err.message || 'Failed to load recent actions');
    } finally {
      setLoading(false);
    }
  }, [enabled, filter]);

  // Load on mount and when filter changes
  useEffect(() => {
    loadRecentActions();
  }, [loadRecentActions]);

  // Filter recent actions by module
  const filteredActions = useMemo(() => {
    if (filter === 'ALL') return recentActions;
    return recentActions.filter((a) => a.module === filter);
  }, [recentActions, filter]);

  return {
    recentActions,
    filteredActions,
    filter,
    setFilter,
    loading,
    error,
    loadRecentActions,
    refresh: loadRecentActions,
  };
}

export default useRecentActions;
