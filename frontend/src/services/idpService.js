// src/services/idpService.js
// Service layer for Individual Development Plan (IDP) operations.
// Centralizes API calls and business logic for IDP features.

import { apiRequest } from '../api/client';

/**
 * IDP Service - Handles all IDP-related API operations
 */
export const idpService = {
  // ============================================
  // EMPLOYEE ENDPOINTS
  // ============================================

  /**
   * Get all IDPs for the current employee
   */
  async getEmployeeIDPs() {
    return apiRequest('/api/idp/employee/my', { method: 'GET' });
  },

  /**
   * Get a specific IDP for employee review
   */
  async getEmployeeIDP(idpId) {
    return apiRequest(`/api/idp/employee/${idpId}`, { method: 'GET' });
  },

  /**
   * Employee approves an IDP
   */
  async employeeApprove(idpId, remarks = '') {
    return apiRequest(`/api/idp/employee/${idpId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * Employee returns an IDP
   */
  async employeeReturn(idpId, remarks) {
    return apiRequest(`/api/idp/employee/${idpId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // ============================================
  // SUPERVISOR ENDPOINTS
  // ============================================

  /**
   * Get employees eligible for IDP creation
   */
  async getEmployeesForCreation() {
    return apiRequest('/api/idp/supervisor/for-creation');
  },

  /**
   * Get all IDPs grouped by status for supervisor
   */
  async getSupervisorGrouped() {
    return apiRequest('/api/idp/supervisor/grouped');
  },

  /**
   * Get a specific IDP for supervisor
   */
  async getSupervisorIDP(idpId) {
    return apiRequest(`/api/idp/supervisor/${idpId}`, { method: 'GET' });
  },

  /**
   * Create a new IDP
   */
  async createIDP(data) {
    return apiRequest('/api/idp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update IDP header
   */
  async updateIDPHeader(idpId, data) {
    return apiRequest(`/api/idp/${idpId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Add development activity to IDP
   */
  async addActivity(idpId, activity) {
    return apiRequest(`/api/idp/${idpId}/activities`, {
      method: 'POST',
      body: JSON.stringify(activity),
    });
  },

  /**
   * Update development activity
   */
  async updateActivity(idpId, activityId, activity) {
    return apiRequest(`/api/idp/${idpId}/activities/${activityId}`, {
      method: 'PUT',
      body: JSON.stringify(activity),
    });
  },

  /**
   * Delete development activity
   */
  async deleteActivity(idpId, activityId) {
    return apiRequest(`/api/idp/${idpId}/activities/${activityId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Submit IDP for approval
   */
  async submitIDP(idpId) {
    return apiRequest(`/api/idp/${idpId}/submit`, { method: 'POST' });
  },

  /**
   * Supervisor approves an IDP
   */
  async supervisorApprove(idpId, remarks = '') {
    return apiRequest(`/api/idp/supervisor/${idpId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * Supervisor returns an IDP
   */
  async supervisorReturn(idpId, remarks) {
    return apiRequest(`/api/idp/supervisor/${idpId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * Delete an IDP
   */
  async deleteIDP(idpId) {
    return apiRequest(`/api/idp/${idpId}`, { method: 'DELETE' });
  },

  // ============================================
  // HR ENDPOINTS
  // ============================================

  /**
   * Get IDP summary for HR
   */
  async getHRSummary() {
    return apiRequest('/api/idp/hr/summary');
  },

  /**
   * Get all IDPs grouped by status for HR
   */
  async getHRGrouped() {
    return apiRequest('/api/idp/hr/all');
  },

  /**
   * Get a specific IDP for HR review
   */
  async getHRIDP(idpId) {
    return apiRequest(`/api/idp/hr/${idpId}`, { method: 'GET' });
  },

  /**
   * HR approves an IDP
   */
  async hrApprove(idpId, remarks = '') {
    return apiRequest(`/api/idp/hr/${idpId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * HR returns an IDP
   */
  async hrReturn(idpId, remarks) {
    return apiRequest(`/api/idp/hr/${idpId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // ============================================
  // AM ENDPOINTS
  // ============================================

  /**
   * Get pending IDPs for AM
   */
  async getAMPending() {
    return apiRequest('/api/idp/am/pending');
  },

  /**
   * Get a specific IDP for AM review
   */
  async getAMIDP(idpId) {
    return apiRequest(`/api/idp/am/${idpId}`, { method: 'GET' });
  },

  /**
   * AM approves an IDP
   */
  async amApprove(idpId, remarks = '') {
    return apiRequest(`/api/idp/am/${idpId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * AM returns an IDP
   */
  async amReturn(idpId, remarks) {
    return apiRequest(`/api/idp/am/${idpId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // ============================================
  // MANAGER ENDPOINTS
  // ============================================

  /**
   * Get IDP summary for Manager
   */
  async getManagerSummary() {
    return apiRequest('/api/idp/manager/summary');
  },

  /**
   * Get all IDPs grouped by status for Manager
   */
  async getManagerGrouped() {
    return apiRequest('/api/idp/manager/all');
  },

  /**
   * Get a specific IDP for Manager review
   */
  async getManagerIDP(idpId) {
    return apiRequest(`/api/idp/manager/${idpId}`, { method: 'GET' });
  },

  /**
   * Manager approves an IDP
   */
  async managerApprove(idpId, remarks = '') {
    return apiRequest(`/api/idp/manager/${idpId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  /**
   * Manager returns an IDP
   */
  async managerReturn(idpId, remarks) {
    return apiRequest(`/api/idp/manager/${idpId}/return`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // ============================================
  // FILE UPLOAD ENDPOINTS
  // ============================================

  /**
   * Upload file attachment for IDP activity
   */
  async uploadFile(idpId, activityId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/api/idp/${idpId}/activities/${activityId}/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  },

  /**
   * Delete file attachment
   */
  async deleteFile(idpId, activityId, fileId) {
    return apiRequest(`/api/idp/${idpId}/activities/${activityId}/files/${fileId}`, {
      method: 'DELETE',
    });
  },
};

export default idpService;
