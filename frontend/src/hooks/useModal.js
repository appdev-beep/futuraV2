// src/hooks/useModal.js
// Custom hook for modal state management.
// Replaces duplicated modal state logic across ~8 pages.

import { useState, useCallback } from 'react';

/**
 * Custom hook for managing modal state
 * @param {Object} initialState - Initial modal configuration
 * @returns {Object} Modal state and control functions
 */
export function useModal(initialState = {}) {
  const [modalState, setModalState] = useState({
    open: false,
    title: '',
    message: '',
    showCancel: false,
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: null,
    type: 'info', // 'info' | 'success' | 'warning' | 'error'
    ...initialState,
  });

  // Open modal with custom options
  const openModal = useCallback((options = {}) => {
    setModalState((prev) => ({
      ...prev,
      open: true,
      title: options.title || '',
      message: options.message || '',
      showCancel: options.showCancel || false,
      confirmText: options.confirmText || (options.showCancel ? 'Confirm' : 'OK'),
      cancelText: options.cancelText || 'Cancel',
      onConfirm: options.onConfirm || null,
      type: options.type || 'info',
    }));
  }, []);

  // Close modal and reset callback
  const closeModal = useCallback(() => {
    setModalState((prev) => ({
      ...prev,
      open: false,
      onConfirm: null,
      showCancel: false,
    }));
  }, []);

  // Handle confirm action
  const handleConfirm = useCallback(async () => {
    const fn = modalState.onConfirm;
    closeModal();
    if (fn) {
      await fn();
    }
  }, [modalState.onConfirm, closeModal]);

  // Convenience methods for common modal types
  const showInfo = useCallback((title, message, onConfirm = null) => {
    openModal({ title, message, type: 'info', onConfirm });
  }, [openModal]);

  const showSuccess = useCallback((title, message, onConfirm = null) => {
    openModal({ title, message, type: 'success', onConfirm });
  }, [openModal]);

  const showWarning = useCallback((title, message, onConfirm = null) => {
    openModal({ title, message, type: 'warning', onConfirm });
  }, [openModal]);

  const showError = useCallback((title, message, onConfirm = null) => {
    openModal({ title, message, type: 'error', onConfirm });
  }, [openModal]);

  const showConfirm = useCallback((title, message, onConfirm, options = {}) => {
    openModal({
      title,
      message,
      showCancel: true,
      onConfirm,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      type: options.type || 'warning',
    });
  }, [openModal]);

  return {
    modalState,
    openModal,
    closeModal,
    handleConfirm,
    showInfo,
    showSuccess,
    showWarning,
    showError,
    showConfirm,
    // Expose individual state values for convenience
    isOpen: modalState.open,
    title: modalState.title,
    message: modalState.message,
  };
}

export default useModal;
