// src/services/clService.js
// Service layer for Competency Leveling (CL) operations.
// Centralizes API calls and business logic for CL features.

import { apiRequest } from '../api/client';

/**
 * CL Service - Handles all CL-related API operations
 */
export const clService = {
  // ============================================
  // EMPLOYEE ENDPOINTS
  // ============================================

  /**
   * Get pending CLs for the current employee
   */
  async getEmployeePending() {
    return apiRequest('/api/cl/employee/pending', { method: 'GET' });
  },

  /**
   * Get CL history for the current employee
   */
  async getEmployeeHistory() {
    return apiRequest('/api/cl/employee/my/history', { method: 'GET' });
  },

  /**
   * Get a specific CL by ID for employee review
   */
  async getEmployeeCL(clId) {
    return apiRequest(`/api/cl/employee/${clId}`, { method: 'GET' });
  },

  /**
   * Employee approves a CL
   */
  async employeeApprove(clId, remarks = '') {
    return apiRequest(`/api/cl/employee/${clId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * Employee returns a CL
   */
  async employeeReturn(clId, remarks) {
    return apiRequest(`/api/cl/employee/${clId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // ============================================
  // SUPERVISOR ENDPOINTS
  // ============================================

  /**
   * Get CL summary counts for supervisor dashboard
   */
  async getSupervisorSummary() {
    return apiRequest('/api/cl/supervisor/summary');
  },

  /**
   * Get all CLs grouped by status for supervisor
   */
  async getSupervisorGrouped() {
    return apiRequest('/api/cl/supervisor/all');
  },

  /**
   * Get employees eligible for CL creation
   */
  async getEmployeesForCL() {
    return apiRequest('/api/cl/supervisor/employees');
  },

  /**
   * Get a specific CL by ID for supervisor review
   */
  async getSupervisorCL(clId) {
    return apiRequest(`/api/cl/supervisor/${clId}`, { method: 'GET' });
  },

  /**
   * Create a new CL
   */
  async createCL(data) {
    return apiRequest('/api/cl', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update CL items
   */
  async updateCLItems(clId, items) {
    return apiRequest(`/api/cl/${clId}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  },

  /**
   * Submit CL for approval
   */
  async submitCL(clId) {
    return apiRequest(`/api/cl/${clId}/submit`, { method: 'POST' });
  },

  /**
   * Supervisor approves a CL
   */
  async supervisorApprove(clId, remarks = '') {
    return apiRequest(`/api/cl/supervisor/${clId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * Supervisor returns a CL
   */
  async supervisorReturn(clId, remarks) {
    return apiRequest(`/api/cl/supervisor/${clId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * Delete a CL
   */
  async deleteCL(clId) {
    return apiRequest(`/api/cl/${clId}`, { method: 'DELETE' });
  },

  // ============================================
  // HR ENDPOINTS
  // ============================================

  /**
   * Get CL summary for HR
   */
  async getHRSummary() {
    return apiRequest('/api/cl/hr/summary');
  },

  /**
   * Get all CLs grouped by status for HR
   */
  async getHRGrouped() {
    return apiRequest('/api/cl/hr/all');
  },

  /**
   * Get a specific CL by ID for HR review
   */
  async getHRCL(clId) {
    return apiRequest(`/api/cl/hr/${clId}`, { method: 'GET' });
  },

  /**
   * HR approves a CL
   */
  async hrApprove(clId, remarks = '') {
    return apiRequest(`/api/cl/hr/${clId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * HR returns a CL
   */
  async hrReturn(clId, remarks) {
    return apiRequest(`/api/cl/hr/${clId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // ============================================
  // AM ENDPOINTS
  // ============================================

  /**
   * Get pending CLs for AM
   */
  async getAMPending() {
    return apiRequest('/api/cl/am/pending');
  },

  /**
   * Get a specific CL by ID for AM review
   */
  async getAMCL(clId) {
    return apiRequest(`/api/cl/am/${clId}`, { method: 'GET' });
  },

  /**
   * AM approves a CL
   */
  async amApprove(clId, remarks = '') {
    return apiRequest(`/api/cl/am/${clId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * AM returns a CL
   */
  async amReturn(clId, remarks) {
    return apiRequest(`/api/cl/am/${clId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // ============================================
  // MANAGER ENDPOINTS
  // ============================================

  /**
   * Get CL summary for Manager
   */
  async getManagerSummary() {
    return apiRequest('/api/cl/manager/summary');
  },

  /**
   * Get all CLs grouped by status for Manager
   */
  async getManagerGrouped() {
    return apiRequest('/api/cl/manager/all');
  },

  /**
   * Get a specific CL by ID for Manager review
   */
  async getManagerCL(clId) {
    return apiRequest(`/api/cl/manager/${clId}`, { method: 'GET' });
  },

  /**
   * Manager approves a CL
   */
  async managerApprove(clId, remarks = '') {
    return apiRequest(`/api/cl/manager/${clId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * Manager returns a CL
   */
  async managerReturn(clId, remarks) {
    return apiRequest(`/api/cl/manager/${clId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // ============================================
  // COMMON/LOOKUP ENDPOINTS
  // ============================================

  /**
   * Get competencies for a specific position
   */
  async getCompetenciesByPosition(positionId) {
    return apiRequest(`/api/lookup/competencies?position_id=${positionId}`);
  },

  /**
   * Get active cycle
   */
  async getActiveCycle() {
    return apiRequest('/api/lookup/cycles/active');
  },
};

export default clService;
