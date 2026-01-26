// src/pages/HR/HRDashboard.jsx
import { useEffect, useState, useMemo } from 'react';
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import {
  BellIcon,
  ArrowRightOnRectangleIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  ArrowsPointingOutIcon,
  Squares2X2Icon,
  ClockIcon,
  UserIcon,
  BriefcaseIcon,
  PencilSquareIcon,
  UsersIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import '../../index.css';
import '../../App.css'; 
import ProficiencyTable from '../../components/ProficiencyGuide';
import { displayStatus } from '../../utils/statusHelper';
import { COMPLETION_STATUS_OPTIONS } from '../Shared/idpConstants';

function HRDashboard() {
  // Initialize user from localStorage
  const storedUser = localStorage.getItem('user');
  const initialUser = storedUser ? JSON.parse(storedUser) : null;
  const [user] = useState(initialUser);
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    if (!user) {
      window.location.assign('/login');
    } else if (user.role !== 'HR') {
      window.location.assign('/');
    }
  }, [user]);

  // Do not return early; handle redirect in JSX below
  // Removed unused loading and error state
  
  const [summary, setSummary] = useState({
    clPending: 0,
    clApproved: 0,
    clReturned: 0,
  });

  // Removed unused clByStatus state
  const [allIncomingCL, setAllIncomingCL] = useState([]);
    // Fetch all incoming CLs for HR on mount
    useEffect(() => {
      async function fetchIncomingCLs() {
        try {
          const data = await apiRequest('/api/cl/hr/incoming', { method: 'GET' });
          setAllIncomingCL(data || []);
        } catch (err) {
          console.error('Failed to load incoming CLs', err);
        }
      }
      fetchIncomingCLs();
    }, []);
  const [allDepartments, setAllDepartments] = useState([]);
    // Fetch departments on mount (restore if removed)
    useEffect(() => {
      async function fetchDepartments() {
        try {
          const deps = await apiRequest('/api/lookup/departments', { method: 'GET' });
          console.log('Fetched departments:', deps);
          setAllDepartments(deps || []);
        } catch (err) {
          console.error('Failed to load departments', err);
        }
      }
      fetchDepartments();
    }, []);
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  const [notificationFilter, setNotificationFilter] = useState('ALL');
  const [recentActionFilter, setRecentActionFilter] = useState('ALL');

  const [activeSection, setActiveSection] = useState('ALL');
  const [activeModule, setActiveModule] = useState('CL'); // 'CL' or 'IDP'
  const [activeIDPSection, setActiveIDPSection] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [isDepartmentSearchFocused, setIsDepartmentSearchFocused] = useState(false);
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);
  const [showFullNotifications, setShowFullNotifications] = useState(false);
  const [showClAction, setShowClAction] = useState(false);
  const [showClInReview, setShowClInReview] = useState(false);
  const [showIdpAction, setShowIdpAction] = useState(false);
  const [showIdpInReview, setShowIdpInReview] = useState(false);
  
  // Date search state
  const [dateSearch, setDateSearch] = useState({
    startDate: '',
    endDate: '',
    enabled: false
  });
  const [showDateSearch, setShowDateSearch] = useState(false);
  const [recentActionsPagination, setRecentActionsPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10
  });
  const [clPagination, setClPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10
  });
  const [idpPagination, setIdpPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10
  });
  const [modalState, setModalState] = useState({
    open: false,
    title: '',
    message: '',
    showCancel: false,
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: null,
  });

  const [notificationModalState, setNotificationModalState] = useState({
    open: false,
    notification: null,
  });

  const [clDetailsModal, setClDetailsModal] = useState({
    open: false,
    clId: null,
    details: null,
    loading: false,
  });
  const [exportModal, setExportModal] = useState({
    open: false,
    loading: false,
    startDate: '',
    endDate: '',
    module: 'CL',
    selectedStatus: 'ALL',
    department: 'ALL'
  });
  const [allIncomingIDP, setAllIncomingIDP] = useState([]);
  const [idpLoading, setIdpLoading] = useState(false);
  const [idpError, setIdpError] = useState(null);

  // Dynamically build CL status sections based on selected department's has_am
  const CL_STATUS_SECTIONS = useMemo(() => {
    const sections = [
      { key: 'DRAFT', label: 'Returned for Review', icon: PencilSquareIcon },
      { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee', icon: UserIcon },
      { key: 'PENDING_HR', label: 'For Approval by HR', icon: BriefcaseIcon },
    ];
    // Find the selected department object
    const deptObj = allDepartments.find(d => d.name === selectedDepartment);
    if (deptObj && deptObj.has_am) {
      sections.push({ key: 'PENDING_AM', label: 'For Approval by Assistant Manager', icon: ClockIcon });
    }
    sections.push({ key: 'PENDING_MANAGER', label: 'For Approval by Manager', icon: ClockIcon });
    sections.push({ key: 'APPROVED', label: 'Approved', icon: CheckCircleIcon });
    return sections;
  }, [allDepartments, selectedDepartment]);

  const IDP_STATUS_SECTIONS = useMemo(() => {
    const sections = [
      { key: 'DRAFT', label: 'Returned for Review', icon: PencilSquareIcon },
      { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee', icon: UserIcon },
      { key: 'PENDING_HR', label: 'For Approval by HR', icon: BriefcaseIcon },
    ];
    const deptObj = allDepartments.find(d => d.name === selectedDepartment);
    if (deptObj && deptObj.has_am) {
      sections.push({ key: 'PENDING_AM', label: 'For Approval by Assistant Manager', icon: ClockIcon });
    }
    sections.push({ key: 'PENDING_MANAGER', label: 'For Approval by Manager', icon: ClockIcon });
    sections.push({ key: 'FOR_COMPLETION', label: 'For Completion', icon: ClockIcon });
    sections.push({ key: 'CYCLE_COMPLETED', label: 'Cycle Completed', icon: CheckCircleIcon });
    return sections;
  }, [allDepartments, selectedDepartment]);

  // Auth check – must be logged in and HR is handled in useEffect above. No early returns here.

  // Load dashboard
  // Removed unused loadDashboard function and effect

  // Notifications (polling)
  useEffect(() => {
    if (!user) return;

    let timer;

    async function loadNotifications() {
      try {
        const data = await apiRequest('/api/notifications');
        setNotifications(data || []);
      } catch (err) {
        console.error('Failed to load notifications', err);
      }
    }

    loadNotifications();
    timer = setInterval(loadNotifications, 15000);

    return () => clearInterval(timer);
  }, [user]);

  // Recent actions
  useEffect(() => {
    if (!user) return;

    async function loadRecentActions() {
      try {
        const data = await apiRequest('/api/recent-actions');
        setRecentActions(data || []);
      } catch (err) {
        console.error('Failed to load recent actions', err);
      }
    }

    loadRecentActions();
  }, [user, CL_STATUS_SECTIONS]);

  // Reset CL pagination when filters change
  useEffect(() => {
    setClPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [activeSection, selectedDepartment, activeModule, dateSearch]);

  // Reset IDP pagination when filters change
  useEffect(() => {
    setIdpPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [activeIDPSection, selectedDepartment, activeModule, dateSearch]);

  function goTo(url) {
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    
    // If already on the target page, just reload data instead of full refresh
    if (currentPath === targetPath) {
      window.location.reload();
      return;
    }
    
    window.location.href = url;
  }

  function openModal(options) {
    setModalState({
      open: true,
      title: options.title || '',
      message: options.message || '',
      showCancel: options.showCancel || false,
      confirmText: options.confirmText || (options.showCancel ? 'Confirm' : 'OK'),
      cancelText: options.cancelText || 'Cancel',
      onConfirm: options.onConfirm || null,
    });
  }

  function closeModal() {
    setModalState((prev) => ({
      ...prev,
      open: false,
      onConfirm: null,
      showCancel: false,
    }));
  }

  async function handleModalConfirm() {
    const fn = modalState.onConfirm;
    closeModal();
    if (fn) await fn();
  }

  function logout() {
    openModal({
      title: 'Confirm Logout',
      message: 'Are you sure you want to logout? Any unsaved changes will be lost.',
      showCancel: true,
      confirmText: 'Logout',
      cancelText: 'Cancel',
      onConfirm: () => {
        localStorage.clear();
        window.location.href = '/login';
      },
    });
  }

  async function handleNotificationClick(n) {
    // Mark notification as read
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/notifications/${n.id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      // Reload notifications to update the list
      const data = await apiRequest('/api/notifications');
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
    
    setNotificationModalState({
      open: true,
      notification: n,
    });
  }

  async function handleMarkAllAsRead() {
    try {
      await apiRequest('/api/notifications/mark-all-read', { method: 'PATCH' });
      // Reload notifications to update UI
      const data = await apiRequest('/api/notifications');
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }

  async function handleRecentActionClick(action) {
    // If action is a deletion, show when it was deleted
    if (action.title && action.title.toLowerCase().includes('deleted')) {
      alert(`${action.title}\n\n${action.description || ''}\n\nDeleted at: ${new Date(action.created_at).toLocaleString()}`);
      return;
    }
    
    // Check if we're staying on the same page
    const url = action.url || '/hr';
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    
    if (currentPath === targetPath) {
      // Just close modal and stay on current page
      return;
    }
    
    // Navigate to different page
    const separator = url.includes('?') ? '&' : '?';
    window.location.assign(`${url}${separator}viewOnly=true`);
  }

  async function proceedToNotificationLink(n) {
    setNotificationModalState({ open: false, notification: null });
    
    try {
      if (n?.id) {
        await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
        // Reload notifications to update UI
        const data = await apiRequest('/api/notifications');
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
    
    // Check if we're staying on the same page
    const url = n?.url || '/hr';
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    
    if (currentPath === targetPath) {
      // Stay on current page without refresh
      return;
    }
    
    // Navigate to different page
    window.location.href = url;
  }

  function closeNotificationModal() {
    setNotificationModalState({ open: false, notification: null });
  }

  async function handleCLClick(clId) {
    try {
      setClDetailsModal({
        open: true,
        clId,
        details: null,
        loading: true,
      });

      const data = await apiRequest(`/api/cl/${clId}`, { method: 'GET' });
      
      setClDetailsModal(prev => ({
        ...prev,
        details: data,
        loading: false,
      }));
    } catch (err) {
      console.error('Failed to load CL details:', err);
      setClDetailsModal(prev => ({
        ...prev,
        loading: false,
      }));
    }
  }

  function closeCLDetailsModal() {
    setClDetailsModal({
      open: false,
      clId: null,
      details: null,
      loading: false,
    });
  }

  // Export functions
  function openExportModal() {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setExportModal({
      open: true,
      loading: false,
      startDate: thirtyDaysAgo,
      endDate: today,
      module: activeModule,
      selectedStatus: 'ALL',
      department: selectedDepartment
    });
  }

  function closeExportModal() {
    setExportModal({
      open: false,
      loading: false,
      startDate: '',
      endDate: '',
      module: 'CL',
      selectedStatus: 'ALL',
      department: 'ALL'
    });
  }

  // Clear date search
  function clearDateSearch() {
    setDateSearch({ startDate: '', endDate: '', enabled: false });
    setShowDateSearch(false);
  }

  // Apply date search
  function applyDateSearch() {
    if (dateSearch.startDate || dateSearch.endDate) {
      setDateSearch(prev => ({ ...prev, enabled: true }));
    }
  }

  async function handleExportCSV() {
    const { startDate, endDate, module, selectedStatus, department } = exportModal;
    
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before end date');
      return;
    }

    try {
      setExportModal(prev => ({ ...prev, loading: true }));
      
      const queryParams = new URLSearchParams({
        startDate,
        endDate,
        department: department === 'ALL' ? 'ALL' : department,
        status: selectedStatus
      });
      
      const endpoint = module === 'CL' ? '/api/cl/hr/export' : '/api/idp/hr/export';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        // Try to parse JSON error, but if response is HTML, show a generic message
        let errorMessage = 'Export failed';
        try {
          const error = await response.json();
          errorMessage = error.message || 'Export failed';
        } catch {
          // Response was not JSON (likely HTML error page)
          errorMessage = `Export failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const csvData = await response.text();
      
      // Create and download the file
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${module}_Export_${department === 'ALL' ? 'All' : department}_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      closeExportModal();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    } finally {
      setExportModal(prev => ({ ...prev, loading: false }));
    }
  }

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === 'ALL') return notifications;
    return notifications.filter(n => n.module === notificationFilter);
  }, [notifications, notificationFilter]);

  const filteredRecentActions = useMemo(() => {
    if (recentActionFilter === 'ALL') return recentActions;
    return recentActions.filter(a => a.module === recentActionFilter);
  }, [recentActions, recentActionFilter]);

  // Paginated recent actions for sidebar
  const paginatedRecentActions = useMemo(() => {
    const { currentPage, itemsPerPage } = recentActionsPagination;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredRecentActions.slice(startIndex, endIndex);
  }, [filteredRecentActions, recentActionsPagination]);

  const totalRecentActionPages = Math.ceil(filteredRecentActions.length / recentActionsPagination.itemsPerPage);

  // Get unique departments from incoming CLs
  const departments = useMemo(() => {
    if (!allDepartments || allDepartments.length === 0) {
      console.log('No allDepartments available:', allDepartments);
      return [];
    }
    const result = allDepartments.map(d => d.name).sort();
    console.log('Computed departments:', result);
    return result;
  }, [allDepartments]);

  const filteredDepartments = useMemo(() => {
    if (!departmentSearch.trim()) return departments;
    const term = departmentSearch.toLowerCase();
    return departments.filter(d => d.toLowerCase().includes(term));
  }, [departments, departmentSearch]);

  // Set first department as default when departments load
  // Default is 'ALL' (explicit) so we don't auto-select the first department

  // Load department-specific summary when department changes
  useEffect(() => {
    async function loadSummary() {
      try {
        const endpoint = selectedDepartment === 'ALL'
          ? '/api/cl/hr/summary'
          : `/api/cl/hr/summary?department=${encodeURIComponent(selectedDepartment)}`;
        const data = await apiRequest(endpoint);
        setSummary({
          clPending: data.pending || 0,
          clApproved: data.approved || 0,
          clReturned: data.returned || 0,
        });
      } catch (err) {
        console.error('Failed to load summary:', err);
      }
    }
    if (user) loadSummary();
  }, [user, selectedDepartment, location.search]);

  // Load incoming IDPs for HR (load all once so dropdown can show counts for both CL and IDP)
  useEffect(() => {
    async function loadIncomingIDPs() {
      setIdpLoading(true);
      try {
        const data = await apiRequest('/api/idp/hr/incoming');
        setAllIncomingIDP(data || []);
      } catch (err) {
        console.error('Failed to load IDPs', err);
        setIdpError(`Error loading IDPs: ${err.message || 'Unknown error'}`);
      } finally {
        setIdpLoading(false);
      }
    }
    if (user) loadIncomingIDPs();
  }, [user]);

  // Fetch filtered IDPs when switching to IDP module or department changes
  useEffect(() => {
    async function fetchIDPs() {
      if (activeModule !== 'IDP') return;
      setIdpLoading(true);
      setIdpError(null);
      try {
        const endpoint = selectedDepartment === 'ALL'
          ? '/api/idp/hr/incoming'
          : `/api/idp/hr/incoming?department=${encodeURIComponent(selectedDepartment)}`;
        const data = await apiRequest(endpoint);
        setAllIncomingIDP(data || []);
      } catch (err) {
        console.error('Failed to fetch IDPs:', err);
        setIdpError(err.message || 'Failed to load IDPs');
      } finally {
        setIdpLoading(false);
      }
    }
    if (user) fetchIDPs();
  }, [user, selectedDepartment, activeModule]);

  const sectionCounts = useMemo(() => {
    if (!allIncomingCL) return { ALL: 0 };
    const filtered = selectedDepartment === 'ALL' ? allIncomingCL : allIncomingCL.filter(cl => cl.department_name === selectedDepartment);
    const counts = { ALL: filtered.length };
    CL_STATUS_SECTIONS.forEach(({ key }) => {
      counts[key] = filtered.filter(cl => cl.status === key).length;
    });
    return counts;
  }, [allIncomingCL, selectedDepartment, CL_STATUS_SECTIONS]);

  // Grouped counts for CL
  const clActionRequiredCount = useMemo(() => {
    return ['DRAFT', 'RETURNED', 'PENDING_HR'].reduce((sum, status) => sum + (sectionCounts[status] || 0), 0);
  }, [sectionCounts]);

  const clInReviewCount = useMemo(() => {
    return ['PENDING_SUPERVISOR', 'PENDING_MANAGER', 'PENDING_AM', 'PENDING_EMPLOYEE'].reduce((sum, status) => sum + (sectionCounts[status] || 0), 0);
  }, [sectionCounts]);

  // Grouped counts for IDP
  const idpActionRequiredCount = useMemo(() => {
    const filteredIDPs = selectedDepartment === 'ALL' ? allIncomingIDP : allIncomingIDP.filter(idp => idp.department_name === selectedDepartment);
    return ['DRAFT', 'RETURNED', 'FOR_COMPLETION', 'PENDING_HR'].reduce((sum, status) => {
      return sum + filteredIDPs.filter(idp => idp.status === status).length;
    }, 0);
  }, [allIncomingIDP, selectedDepartment]);

  const idpInReviewCount = useMemo(() => {
    const filteredIDPs = selectedDepartment === 'ALL' ? allIncomingIDP : allIncomingIDP.filter(idp => idp.department_name === selectedDepartment);
    return ['PENDING_MANAGER', 'PENDING_AM', 'PENDING_EMPLOYEE'].reduce((sum, status) => {
      return sum + filteredIDPs.filter(idp => idp.status === status).length;
    }, 0);
  }, [allIncomingIDP, selectedDepartment]);

  const activeLabel = useMemo(() => {
    if (activeModule === 'CL') {
      if (activeSection === 'ALL') return 'All Competency Levelings';
      const s = CL_STATUS_SECTIONS.find(sec => sec.key === activeSection);
      return s ? s.label : 'All Competency Levelings';
    } else {
      if (activeIDPSection === 'ALL') return 'All IDP Levelings';
      const s = IDP_STATUS_SECTIONS.find(sec => sec.key === activeIDPSection);
      return s ? s.label : 'All IDP Levelings';
    }
  }, [activeModule, activeSection, CL_STATUS_SECTIONS, activeIDPSection, IDP_STATUS_SECTIONS]);

  const filteredIncomingIDPs = useMemo(() => {
    let filtered = !selectedDepartment || selectedDepartment === 'ALL' ? allIncomingIDP : allIncomingIDP.filter(idp => idp.department_name === selectedDepartment);
    
    // Apply date filtering if enabled
    if (dateSearch.enabled && (dateSearch.startDate || dateSearch.endDate)) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.created_at || item.submitted_at);
        const startDate = dateSearch.startDate ? new Date(dateSearch.startDate) : null;
        const endDate = dateSearch.endDate ? new Date(dateSearch.endDate + 'T23:59:59') : null;
        
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }
    
    return filtered;
  }, [allIncomingIDP, selectedDepartment, dateSearch]);

  // Filter incoming CLs by selected department and date range
  const filteredIncomingCLs = useMemo(() => {
    let filtered = !selectedDepartment || selectedDepartment === 'ALL' ? allIncomingCL : allIncomingCL.filter(cl => cl.department_name === selectedDepartment);
    
    // Apply date filtering if enabled
    if (dateSearch.enabled && (dateSearch.startDate || dateSearch.endDate)) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.created_at || item.submitted_at);
        const startDate = dateSearch.startDate ? new Date(dateSearch.startDate) : null;
        const endDate = dateSearch.endDate ? new Date(dateSearch.endDate + 'T23:59:59') : null;
        
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }
    
    return filtered;
  }, [allIncomingCL, selectedDepartment, dateSearch]);

  // Total pages calculation
  const totalCLPages = Math.ceil(filteredIncomingCLs.length / clPagination.itemsPerPage);

  // Total pages calculation for IDP
  const totalIDPPages = Math.ceil(filteredIncomingIDPs.length / idpPagination.itemsPerPage);

  // Helper function to get paginated data for a specific CL status
  const getPaginatedCLByStatus = (status) => {
    const items = filteredIncomingCLs.filter(cl => cl.status === status);
    const { currentPage, itemsPerPage } = clPagination;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  };

  // Helper function to get paginated data for a specific IDP status
  const getPaginatedIDPByStatus = (status) => {
    const items = filteredIncomingIDPs.filter(idp => idp.status === status);
    const { currentPage, itemsPerPage } = idpPagination;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT SIDEBAR */}
      <aside className="w-56 bg-blue-900 border-r border-blue-800 flex flex-col overflow-y-auto" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
        <div className="p-4 border-b border-blue-800">
          <h2 className="text-xl font-semibold text-white">FUTURA</h2>
          
          <div className="mt-3">
            <label className="block text-xs font-medium text-blue-200 mb-1">Filter by Department</label>
            <div>
              <input
                type="text"
                value={departmentSearch}
                onChange={(e) => setDepartmentSearch(e.target.value)}
                onFocus={() => setIsDepartmentSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsDepartmentSearchFocused(false), 150)}
                placeholder="Search departments..."
                className="w-full px-3 py-2 border border-blue-700 bg-blue-800 text-white placeholder-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              {/* Show dropdown when focused or when typing */}
              {(isDepartmentSearchFocused || departmentSearch) && (
                <div className="mt-1 bg-blue-700 border border-blue-600 rounded max-h-32 overflow-y-auto" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                  <div 
                    className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-600 ${selectedDepartment === 'ALL' ? 'bg-blue-600' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedDepartment('ALL');
                      setDepartmentSearch('');
                      setIsDepartmentSearchFocused(false);
                    }}
                  >
                    <span className="text-white">All Departments ({allIncomingCL.length} CLs, {allIncomingIDP.length} IDPs)</span>
                  </div>
                  {(departmentSearch ? filteredDepartments : departments).map(dept => {
                    const clCount = allIncomingCL.filter(item => item.department_name === dept).length;
                    const idpCount = allIncomingIDP.filter(item => item.department_name === dept).length;
                    return (
                      <div
                        key={dept}
                        className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-600 ${selectedDepartment === dept ? 'bg-blue-600' : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedDepartment(dept);
                          setDepartmentSearch('');
                          setIsDepartmentSearchFocused(false);
                        }}
                      >
                        <span className="text-white">{dept} ({clCount} CLs, {idpCount} IDPs)</span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Show current selection when not searching and not focused */}
              {!departmentSearch && !isDepartmentSearchFocused && (
                <div className="mt-2 px-3 py-2 bg-blue-700 rounded text-xs text-white">
                  Current: {selectedDepartment === 'ALL' ? 
                    `All Departments (${allIncomingCL.length} CLs, ${allIncomingIDP.length} IDPs)` : 
                    `${selectedDepartment} (${allIncomingCL.filter(item => item.department_name === selectedDepartment).length} CLs, ${allIncomingIDP.filter(item => item.department_name === selectedDepartment).length} IDPs)`
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-8rem)]" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          {/* Employee Management */}
          <div className="space-y-1">
            <button
              onClick={() => navigate('/hr/employees')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded
                         text-blue-100 hover:bg-blue-800 transition"
            >
              <UsersIcon className="w-5 h-5 text-green-400" />
              <span>Employee Management</span>
            </button>
          </div>

          {/* Competency Leveling */}
          <div className="space-y-1">
            <button
              onClick={() => { setActiveModule('CL'); setActiveSection('ALL'); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded
                         text-blue-100 hover:bg-blue-800 transition"
            >
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-400" />
              <span>Competency Leveling</span>
            </button>

            {/* CL Sections */}
            <div className="pr-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200 mb-2 px-3">
                CL Sections
              </p>

              <button
                type="button"
                onClick={() => { setActiveModule('CL'); setActiveSection('ALL'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                  ${activeSection === 'ALL' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
              >
                <span className="flex items-center gap-2">
                  <Squares2X2Icon className="w-4 h-4" />
                  All
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">
                  {sectionCounts.ALL || 0}
                </span>
              </button>

              {/* Grouped: Action Required */}
              <div className="mt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => setShowClAction((v) => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${showClAction ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2">
                    {(showClAction ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />)}
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    Action Required
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{clActionRequiredCount}</span>
                </button>
                {showClAction && (
                  <div className="ml-6 space-y-1">
                    {CL_STATUS_SECTIONS.filter(s => ['DRAFT', 'RETURNED', 'PENDING_HR'].includes(s.key)).map(({ key, label, icon }) => {
                      const Icon = icon;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveModule('CL'); setActiveSection(key); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                            ${activeSection === key ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">
                            {sectionCounts[key] || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Grouped: In Review */}
                <button
                  type="button"
                  onClick={() => setShowClInReview((v) => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${showClInReview ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2">
                    {(showClInReview ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />)}
                    <ClockIcon className="w-4 h-4" />
                    In Review
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{clInReviewCount}</span>
                </button>
                {showClInReview && (
                  <div className="ml-6 space-y-1">
                    {CL_STATUS_SECTIONS.filter(s => ['PENDING_SUPERVISOR', 'PENDING_MANAGER', 'PENDING_AM', 'PENDING_EMPLOYEE'].includes(s.key)).map(({ key, label, icon }) => {
                      const Icon = icon;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveModule('CL'); setActiveSection(key); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                            ${activeSection === key ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">
                            {sectionCounts[key] || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Other individual status sections that don't fit in groups */}
                {CL_STATUS_SECTIONS.filter(s => !['DRAFT', 'RETURNED', 'PENDING_HR', 'PENDING_SUPERVISOR', 'PENDING_MANAGER', 'PENDING_AM', 'PENDING_EMPLOYEE'].includes(s.key)).map(({ key, label, icon }) => {
                  const Icon = icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setActiveModule('CL'); setActiveSection(key); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                        ${activeSection === key ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">
                        {sectionCounts[key] || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* IDP */}
          <div>
            <button
              onClick={() => { setActiveModule('IDP'); setActiveIDPSection('ALL'); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded
                         ${activeModule === 'IDP' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'} transition`}
            >
              <BookOpenIcon className="w-5 h-5 text-white" />
              <span>IDP Leveling</span>
            </button>

            <div className="pr-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200 mb-2 px-3">
                IDP Sections
              </p>
              <button
                type="button"
                onClick={() => { setActiveModule('IDP'); setActiveIDPSection('ALL'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                  ${activeIDPSection === 'ALL' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
              >
                <span className="flex items-center gap-2">
                  <Squares2X2Icon className="w-4 h-4" />
                  All
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{allIncomingIDP.length}</span>
              </button>
              
              <div className="mt-1 space-y-1">
                {/* Action Required */}
                <button
                  type="button"
                  onClick={() => setShowIdpAction((v) => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${showIdpAction ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2">
                    {(showIdpAction ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />)}
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    Action Required
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpActionRequiredCount}</span>
                </button>
                {showIdpAction && (
                  <div className="ml-6 space-y-1">
                    {IDP_STATUS_SECTIONS.filter(s => ['DRAFT', 'RETURNED', 'FOR_COMPLETION', 'PENDING_HR'].includes(s.key)).map(({ key, label, icon }) => {
                      const Icon = icon;
                      const count = allIncomingIDP.filter(i => i.status === key && (selectedDepartment === 'ALL' || !selectedDepartment || i.department_name === selectedDepartment)).length;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveModule('IDP'); setActiveIDPSection(key); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                            ${activeIDPSection === key ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{count || 0}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* In Review */}
                <button
                  type="button"
                  onClick={() => setShowIdpInReview((v) => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${showIdpInReview ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2">
                    {(showIdpInReview ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />)}
                    <ClockIcon className="w-4 h-4" />
                    In Review
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpInReviewCount}</span>
                </button>
                {showIdpInReview && (
                  <div className="ml-6 space-y-1">
                    {IDP_STATUS_SECTIONS.filter(s => ['PENDING_MANAGER', 'PENDING_AM', 'PENDING_EMPLOYEE'].includes(s.key)).map(({ key, label, icon }) => {
                      const Icon = icon;
                      const count = allIncomingIDP.filter(i => i.status === key && (selectedDepartment === 'ALL' || !selectedDepartment || i.department_name === selectedDepartment)).length;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveModule('IDP'); setActiveIDPSection(key); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                            ${activeIDPSection === key ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{count || 0}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Other individual status sections that don't fit in groups */}
                {IDP_STATUS_SECTIONS.filter(s => !['DRAFT', 'RETURNED', 'FOR_COMPLETION', 'PENDING_HR', 'PENDING_MANAGER', 'PENDING_AM', 'PENDING_EMPLOYEE'].includes(s.key)).map(({ key, label, icon }) => {
                  const Icon = icon;
                  const count = allIncomingIDP.filter(i => i.status === key && (selectedDepartment === 'ALL' || !selectedDepartment || i.department_name === selectedDepartment)).length;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setActiveModule('IDP'); setActiveIDPSection(key); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                        ${activeIDPSection === key ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{count || 0}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Department selector in sidebar for quick filtering */}
          
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">HR Dashboard</h1>
            <p className="text-gray-600">{user.name} · {user.employee_id}</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDateSearch(!showDateSearch)}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition ${
                dateSearch.enabled 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {dateSearch.enabled ? 'Date Filter Active' : 'Search by Date'}
            </button>
            
            <button
              onClick={openExportModal}
              className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white
                         text-sm hover:bg-blue-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded bg-red-600 text-white
                         text-sm hover:bg-red-700 transition"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {/* Date Search Panel */}
        {showDateSearch && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Search Records by Date Range
              </h3>
              <button
                onClick={() => setShowDateSearch(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateSearch.startDate}
                  onChange={(e) => setDateSearch(prev => ({ ...prev, startDate: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateSearch.endDate}
                  onChange={(e) => setDateSearch(prev => ({ ...prev, endDate: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={applyDateSearch}
                  disabled={!dateSearch.startDate && !dateSearch.endDate}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Apply
                </button>
              </div>
              
              <div>
                {dateSearch.enabled && (
                  <button
                    onClick={clearDateSearch}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
            
            {dateSearch.enabled && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <strong>Active Date Filter:</strong>
                    {dateSearch.startDate && ` From ${new Date(dateSearch.startDate).toLocaleDateString()}`}
                    {dateSearch.endDate && ` To ${new Date(dateSearch.endDate).toLocaleDateString()}`}
                    {!dateSearch.startDate && !dateSearch.endDate && ' No date range specified'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Removed error and loading UI as those states are not used */}

        

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {activeModule === 'CL' ? (
            <>
              <SummaryCard
                label="CL - Pending HR"
                value={summary.clPending}
                gradientClass="from-yellow-400 to-orange-500"
              />
              <SummaryCard
                label="CL - Returns"
                value={summary.clReturned}
                gradientClass="from-red-400 to-red-600"
              />
              <SummaryCard
                label="CL – Approved"
                value={summary.clApproved}
                gradientClass="from-emerald-400 to-emerald-700"
              />
            </>
          ) : (
            // IDP Summary
            (() => {
              const pendingHR = filteredIncomingIDPs.filter(i => i.status === 'PENDING_HR').length;
              const returns = filteredIncomingIDPs.filter(i => i.status === 'DRAFT' || i.status === 'RETURNED').length;
              const approved = filteredIncomingIDPs.filter(i => i.status === 'CYCLE_COMPLETED').length;
              return (
                <>
                  <SummaryCard label="IDP - Pending HR" value={pendingHR} gradientClass="from-yellow-400 to-orange-500" />
                  <SummaryCard label="IDP - Returns" value={returns} gradientClass="from-red-400 to-red-600" />
                  <SummaryCard label="IDP – Cycle Completed" value={approved} gradientClass="from-emerald-400 to-emerald-700" />
                </>
              );
            })()
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">
              {activeLabel}
              {selectedDepartment && selectedDepartment !== 'ALL' && <span className="text-gray-500 text-lg ml-2">- {selectedDepartment}</span>}
            </h2>
            
            {dateSearch.enabled && (
              <div className="text-sm text-gray-600 bg-yellow-50 px-3 py-1 rounded-md border border-yellow-200">
                <span className="font-medium">Date Filtered:</span>
                <span className="ml-1">
                  {activeModule === 'CL' 
                    ? `${filteredIncomingCLs.length} CL records` 
                    : `${filteredIncomingIDPs.length} IDP records`
                  }
                </span>
              </div>
            )}
          </div>

            {activeModule === 'CL' ? (
            activeSection === 'ALL' ? (
              /* All Sections View */
              <>
                {CL_STATUS_SECTIONS.map(({ key, label }) => {
                  const items = getPaginatedCLByStatus(key);
                  const totalItems = filteredIncomingCLs.filter(cl => cl.status === key).length;
                  return (
                    <div key={key} className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        {label} ({totalItems} total)
                      </h3>
                      {items.length === 0 ? (
                        <p className="text-gray-400 text-sm italic">No employees in this status.</p>
                      ) : (
                        <CLTable data={items} onCLClick={handleCLClick} />
                      )}
                    </div>
                  );
                })}
                {/* CL Pagination Controls for ALL view */}
                {filteredIncomingCLs.length > clPagination.itemsPerPage && (
                  <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        Showing {((clPagination.currentPage - 1) * clPagination.itemsPerPage) + 1} to{' '}
                        {Math.min(clPagination.currentPage * clPagination.itemsPerPage, filteredIncomingCLs.length)} of{' '}
                        {filteredIncomingCLs.length} entries
                      </span>
                      <select
                        value={clPagination.itemsPerPage}
                        onChange={(e) => setClPagination(prev => ({ ...prev, itemsPerPage: Number(e.target.value), currentPage: 1 }))}
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        <option value={5}>5 per page</option>
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                        <option value={50}>50 per page</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setClPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                        disabled={clPagination.currentPage === 1}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        {clPagination.currentPage} of {totalCLPages}
                      </span>
                      <button
                        onClick={() => setClPagination(prev => ({ ...prev, currentPage: Math.min(totalCLPages, prev.currentPage + 1) }))}
                        disabled={clPagination.currentPage === totalCLPages}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Single Section View */
              (() => {
                const items = getPaginatedCLByStatus(activeSection);
                const totalItems = filteredIncomingCLs.filter(cl => cl.status === activeSection).length;
                if (totalItems === 0) {
                  return <p className="text-gray-400 text-sm italic">No employees in this status.</p>;
                }
                return (
                  <>
                    <CLTable data={items} onCLClick={handleCLClick} />
                    {/* CL Pagination Controls for single section view */}
                    {totalItems > clPagination.itemsPerPage && (
                      <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">
                            Showing {((clPagination.currentPage - 1) * clPagination.itemsPerPage) + 1} to{' '}
                            {Math.min(clPagination.currentPage * clPagination.itemsPerPage, totalItems)} of{' '}
                            {totalItems} entries
                          </span>
                          <select
                            value={clPagination.itemsPerPage}
                            onChange={(e) => setClPagination(prev => ({ ...prev, itemsPerPage: Number(e.target.value), currentPage: 1 }))}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            <option value={5}>5 per page</option>
                            <option value={10}>10 per page</option>
                            <option value={20}>20 per page</option>
                            <option value={50}>50 per page</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setClPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                            disabled={clPagination.currentPage === 1}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <span className="text-sm text-gray-600">
                            {clPagination.currentPage} of {Math.ceil(totalItems / clPagination.itemsPerPage)}
                          </span>
                          <button
                            onClick={() => setClPagination(prev => ({ ...prev, currentPage: Math.min(Math.ceil(totalItems / clPagination.itemsPerPage), prev.currentPage + 1) }))}
                            disabled={clPagination.currentPage === Math.ceil(totalItems / clPagination.itemsPerPage)}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            )
            ) : (
            // IDP Module
            idpLoading ? (
              <p className="text-gray-500">Loading IDPs...</p>
            ) : idpError ? (
              <p className="text-red-500">{idpError}</p>
            ) : activeIDPSection === 'ALL' ? (
              <>
                {IDP_STATUS_SECTIONS.map(({ key, label }) => {
                  const items = getPaginatedIDPByStatus(key);
                  const totalItems = filteredIncomingIDPs.filter(idp => idp.status === key).length;
                  return (
                    <div key={key} className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        {label} ({totalItems} total)
                      </h3>
                      {items.length === 0 ? (
                        <p className="text-gray-400 text-sm italic">No employees in this status.</p>
                      ) : (
                        <IDPTable 
                          data={items} 
                          goTo={goTo}
                        />
                      )}
                    </div>
                  );
                })}
                {/* IDP Pagination Controls for ALL view */}
                {filteredIncomingIDPs.length > idpPagination.itemsPerPage && (
                  <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        Showing {((idpPagination.currentPage - 1) * idpPagination.itemsPerPage) + 1} to{' '}
                        {Math.min(idpPagination.currentPage * idpPagination.itemsPerPage, filteredIncomingIDPs.length)} of{' '}
                        {filteredIncomingIDPs.length} entries
                      </span>
                      <select
                        value={idpPagination.itemsPerPage}
                        onChange={(e) => setIdpPagination(prev => ({ ...prev, itemsPerPage: Number(e.target.value), currentPage: 1 }))}
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        <option value={5}>5 per page</option>
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                        <option value={50}>50 per page</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIdpPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                        disabled={idpPagination.currentPage === 1}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        {idpPagination.currentPage} of {totalIDPPages}
                      </span>
                      <button
                        onClick={() => setIdpPagination(prev => ({ ...prev, currentPage: Math.min(totalIDPPages, prev.currentPage + 1) }))}
                        disabled={idpPagination.currentPage === totalIDPPages}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              (() => {
                const items = getPaginatedIDPByStatus(activeIDPSection);
                const totalItems = filteredIncomingIDPs.filter(idp => idp.status === activeIDPSection).length;
                if (totalItems === 0) {
                  return <p className="text-gray-400 text-sm italic">No employees in this status.</p>;
                }
                return (
                  <>
                    <IDPTable 
                      data={items} 
                      goTo={goTo}
                    />
                    {/* IDP Pagination Controls for single section view */}
                    {totalItems > idpPagination.itemsPerPage && (
                      <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-600">
                            Showing {((idpPagination.currentPage - 1) * idpPagination.itemsPerPage) + 1} to{' '}
                            {Math.min(idpPagination.currentPage * idpPagination.itemsPerPage, totalItems)} of{' '}
                            {totalItems} entries
                          </span>
                          <select
                            value={idpPagination.itemsPerPage}
                            onChange={(e) => setIdpPagination(prev => ({ ...prev, itemsPerPage: Number(e.target.value), currentPage: 1 }))}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            <option value={5}>5 per page</option>
                            <option value={10}>10 per page</option>
                            <option value={20}>20 per page</option>
                            <option value={50}>50 per page</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIdpPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                            disabled={idpPagination.currentPage === 1}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <span className="text-sm text-gray-600">
                            {idpPagination.currentPage} of {Math.ceil(totalItems / idpPagination.itemsPerPage)}
                          </span>
                          <button
                            onClick={() => setIdpPagination(prev => ({ ...prev, currentPage: Math.min(Math.ceil(totalItems / idpPagination.itemsPerPage), prev.currentPage + 1) }))}
                            disabled={idpPagination.currentPage === Math.ceil(totalItems / idpPagination.itemsPerPage)}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            )
          )}
        </section>
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="w-56 bg-white border-l border-gray-200 flex flex-col">
        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={() => setShowFullNotifications(true)}
              className="w-full flex items-center justify-between hover:bg-gray-50 transition text-left rounded px-2 py-1 -mx-2 mb-3"
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
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="mt-2 w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition text-center mb-3"
              >
                Mark All as Read
              </button>
            )}
            {/* Filters: ALL / CL / IDP */}
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'CL', 'IDP'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setNotificationFilter(filter)}
                  className={`px-3 py-1 text-xs rounded-full font-semibold transition ${
                    notificationFilter === filter
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-2 no-scrollbar">
            {filteredNotifications.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No notifications.</p>
            ) : (
              filteredNotifications.map((n, idx) => {
                const isUnread = String(n.status || '').toLowerCase() === 'unread';
                return (
                  <button
                    key={`${n.id}-${idx}`}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                      isUnread ? 'bg-orange-50 hover:bg-orange-100' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <p className="flex-1 font-medium text-gray-800 whitespace-pre-wrap">
                        {n.message || n.title || 'Notification'}
                      </p>
                      {n.module && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          n.module === 'CL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {n.module}
                        </span>
                      )}
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

        <div className="border-t border-gray-200" />

        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={() => setShowFullRecentActions(true)}
              className="w-full flex items-center justify-between hover:bg-gray-50 transition text-left rounded px-2 py-1 -mx-2 mb-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Recent Actions</span>
                <ArrowsPointingOutIcon className="w-4 h-4 text-gray-400" />
              </div>
              {filteredRecentActions.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white">
                  {filteredRecentActions.length}
                </span>
              )}
            </button>
            {/* Filters: ALL / CL / IDP */}
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'CL', 'IDP'].map(filter => (
                <button
                  key={filter}
                  onClick={() => {
                    setRecentActionFilter(filter);
                    setRecentActionsPagination(prev => ({ ...prev, currentPage: 1 }));
                  }}
                  className={`px-3 py-1 text-xs rounded-full font-semibold transition ${
                    recentActionFilter === filter
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-2 overflow-y-auto no-scrollbar">
            {filteredRecentActions.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-2">No recent actions.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold text-gray-600">Action</th>
                        <th className="px-2 py-1 text-left font-semibold text-gray-600">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecentActions.map((a, idx) => (
                        <tr
                          key={`${a.id}-${idx}`}
                          className="border-t border-gray-100"
                        >
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-gray-800 truncate">{a.title || 'Action'}</p>
                              {a.module && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                                  a.module === 'CL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {a.module}
                                </span>
                              )}
                            </div>
                            {a.description && (
                              <p className="text-gray-600 truncate text-[11px]">{a.description}</p>
                            )}
                          </td>
                          <td className="px-2 py-2 text-gray-500 whitespace-nowrap">
                            {a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination Controls */}
                {totalRecentActionPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-2 mt-2 border-t border-gray-100">
                    <button
                      onClick={() => setRecentActionsPagination(prev => ({
                        ...prev,
                        currentPage: Math.max(1, prev.currentPage - 1)
                      }))}
                      disabled={recentActionsPagination.currentPage === 1}
                      className="px-2 py-1 text-[10px] rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <span className="text-[10px] text-gray-500">
                      {recentActionsPagination.currentPage} of {totalRecentActionPages}
                    </span>
                    
                    <button
                      onClick={() => setRecentActionsPagination(prev => ({
                        ...prev,
                        currentPage: Math.min(totalRecentActionPages, prev.currentPage + 1)
                      }))}
                      disabled={recentActionsPagination.currentPage === totalRecentActionPages}
                      className="px-2 py-1 text-[10px] rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </aside>

      <Modal
        open={modalState.open}
        title={modalState.title}
        message={modalState.message}
        showCancel={modalState.showCancel}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={handleModalConfirm}
        onClose={closeModal}
      />

      <NotificationModal
        open={notificationModalState.open}
        notification={notificationModalState.notification}
        onProceed={() => proceedToNotificationLink(notificationModalState.notification)}
        onClose={closeNotificationModal}
      />

      <FullRecentActionsModal
        open={showFullRecentActions}
        recentActions={recentActions}
        onActionClick={handleRecentActionClick}
        onClose={() => setShowFullRecentActions(false)}
      />

      <FullNotificationsModal
        open={showFullNotifications}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onMarkAllRead={handleMarkAllAsRead}
        onClose={() => setShowFullNotifications(false)}
      />

      {/* Export Modal */}
      {exportModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-200 bg-opacity-50 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={closeExportModal}
          />

          <div className="relative z-50 bg-white rounded-lg shadow-xl border border-gray-300 max-w-lg w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Export Data</h3>
              <button
                onClick={closeExportModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Module</label>
                <select
                  value={exportModal.module}
                  onChange={(e) => setExportModal(prev => ({ ...prev, module: e.target.value, selectedStatus: 'ALL' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="CL">Competency Leveling (CL)</option>
                  <option value="IDP">Individual Development Plan (IDP)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                  <span className="text-xs text-gray-500 ml-2">(You can change this for export)</span>
                </label>
                <select
                  value={exportModal.department}
                  onChange={(e) => setExportModal(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="ALL">All Departments</option>
                  {departments && departments.length > 0 ? (
                    departments.map(dept => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))
                  ) : (
                    allDepartments && allDepartments.length > 0 && allDepartments.map(dept => (
                      <option key={dept.id || dept.name} value={dept.name}>
                        {dept.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={exportModal.startDate}
                    onChange={(e) => setExportModal(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    max={exportModal.endDate || new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={exportModal.endDate}
                    onChange={(e) => setExportModal(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    min={exportModal.startDate}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
                <select
                  value={exportModal.selectedStatus}
                  onChange={(e) => setExportModal(prev => ({ ...prev, selectedStatus: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  {exportModal.module === 'CL' ? (
                    CL_STATUS_SECTIONS.map(section => (
                      <option key={section.key} value={section.key}>{section.label}</option>
                    ))
                  ) : (
                    IDP_STATUS_SECTIONS.map(section => (
                      <option key={section.key} value={section.key}>{section.label}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeExportModal}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                disabled={exportModal.loading}
              >
                Cancel
              </button>
              <button
                onClick={handleExportCSV}
                className={`px-6 py-2 text-sm text-white rounded-md transition-all flex items-center gap-2 ${
                  exportModal.loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : !exportModal.startDate || !exportModal.endDate
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md'
                }`}
                disabled={exportModal.loading || !exportModal.startDate || !exportModal.endDate}
                title={!exportModal.startDate || !exportModal.endDate ? 'Please select both start and end dates' : ''}
              >
                {exportModal.loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CL Details Modal */}
      {clDetailsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-200 bg-opacity-50">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            onClick={closeCLDetailsModal}
          />

          <div className="relative z-50 bg-white rounded-lg shadow-xl border border-gray-300 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">
                Competency Leveling Details {clDetailsModal.details?.id ? `(CL #${clDetailsModal.details.id})` : ''}
              </h3>
              <button
                onClick={closeCLDetailsModal}
                className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {clDetailsModal.loading && (
                <div className="text-center py-8 text-gray-500">
                  Loading CL details...
                </div>
              )}

              {!clDetailsModal.loading && !clDetailsModal.details && (
                <div className="text-center py-8 text-gray-500">
                  No details available.
                </div>
              )}

              {!clDetailsModal.loading && clDetailsModal.details && (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-700 mb-3">Basic Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">CL ID:</span>
                        <span className="ml-2 font-medium text-gray-800">{clDetailsModal.details.id}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Employee:</span>
                        <span className="ml-2 font-medium text-gray-800">{clDetailsModal.details.employee_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Supervisor:</span>
                        <span className="ml-2 font-medium text-gray-800">{clDetailsModal.details.supervisor_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <span className="ml-2 font-medium text-blue-600">{displayStatus(clDetailsModal.details.status)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Department:</span>
                        <span className="ml-2 font-medium text-gray-800">{clDetailsModal.details.department_name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Score:</span>
                        <span className="ml-2 font-medium text-green-600">{clDetailsModal.details.total_score || 'N/A'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Created:</span>
                        <span className="ml-2 font-medium text-gray-800">
                          {clDetailsModal.details.created_at ? new Date(clDetailsModal.details.created_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Competency Items */}
                  {clDetailsModal.details.items && clDetailsModal.details.items.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 p-4 border-b border-gray-200">Competency Assessment Items</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Competency</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Weight (%)</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">MPLR</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Level</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Score</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Comments (Justification / Trainings / Certificates, Etc)</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">PDF</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {clDetailsModal.details.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-800">{item.competency_name || 'N/A'}</td>
                                <td className="px-4 py-3 text-center text-gray-700">{item.weight || 0}%</td>
                                <td className="px-4 py-3 text-center text-gray-700">{item.mplr || 'N/A'}</td>
                                <td className="px-4 py-3 text-center font-medium text-blue-600">{item.assigned_level || 'N/A'}</td>
                                <td className="px-4 py-3 text-center font-semibold text-green-600">
                                  {((item.weight / 100) * item.assigned_level).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-gray-700 text-xs">{item.justification || '-'}</td>
                                <td className="px-4 py-3 text-center">
                                  {item.pdf_path ? (
                                    <a
                                      href={`${import.meta.env.VITE_API_BASE_URL}${item.pdf_path}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline text-xs"
                                    >
                                      View
                                    </a>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Remarks */}
                  {clDetailsModal.details.remarks && (
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Remarks</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{clDetailsModal.details.remarks}</p>
                    </div>
                  )}

                  {/* Decisions */}
                  {(clDetailsModal.details.hr_decision || clDetailsModal.details.manager_decision) && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Review Decisions</h4>
                      <div className="space-y-2 text-sm">
                        {clDetailsModal.details.hr_decision && (
                          <div>
                            <span className="text-gray-600">HR Decision:</span>
                            <span className="ml-2 font-medium text-gray-800">{clDetailsModal.details.hr_decision}</span>
                            {clDetailsModal.details.hr_remarks && (
                              <p className="mt-1 text-xs text-gray-600 ml-4">💬 {clDetailsModal.details.hr_remarks}</p>
                            )}
                          </div>
                        )}
                        {clDetailsModal.details.manager_decision && (
                          <div>
                            <span className="text-gray-600">Manager Decision:</span>
                            <span className="ml-2 font-medium text-gray-800">{clDetailsModal.details.manager_decision}</span>
                            {clDetailsModal.details.manager_remarks && (
                              <p className="mt-1 text-xs text-gray-600 ml-4">💬 {clDetailsModal.details.manager_remarks}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                onClick={closeCLDetailsModal}
                className="px-4 py-2 text-sm rounded-md bg-gray-600 text-white hover:bg-gray-700 transition"
              >
                Close
              </button>
              {clDetailsModal.details?.id && (
                <button
                  onClick={() => {
                    closeCLDetailsModal();
                    goTo(`/cl/hr/review/${clDetailsModal.details.id}`);
                  }}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Go to Review Form
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to determine explicit completed statuses (shared for HR dashboard tables)
function _isCompletedStatus(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return COMPLETION_STATUS_OPTIONS.slice(2).some(opt => String(opt).toLowerCase() === s || s.startsWith('completed'));
}

/* COMPONENTS */

function SummaryCard({ label, value, gradientClass }) {
  return (
    <div className={`p-4 rounded shadow-md bg-gradient-to-r ${gradientClass}`}>
      <h3 className="text-sm text-white/80">{label}</h3>
      <p className="text-3xl font-semibold text-white mt-1">{value}</p>
    </div>
  );
}

function CLTable({ data, onCLClick }) {
  return (
    <div className="bg-white shadow rounded overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <Th>CL ID</Th>
            <Th>Employee</Th>
            <Th>Employee ID</Th>
            <Th>Department</Th>
            <Th>Position</Th>
            <Th>Supervisor</Th>
            <Th>Status</Th>
            <Th>Score</Th>
            <Th>Submitted At</Th>
            <Th>Actions</Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
          {data.map((item, idx) => (
            <tr key={`${item.id}-${idx}`} className="hover:bg-gray-50">
              <Td>{item.id}</Td>
              <Td>{item.employee_name}</Td>
              <Td>{item.employee_code || item.employee_id}</Td>
              <Td>{item.department_name}</Td>
              <Td>{item.position_title}</Td>
              <Td>{item.supervisor_name || '-'}</Td>
              <Td>
                {item.status === 'DRAFT' 
                  ? (item.submitted_at 
                      ? (item.awaiting_approval_from 
                          ? `Returned from ${item.awaiting_approval_from.replace('PENDING_', '').replace(/_/g, ' ')}` 
                          : 'Returned to supervisor')
                      : 'Draft - Not Submitted')
                  : displayStatus(item.status)}
              </Td>
              <Td>{item.total_score != null ? item.total_score : '-'}</Td>
              <Td>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : (item.created_at ? new Date(item.created_at).toLocaleString() : '-')}</Td>

              <Td>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onCLClick(item.id);
                    }}
                    className="px-3 py-1 rounded text-white text-xs bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
                  >
                    Review
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IDPTable({ data, goTo }) {
  
  return (
    <div className="bg-white shadow rounded overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <Th>IDP ID</Th>
            <Th>Employee</Th>
            <Th>Employee ID</Th>
            <Th>Department</Th>
            <Th>Position</Th>
            <Th>Supervisor</Th>
            <Th>Status</Th>
            <Th>Submitted At</Th>
            <Th>Actions</Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
          {data.map((item, idx) => {
            return (
              <tr key={`${item.id}-${idx}`} className="hover:bg-gray-50">
                <Td>{item.id}</Td>
                <Td>{item.employee_name}</Td>
                <Td>{item.employee_code || item.employee_id}</Td>
                <Td>{item.department_name}</Td>
                <Td>{item.position_title || '-'}</Td>
                <Td>{item.supervisor_name || '-'}</Td>
                <Td>{displayStatus(item.status)}</Td>
                <Td>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : (item.created_at ? new Date(item.created_at).toLocaleString() : '-')}</Td>

                <Td>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={(e) => { e.stopPropagation(); goTo(`/hr/idp/${item.id}?viewOnly=true`); }}
                      className="px-3 py-1 rounded text-white text-xs bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
                    >
                      View
                    </button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="px-4 py-2 text-gray-700">{children}</td>;
}

function Modal({
  open,
  title,
  message,
  showCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-700 whitespace-pre-line">{message}</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          {showCancel && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationModal({ open, notification, onProceed, onClose }) {
  const [canProceed, setCanProceed] = useState(true);

  useEffect(() => {
    if (!open || !notification) return;

    async function checkIfActionNeeded() {
      try {
        const url = notification.url || '';
        const msg = String(notification.message || '').toLowerCase();
        if (msg.includes('acknowledg') || msg.includes('acknowledged') || msg.includes('requires completion per hr')) {
          setCanProceed(false);
          return;
        }

        if (url.includes('/cl/hr/review/') || url.includes('/cl/supervisor/review/')) {
          const clean = String(url).split('?')[0].split('#')[0];
          const parts = clean.split('/').filter(Boolean);
          const id = parts[parts.length - 1];
          if (!id) { setCanProceed(true); return; }
          const data = await apiRequest(`/api/cl/${id}`);
          const status = (data && data.status) ? String(data.status).toUpperCase() : '';
          setCanProceed(['PENDING_HR', 'PENDING_SUPERVISOR', 'RETURNED'].includes(status));
        } else if (url.includes('/idp/hr/review/') || url.includes('/idp/supervisor/review/')) {
          const clean = String(url).split('?')[0].split('#')[0];
          const parts = clean.split('/').filter(Boolean);
          const id = parts[parts.length - 1];
          if (!id) { setCanProceed(true); return; }
          const res = await apiRequest(`/api/idp/${id}`);
          const status = (res && res.header && res.header.status) ? String(res.header.status).toUpperCase() : '';
          setCanProceed(['PENDING_HR', 'PENDING_SUPERVISOR', 'RETURNED'].includes(status));
        } else {
          setCanProceed(true);
        }
      } catch (err) {
        console.debug('[NotificationModal] status check failed', err);
        setCanProceed(false);
      }
    }

    checkIfActionNeeded();
  }, [open, notification]);

  if (!open || !notification) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Notification Details</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Message</p>
            <p className="text-sm text-gray-800 mt-1">
              {notification.message || notification.title || 'No message'}
            </p>
          </div>
          {notification.module && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Module</p>
              <p className="text-sm text-gray-800 mt-1">{notification.module}</p>
            </div>
          )}
          {notification.created_at && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Time</p>
              <p className="text-sm text-gray-800 mt-1">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              String(notification.status || '').toLowerCase() === 'unread'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {notification.status || 'Unknown'}
            </span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Close
          </button>
          {canProceed && (
            <button
              type="button"
              onClick={() => onProceed && onProceed(notification)}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Go to Form
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FullRecentActionsModal({ open, recentActions, onActionClick, onClose }) {
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter actions by date range and search term
  const filteredActions = recentActions.filter(a => {
    // Date filtering
    if (a.created_at) {
      const actionDate = new Date(a.created_at);
      const start = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
      const end = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
      
      if (start && actionDate < start) return false;
      if (end) {
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (actionDate > endOfDay) return false;
      }
    }
    
    // Search term filtering (search in title, description)
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      const matchTitle = (a.title || '').toLowerCase().includes(search);
      const matchDescription = (a.description || '').toLowerCase().includes(search);
      if (!matchTitle && !matchDescription) return false;
    }
    
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredActions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedActions = filteredActions.slice(startIndex, endIndex);

  const filterKey = `${dateFilter.startDate}-${dateFilter.endDate}-${searchTerm}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  
  // Reset page when filters change
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setCurrentPage(1);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Recent Actions</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Date Filter */}
          <div className="space-y-3">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  setDateFilter({ startDate: '', endDate: '' });
                  setSearchTerm('');
                }}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
              >
                Clear
              </button>
            </div>
            
            {/* Search by Employee Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Search Employee Name</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by employee name..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {filteredActions.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No recent actions found.</p>
          ) : (
            <div className="space-y-4">
              <div className="bg-white shadow rounded overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Action</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedActions.map((a, idx) => (
                      <tr
                        key={`${a.id}-${idx}`}
                        className=""
                      >
                        <td className="px-4 py-3 text-gray-800 font-medium">{a.title || 'Action'}</td>
                        <td className="px-4 py-3 text-gray-600">{a.description || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {a.created_at ? new Date(a.created_at).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredActions.length)} of {filteredActions.length} actions
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-2 text-sm rounded ${
                              currentPage === pageNum
                                ? 'bg-blue-500 text-white'
                                : 'border border-gray-300 bg-white hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FullNotificationsModal({ open, notifications, onNotificationClick, onClose, onMarkAllRead }) {
  if (!open) return null;

  const unreadCount = notifications.filter(n => String(n.status || '').toLowerCase() === 'unread').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold text-gray-800">All Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  onMarkAllRead();
                }}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                Mark All as Read ({unreadCount})
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {notifications.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No notifications found.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n, idx) => {
                const isUnread = String(n.status || '').toLowerCase() === 'unread';
                return (
                  <button
                    key={`${n.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      onNotificationClick(n);
                      onClose();
                    }}
                    className={`w-full text-left p-4 rounded-lg border border-gray-200
                               transition shadow-sm hover:shadow ${
                                 isUnread ? 'bg-orange-50 hover:bg-orange-100' : 'bg-white hover:bg-gray-50'
                               }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 mb-1">
                          {n.message || n.title || 'Notification'}
                        </p>
                        {n.module && (
                          <p className="text-sm text-gray-600 mb-2">Module: {n.module}</p>
                        )}
                        {n.created_at && (
                          <p className="text-xs text-gray-400">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {isUnread && (
                        <span className="ml-4 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                          Unread
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HRDashboard;