// src/services/userService.js
// Service layer for user and lookup operations.
// Centralizes API calls for user management, departments, positions, etc.

import { apiRequest } from '../api/client';

/**
 * User Service - Handles all user and lookup-related API operations
 */
export const userService = {
  // ============================================
  // USER ENDPOINTS
  // ============================================

  /**
   * Get current user's profile
   */
  async getCurrentUser() {
    return apiRequest('/api/users/me', { method: 'GET' });
  },

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    return apiRequest(`/api/users/${userId}`, { method: 'GET' });
  },

  /**
   * Get all users (Admin only)
   */
  async getAllUsers() {
    return apiRequest('/api/users', { method: 'GET' });
  },

  /**
   * Create a new user (Admin only)
   */
  async createUser(userData) {
    return apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  /**
   * Update user (Admin only)
   */
  async updateUser(userId, userData) {
    return apiRequest(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  /**
   * Delete user (Admin only)
   */
  async deleteUser(userId) {
    return apiRequest(`/api/users/${userId}`, { method: 'DELETE' });
  },

  /**
   * Get employees by supervisor
   */
  async getEmployeesBySupervisor(supervisorId) {
    return apiRequest(`/api/users/supervisor/${supervisorId}/employees`);
  },

  // ============================================
  // LOOKUP ENDPOINTS
  // ============================================

  /**
   * Get all departments
   */
  async getDepartments() {
    return apiRequest('/api/lookup/departments');
  },

  /**
   * Get department by ID
   */
  async getDepartmentById(departmentId) {
    return apiRequest(`/api/lookup/departments/${departmentId}`);
  },

  /**
   * Get all positions
   */
  async getPositions() {
    return apiRequest('/api/lookup/positions');
  },

  /**
   * Get positions by department
   */
  async getPositionsByDepartment(departmentId) {
    return apiRequest(`/api/lookup/positions?department_id=${departmentId}`);
  },

  /**
   * Get all supervisors
   */
  async getSupervisors() {
    return apiRequest('/api/lookup/supervisors');
  },

  /**
   * Get supervisors by department
   */
  async getSupervisorsByDepartment(departmentId) {
    return apiRequest(`/api/lookup/supervisors?department_id=${departmentId}`);
  },

  /**
   * Get all competencies
   */
  async getCompetencies() {
    return apiRequest('/api/lookup/competencies');
  },

  /**
   * Get competencies by position
   */
  async getCompetenciesByPosition(positionId) {
    return apiRequest(`/api/lookup/competencies?position_id=${positionId}`);
  },

  /**
   * Get all cycles
   */
  async getCycles() {
    return apiRequest('/api/lookup/cycles');
  },

  /**
   * Get active cycle
   */
  async getActiveCycle() {
    return apiRequest('/api/lookup/cycles/active');
  },

  /**
   * Get roles
   */
  async getRoles() {
    return apiRequest('/api/lookup/roles');
  },

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  /**
   * Create department (Admin only)
   */
  async createDepartment(data) {
    return apiRequest('/api/lookup/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update department (Admin only)
   */
  async updateDepartment(departmentId, data) {
    return apiRequest(`/api/lookup/departments/${departmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete department (Admin only)
   */
  async deleteDepartment(departmentId) {
    return apiRequest(`/api/lookup/departments/${departmentId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Create position (Admin only)
   */
  async createPosition(data) {
    return apiRequest('/api/lookup/positions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update position (Admin only)
   */
  async updatePosition(positionId, data) {
    return apiRequest(`/api/lookup/positions/${positionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete position (Admin only)
   */
  async deletePosition(positionId) {
    return apiRequest(`/api/lookup/positions/${positionId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Create competency (Admin only)
   */
  async createCompetency(data) {
    return apiRequest('/api/lookup/competencies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update competency (Admin only)
   */
  async updateCompetency(competencyId, data) {
    return apiRequest(`/api/lookup/competencies/${competencyId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete competency (Admin only)
   */
  async deleteCompetency(competencyId) {
    return apiRequest(`/api/lookup/competencies/${competencyId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Create cycle (Admin only)
   */
  async createCycle(data) {
    return apiRequest('/api/lookup/cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update cycle (Admin only)
   */
  async updateCycle(cycleId, data) {
    return apiRequest(`/api/lookup/cycles/${cycleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Set active cycle (Admin only)
   */
  async setActiveCycle(cycleId) {
    return apiRequest(`/api/lookup/cycles/${cycleId}/activate`, {
      method: 'POST',
    });
  },
};

export default userService;
