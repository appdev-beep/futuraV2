// src/hooks/useCLReview.js
// Custom hook for CL review functionality.
// Provides shared logic for loading CL, approving, returning, and exporting.

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';
import { exportCLToPDF, exportCLToCSV } from '../utils/exportUtils';

/**
 * Role-specific API endpoint configuration
 */
const ROLE_ENDPOINTS = {
  Employee: {
    load: (id) => `/api/cl/${id}`,
    approve: (id) => `/api/cl/${id}/employee/approve`,
    return: (id) => `/api/cl/${id}/employee/return`,
  },
  Supervisor: {
    load: (id) => `/api/cl/supervisor/${id}`,
    approve: (id) => `/api/cl/supervisor/${id}/approve`,
    return: (id) => `/api/cl/supervisor/${id}/return`,
  },
  HR: {
    load: (id) => `/api/cl/hr/${id}`,
    approve: (id) => `/api/cl/hr/${id}/approve`,
    return: (id) => `/api/cl/hr/${id}/return`,
  },
  AM: {
    load: (id) => `/api/cl/${id}`,
    approve: (id) => `/api/cl/${id}/am/approve`,
    return: (id) => `/api/cl/${id}/am/return`,
  },
  Manager: {
    load: (id) => `/api/cl/manager/${id}`,
    approve: (id) => `/api/cl/manager/${id}/approve`,
    return: (id) => `/api/cl/manager/${id}/return`,
  },
};

/**
 * Custom hook for CL review operations
 * @param {string} clId - CL ID from route params
 * @param {string} role - User role for endpoint selection
 * @param {Object} options - Additional options
 * @returns {Object} CL review state and actions
 */
export function useCLReview(clId, role, options = {}) {
  const { autoLoad = true } = options;

  const [cl, setCl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState('');

  // Get endpoints for role
  const endpoints = ROLE_ENDPOINTS[role] || ROLE_ENDPOINTS.Employee;

  // Load CL details
  const loadCL = useCallback(async () => {
    if (!clId) return;

    try {
      setLoading(true);
      setError('');
      const data = await apiRequest(endpoints.load(clId), { method: 'GET' });
      setCl(data);
    } catch (err) {
      console.error('Failed to load CL:', err);
      setError(err.message || 'Failed to load CL details.');
    } finally {
      setLoading(false);
    }
  }, [clId, endpoints]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadCL();
    }
  }, [autoLoad, loadCL]);

  // Approve CL
  const approveCL = useCallback(async (customRemarks = remarks) => {
    if (!clId) return { success: false, error: 'No CL ID' };

    try {
      setActionLoading(true);
      await apiRequest(endpoints.approve(clId), {
        method: 'POST',
        body: JSON.stringify({ remarks: customRemarks }),
      });
      return { success: true };
    } catch (err) {
      console.error('Failed to approve CL:', err);
      return { success: false, error: err.message || 'Failed to approve CL' };
    } finally {
      setActionLoading(false);
    }
  }, [clId, remarks, endpoints]);

  // Return CL
  const returnCL = useCallback(async (customRemarks = remarks) => {
    if (!clId) return { success: false, error: 'No CL ID' };
    if (!customRemarks.trim()) {
      return { success: false, error: 'Remarks are required when returning a CL' };
    }

    try {
      setActionLoading(true);
      await apiRequest(endpoints.return(clId), {
        method: 'POST',
        body: JSON.stringify({ remarks: customRemarks }),
      });
      return { success: true };
    } catch (err) {
      console.error('Failed to return CL:', err);
      return { success: false, error: err.message || 'Failed to return CL' };
    } finally {
      setActionLoading(false);
    }
  }, [clId, remarks, endpoints]);

  // Export to CSV
  const exportCSV = useCallback(() => {
    if (!cl) return;
    exportCLToCSV(cl);
  }, [cl]);

  // Export to PDF
  const exportPDF = useCallback((options = {}) => {
    if (!cl) return;
    exportCLToPDF(cl, options);
  }, [cl]);

  // Calculate derived values
  const items = cl?.items || [];
  const totalScore = items.reduce((sum, item) => {
    const weight = Number(item.weight) || 0;
    const level = Number(item.assigned_level) || 0;
    return sum + (weight / 100) * level;
  }, 0);

  const canApprove = !actionLoading && cl && cl.status !== 'APPROVED';
  const canReturn = !actionLoading && cl && cl.status !== 'APPROVED';

  return {
    // State
    cl,
    loading,
    error,
    actionLoading,
    remarks,
    setRemarks,
    
    // Derived values
    items,
    totalScore,
    canApprove,
    canReturn,
    
    // Actions
    loadCL,
    approveCL,
    returnCL,
    exportCSV,
    exportPDF,
    
    // Utilities
    refresh: loadCL,
  };
}

export default useCLReview;
