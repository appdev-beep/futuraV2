// src/contexts/AuthContext.jsx
// Centralized authentication context for the application.
// Provides user state, login, logout, and role-checking functionality.

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { ROLE_HIERARCHY, ROLE_REDIRECTS } from '../constants/authConstants.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Initialize from localStorage synchronously
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch {
        localStorage.removeItem('user');
        return null;
      }
    }
    return null;
  });
  
  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || null;
  });
  
  const [loading] = useState(false);

  // No useEffect needed - state is initialized from localStorage synchronously

  // Login function - stores user and token
  const login = useCallback((userData, authToken) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
    setUser(userData);
    setToken(authToken);
  }, []);

  // Logout function - clears all auth state
  const logout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  }, []);

  // Check if user is authenticated
  const isAuthenticated = useMemo(() => {
    return !!user && !!token;
  }, [user, token]);

  // Check if user has a specific role
  const hasRole = useCallback((role) => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  }, [user]);

  // Check if user has at least a minimum role level
  const hasMinRole = useCallback((minRole) => {
    if (!user) return false;
    const userLevel = ROLE_HIERARCHY[user.role] ?? -1;
    const minLevel = ROLE_HIERARCHY[minRole] ?? 999;
    return userLevel >= minLevel;
  }, [user]);

  // Get redirect path for current user's role
  const getRedirectPath = useCallback(() => {
    if (!user) return '/login';
    return ROLE_REDIRECTS[user.role] || '/';
  }, [user]);

  // Check if user is a supervisor-type role (can manage employees)
  const isSupervisorRole = useMemo(() => {
    if (!user) return false;
    return ['Supervisor', 'AM', 'Manager', 'HR', 'Admin'].includes(user.role);
  }, [user]);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated,
    isSupervisorRole,
    login,
    logout,
    hasRole,
    hasMinRole,
    getRedirectPath,
  }), [user, token, loading, isAuthenticated, isSupervisorRole, login, logout, hasRole, hasMinRole, getRedirectPath]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
