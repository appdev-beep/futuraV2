// src/pages/Supervisor/SupervisorDashboard.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardDocumentCheckIcon,
  BookOpenIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  Squares2X2Icon,
  ClockIcon,
  UserIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  ArrowsPointingOutIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import '../../index.css';
import '../../App.css';
import SupervisorCL from './SupervisorCL';
import SupervisorIDP from './SupervisorIDP';

const SCORING_GUIDE = [
  { score: 5, description: 'Exceptional & Completed: Exceeded expectations, demonstrated mastery beyond the target level. Project/activity is completed, and impact is notable.', status: 'Completed & Exceeded Competency' },
  { score: 4, description: 'Advanced & Completed: Fully met expectations with proficiency at or slightly above the target level. The project/activity is fully completed.', status: 'Completed & Above Target Expectation' },
  { score: 3, description: 'Proficient & Completed: Met most expectations, demonstrated proficiency at the target level. The project/activity is fully completed.', status: 'Completed & Met Expectations' },
  { score: 2, description: 'Developing & Incomplete: Some progress made, but competency is below the target level. The project/activity is incomplete or partially completed.', status: 'In Progress (50-79% Completed)' },
  { score: 1, description: 'Basic & Not Started: Little to no progress in competency development. The project/activity is not started or significantly behind schedule.', status: 'Not Started/In Progress (<50%)' }
];

const DEVELOPMENT_TYPES = ['Education', 'Experience', 'Exposure'];

function SupervisorDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [idpByStatus, setIdpByStatus] = useState({});
  const [clByStatus, setClByStatus] = useState({});
  const [idpEmployees, setIdpEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('ALL');
  const [notifications, setNotifications] = useState([]);
  const [notificationFilter, setNotificationFilter] = useState('ALL'); // 'ALL' | 'CL' | 'IDP'
  const [recentActions, setRecentActions] = useState([]);
  const [recentFilter, setRecentFilter] = useState('ALL'); // 'ALL' | 'CL' | 'IDP'

  const [activePage, setActivePage] = useState('CL'); // 'CL' or 'IDP'
  const [activeSection, setActiveSection] = useState('ALL');
  const [activeIDPSection, setActiveIDPSection] = useState('ALL');
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);
  const [showFullNotifications, setShowFullNotifications] = useState(false);
  const [showClAction, setShowClAction] = useState(false);
  const [showClInReview, setShowClInReview] = useState(false);
  const [showIdpAction, setShowIdpAction] = useState(false);
  const [showIdpInReview, setShowIdpInReview] = useState(false);
  // Pagination for Recent Actions (right sidebar)
  const [recentPage, setRecentPage] = useState(1);
  const RECENT_PAGE_SIZE = 10;

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

  // ...removed IDP creation modal state and logic. IDP creation is now handled only in CreateIDPPage.jsx



  const [department, setDepartment] = useState(null);

  // Dynamically build CL and IDP status sections based on department.has_am
  const CL_STATUS_SECTIONS = useMemo(() => {
    const sections = [
      { key: 'DRAFT', label: 'Returned for Review', icon: PencilSquareIcon },
      { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee', icon: UserIcon },
      { key: 'PENDING_HR', label: 'For Approval by HR', icon: BriefcaseIcon },
    ];
    if (department && department.has_am) {
      sections.push({ key: 'PENDING_AM', label: 'For Approval by Assistant Manager', icon: ClockIcon });
    }
    sections.push({ key: 'PENDING_MANAGER', label: 'For Approval by Manager', icon: ClockIcon });
    sections.push({ key: 'APPROVED', label: 'Approved', icon: CheckCircleIcon });
    return sections;
  }, [department]);

  const IDP_STATUS_SECTIONS = useMemo(() => {
    const sections = [
      { key: 'DRAFT', label: 'Drafts', icon: PencilSquareIcon },
      { key: 'RETURNED', label: 'Returned for Review', icon: PencilSquareIcon },
      { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee', icon: UserIcon },
      { key: 'PENDING_HR', label: 'For Approval by HR', icon: BriefcaseIcon },
    ];
    if (department && department.has_am) {
      sections.push({ key: 'PENDING_AM', label: 'For Approval by Assistant Manager', icon: ClockIcon });
    }
    // Supervisor needs a dedicated section to see IDPs marked "For Completion"
    // so they can browse and update those forms.
    sections.push({ key: 'FOR_COMPLETION', label: 'For Completion', icon: ClockIcon });
    sections.push({ key: 'PENDING_MANAGER', label: 'For Approval by Manager', icon: ClockIcon });
    sections.push({ key: 'CYCLE_COMPLETED', label: 'Cycle Completed', icon: CheckCircleIcon });
    return sections;
  }, [department]);

  // Filter data by selected employee
  const filteredClByStatus = useMemo(() => {
    if (selectedEmployee === 'ALL') return clByStatus;
    
    const filtered = {};
    for (const [status, items] of Object.entries(clByStatus)) {
      filtered[status] = (items || []).filter(item => 
        String(item.employee_id) === String(selectedEmployee) ||
        String(item.employee_code) === String(selectedEmployee)
      );
    }
    return filtered;
  }, [clByStatus, selectedEmployee]);

  const filteredIdpByStatus = useMemo(() => {
    if (selectedEmployee === 'ALL') return idpByStatus;
    
    const filtered = {};
    for (const [status, items] of Object.entries(idpByStatus)) {
      filtered[status] = (items || []).filter(item => 
        String(item.employee_id) === String(selectedEmployee) ||
        String(item.employee_code) === String(selectedEmployee)
      );
    }
    return filtered;
  }, [idpByStatus, selectedEmployee]);

  const filteredIdpEmployees = useMemo(() => {
    if (selectedEmployee === 'ALL') return idpEmployees;
    return (idpEmployees || []).filter(emp => 
      String(emp.id) === String(selectedEmployee) ||
      String(emp.employee_id) === String(selectedEmployee) ||
      String(emp.employee_code) === String(selectedEmployee)
    );
  }, [idpEmployees, selectedEmployee]);

  // Update summary calculations to use filtered data
  const filteredSummary = useMemo(() => {
    return {
      clPending: (filteredClByStatus?.PENDING_AM?.length || 0) + (filteredClByStatus?.PENDING_MANAGER?.length || 0),
      clApproved: (filteredClByStatus?.APPROVED?.length || 0),
      clReturned: (filteredClByStatus?.DRAFT?.length || 0) + (filteredClByStatus?.RETURNED?.length || 0),
    };
  }, [filteredClByStatus]);

  const filteredIdpSummary = useMemo(() => {
    return {
      idpCreation: filteredIdpEmployees.length,
      idpPending: (filteredIdpByStatus?.PENDING_AM?.length || 0) + (filteredIdpByStatus?.PENDING_MANAGER?.length || 0),
      idpCycleCompleted: (filteredIdpByStatus?.CYCLE_COMPLETED?.length || 0),
      idpReturned: (filteredIdpByStatus?.RETURNED?.length || 0),
      idpDrafts: (filteredIdpByStatus?.DRAFT?.length || 0),
    };
  }, [filteredIdpByStatus, filteredIdpEmployees]);

  useEffect(() => {
    const supervisorRoles = ['Supervisor', 'AM', 'Manager', 'HR'];
    const stored = localStorage.getItem('user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(stored);
    if (!supervisorRoles.includes(parsed.role)) {
      window.location.href = '/';
      return;
    }

    setUser(parsed);

    // Fetch department info for the user
    async function fetchDepartment() {
      try {
        const departments = await apiRequest('/api/lookup/departments');
        const dept = departments.find((d) => d.id === parsed.department_id);
        setDepartment(dept || null);
      } catch {
        setDepartment(null);
      }
    }
    fetchDepartment();
  }, []);

  const navigate = useNavigate();

  // Load employees under this supervisor
  async function loadEmployees() {
    if (!user) return;
    try {
      const employees = await apiRequest('/api/users/supervisor/employees');
      setAllEmployees(employees || []);
    } catch (err) {
      console.error('Failed to load employees:', err);
      setAllEmployees([]);
    }
  }

  // Load dashboard data; exposed so child components can trigger a refresh without reloading the page
  async function loadDashboard(preserveScroll = false) {
    if (!user) return;
    const scrollPosition = preserveScroll ? window.scrollY : 0;
    try {
      setLoading(true);
      const [, clGrouped, idpCreation, idpGrouped] = await Promise.all([
        apiRequest('/api/cl/supervisor/summary'),
        apiRequest('/api/cl/supervisor/all'),
        apiRequest('/api/idp/supervisor/for-creation'),
        apiRequest('/api/idp/supervisor/grouped'),
      ]);

      setClByStatus(clGrouped || {});
      setIdpEmployees(idpCreation || []);

      // Calculate summary from grouped IDPs
      setIdpByStatus(idpGrouped || {});
    } catch (err) {
      console.error(err);
      setError('Failed to load Supervisor dashboard data.');
    } finally {
      setLoading(false);
      // Restore scroll position if preserving
      if (preserveScroll && scrollPosition > 0) {
        setTimeout(() => window.scrollTo(0, scrollPosition), 100);
      }
    }
  }

  useEffect(() => {
    loadDashboard();
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Clamp recent actions page when list or filter changes
  useEffect(() => {
    const total = Math.max(1, Math.ceil((recentActions || []).length / RECENT_PAGE_SIZE));
    if (recentPage > total) setRecentPage(total);
    if (recentPage < 1) setRecentPage(1);
  }, [recentActions, recentFilter, recentPage]);

  // Notifications (polling)
  useEffect(() => {
    if (!user) return;

    let timer;

    async function loadNotifications() {
      try {
        const query = notificationFilter === 'ALL' ? '' : `?module=${notificationFilter}`;
        const data = await apiRequest(`/api/notifications${query}`);
        setNotifications(data || []);
      } catch (err) {
        console.error('Failed to load notifications', err);
      }
    }

    loadNotifications();
    timer = setInterval(loadNotifications, 15000);

    return () => clearInterval(timer);
  }, [user, notificationFilter]);


  // Recent actions
  const loadRecentActions = useCallback(async () => {
    if (!user) return;
    
    try {
      const query = recentFilter === 'ALL' ? '' : `?module=${recentFilter}`;
      const data = await apiRequest(`/api/recent-actions${query}`);
      setRecentActions(data || []);
    } catch (err) {
      console.error('Failed to load recent actions', err);
    }
  }, [user, recentFilter]);

  useEffect(() => {
    loadRecentActions();
  }, [loadRecentActions]);

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

  function goTo(url) {
    // Always use SPA navigation, never reload the page
    navigate(url);
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

  async function handleDeleteCL(clId) {
    openModal({
      title: 'Delete CL',
      message: 'Are you sure you want to delete this CL? This action cannot be undone. All associated data will be permanently removed.',
      showCancel: true,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await apiRequest(`/api/cl/${clId}`, { method: 'DELETE' });
          openModal({
            title: 'Deleted',
            message: 'CL deleted successfully. The action has been logged in your Recent Actions.',
            showCancel: false,
            confirmText: 'OK',
            onConfirm: () => {
              loadDashboard(true);
              loadRecentActions(); // Refresh recent actions to show the deletion
            },
          });
        } catch (err) {
          console.error(err);
          openModal({
            title: 'Error',
            message: err.message || 'Failed to delete CL.',
            showCancel: false,
            confirmText: 'OK',
          });
        }
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

  async function handleRecentActionClick(action) {
    // If action is a deletion, show when it was deleted
    if (action.title && action.title.toLowerCase().includes('deleted')) {
      openModal({
        title: 'Recent Action Details',
        message: `${action.title}\n\n${action.description || ''}\n\nDeleted at: ${new Date(action.created_at).toLocaleString()}`,
        showCancel: false,
        confirmText: 'OK',
      });
      return;
    }
    
    // Always navigate using SPA without page refresh
    const url = action.url || '/supervisor';
    const separator = url.includes('?') ? '&' : '?';
    navigate(`${url}${separator}viewOnly=true`);
  }

  async function proceedToNotificationLink(n) {
    setNotificationModalState({ open: false, notification: null });
    
    try {
      if (n?.id) {
        await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
        // Update notifications without reloading entire dashboard
        const data = await apiRequest('/api/notifications');
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
    
    // Always navigate using SPA without page refresh
    const url = n?.url || '/supervisor';
    navigate(url);
  }

  function closeNotificationModal() {
    setNotificationModalState({ open: false, notification: null });
    // Modal stays closed without refresh
  }

  async function handleMarkAllAsRead() {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      // Reload notifications to update the list
      const query = notificationFilter === 'ALL' ? '' : `?module=${notificationFilter}`;
      const data = await apiRequest(`/api/notifications${query}`);
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }

  // ...removed openIDPModal and all IDP creation logic. Use navigation to CreateIDPPage.jsx for IDP creation.

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  const sectionCounts = useMemo(() => {
    const counts = { ALL: 0 };
    for (const s of CL_STATUS_SECTIONS) {
      counts[s.key] = (filteredClByStatus?.[s.key] || []).length;
      counts.ALL += counts[s.key];
    }
    return counts;
  }, [filteredClByStatus, CL_STATUS_SECTIONS]);

  // Grouped counts for CL (using filtered data)
  const clActionRequiredCount = useMemo(() => {
    const draft = (filteredClByStatus?.DRAFT || []).length;
    const returned = (filteredClByStatus?.RETURNED || []).length;
    return draft + returned;
  }, [filteredClByStatus]);
  const clInReviewCount = useMemo(() => {
    return (filteredClByStatus?.PENDING_EMPLOYEE?.length || 0)
      + (filteredClByStatus?.PENDING_HR?.length || 0)
      + (filteredClByStatus?.PENDING_MANAGER?.length || 0)
      + (filteredClByStatus?.PENDING_AM?.length || 0);
  }, [filteredClByStatus]);
  const clApprovedCount = useMemo(() => (filteredClByStatus?.APPROVED?.length || 0), [filteredClByStatus]);

  const idpSectionCounts = useMemo(() => {
    const counts = { ALL: 0 };
    for (const s of IDP_STATUS_SECTIONS) {
      counts[s.key] = (filteredIdpByStatus?.[s.key] || []).length;
      counts.ALL += counts[s.key];
    }
    return counts;
  }, [filteredIdpByStatus, IDP_STATUS_SECTIONS]);

  // Grouped counts for IDP (using filtered data)
  const idpActionRequiredCount = useMemo(() => {
    return (filteredIdpByStatus?.RETURNED?.length || 0)
      + (filteredIdpByStatus?.DRAFT?.length || 0)
      + (filteredIdpByStatus?.FOR_COMPLETION?.length || 0);
  }, [filteredIdpByStatus]);
  const idpInReviewCount = useMemo(() => {
    return (filteredIdpByStatus?.PENDING_EMPLOYEE?.length || 0)
      + (filteredIdpByStatus?.PENDING_HR?.length || 0)
      + (filteredIdpByStatus?.PENDING_MANAGER?.length || 0)
      + (filteredIdpByStatus?.PENDING_AM?.length || 0);
  }, [filteredIdpByStatus]);
  const idpApprovedCount = useMemo(() => (filteredIdpByStatus?.CYCLE_COMPLETED?.length || 0), [filteredIdpByStatus]);

  const activeLabel = useMemo(() => {
    if (activeSection === 'ALL') return 'All Competency Levelings';
    const s = CL_STATUS_SECTIONS.find((x) => x.key === activeSection);
    return s ? s.label : 'All Competency Levelings';
  }, [activeSection, CL_STATUS_SECTIONS]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT SIDEBAR */}
      <aside className="w-72 bg-blue-900 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-blue-800">
          <h2 className="text-xl font-semibold text-white">FUTURA</h2>
          <p className="text-sm text-blue-100">{user.role}</p>
        </div>

        <nav className="p-4 space-y-4 overflow-y-auto">
          {/* Competency Leveling */}
          <div className="space-y-1">
            <button
              onClick={() => setActivePage('CL')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded transition
                ${activePage === 'CL' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
            >
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-white" />
              <span>Competency Leveling</span>
            </button>

            <div className="pr-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200 mb-2 px-3">
                CL Sections
              </p>
              <button
                type="button"
                onClick={() => { setActivePage('CL'); setActiveSection('ALL'); }}
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
                    <button
                      type="button"
                      onClick={() => { setActivePage('CL'); setActiveSection('DRAFT'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'DRAFT' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2">
                        <PencilSquareIcon className="w-4 h-4" />
                        Returned for Review
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.DRAFT || 0}</span>
                    </button>
                    {clByStatus?.RETURNED && (
                      <button
                        type="button"
                        onClick={() => { setActivePage('CL'); setActiveSection('RETURNED'); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'RETURNED' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                      >
                        <span className="flex items-center gap-2"><PencilSquareIcon className="w-4 h-4" />Returned</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{(clByStatus.RETURNED || []).length}</span>
                      </button>
                    )}
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
                    <button
                      type="button"
                      onClick={() => { setActivePage('CL'); setActiveSection('PENDING_EMPLOYEE'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'PENDING_EMPLOYEE' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><UserIcon className="w-4 h-4" />For Approval by Employee</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.PENDING_EMPLOYEE || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActivePage('CL'); setActiveSection('PENDING_HR'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'PENDING_HR' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><BriefcaseIcon className="w-4 h-4" />For Approval by HR</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.PENDING_HR || 0}</span>
                    </button>
                    {department?.has_am ? (
                      <button
                        type="button"
                        onClick={() => { setActivePage('CL'); setActiveSection('PENDING_AM'); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'PENDING_AM' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                      >
                        <span className="flex items-center gap-2"><ClockIcon className="w-4 h-4" />For Approval by Assistant Manager</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.PENDING_AM || 0}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => { setActivePage('CL'); setActiveSection('PENDING_MANAGER'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'PENDING_MANAGER' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><ClockIcon className="w-4 h-4" />For Approval by Manager</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.PENDING_MANAGER || 0}</span>
                    </button>
                  </div>
                )}

                {/* Approved */}
                <button
                  type="button"
                  onClick={() => { setActivePage('CL'); setActiveSection('APPROVED'); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'APPROVED' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" />Approved</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{clApprovedCount}</span>
                </button>
              </div>
              <button
                onClick={() => goTo('/cl/start')}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded
                           text-xs text-blue-900 bg-blue-100 hover:bg-blue-200 transition"
              >
                <span>➤ Start Competency Leveling</span>
              </button>
            </div>
          </div>

          {/* IDP */}
          <div className="space-y-1 mt-6">
            <button
              onClick={() => setActivePage('IDP')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded transition
                ${activePage === 'IDP' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
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
                onClick={() => { setActivePage('IDP'); setActiveIDPSection('ALL'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                  ${activeIDPSection === 'ALL' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
              >
                <span className="flex items-center gap-2">
                  <Squares2X2Icon className="w-4 h-4" />
                  All
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">
                  {idpSectionCounts.ALL || 0}
                </span>
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
                    <button
                      type="button"
                      onClick={() => { setActivePage('IDP'); setActiveIDPSection('DRAFT'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeIDPSection === 'DRAFT' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><PencilSquareIcon className="w-4 h-4" />Drafts</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.DRAFT || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActivePage('IDP'); setActiveIDPSection('RETURNED'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeIDPSection === 'RETURNED' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><PencilSquareIcon className="w-4 h-4" />Returned for Review</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.RETURNED || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActivePage('IDP'); setActiveIDPSection('FOR_COMPLETION'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeIDPSection === 'FOR_COMPLETION' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><ClockIcon className="w-4 h-4" />For Completion</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.FOR_COMPLETION || 0}</span>
                    </button>
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
                    <button
                      type="button"
                      onClick={() => { setActivePage('IDP'); setActiveIDPSection('PENDING_EMPLOYEE'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeIDPSection === 'PENDING_EMPLOYEE' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><UserIcon className="w-4 h-4" />For Approval by Employee</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.PENDING_EMPLOYEE || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActivePage('IDP'); setActiveIDPSection('PENDING_HR'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeIDPSection === 'PENDING_HR' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><BriefcaseIcon className="w-4 h-4" />For Approval by HR</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.PENDING_HR || 0}</span>
                    </button>
                    {department?.has_am ? (
                      <button
                        type="button"
                        onClick={() => { setActivePage('IDP'); setActiveIDPSection('PENDING_AM'); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeIDPSection === 'PENDING_AM' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                      >
                        <span className="flex items-center gap-2"><ClockIcon className="w-4 h-4" />For Approval by Assistant Manager</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.PENDING_AM || 0}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => { setActivePage('IDP'); setActiveIDPSection('PENDING_MANAGER'); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeIDPSection === 'PENDING_MANAGER' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><ClockIcon className="w-4 h-4" />For Approval by Manager</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.PENDING_MANAGER || 0}</span>
                    </button>
                  </div>
                )}

                {/* Approved / Cycle Completed */}
                <button
                  type="button"
                  onClick={() => { setActivePage('IDP'); setActiveIDPSection('CYCLE_COMPLETED'); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeIDPSection === 'CYCLE_COMPLETED' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" />Cycle Completed</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpApprovedCount}</span>
                </button>
              </div>
              <button
                onClick={() => goTo('/idp/start')}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded
                           text-xs text-blue-900 bg-blue-100 hover:bg-blue-200 transition"
              >
                <span>➤ Start IDP</span>
              </button>
            </div>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {activePage === 'CL' ? 'Competency Levelling' : 'IDP Leveling'}
            </h1>
            <p className="text-gray-600">
              Welcome, {user.name} ({user.employee_id})
            </p>
          </div>

          <div className="flex items-center gap-4">
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
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Employee Filter */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by Employee:</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Employees</option>
              {allEmployees.map((emp) => (
                <option key={emp.id} value={emp.employee_id || emp.employee_code || emp.id}>
                  {emp.name} ({emp.employee_id || emp.employee_code})
                </option>
              ))}
            </select>
            {selectedEmployee !== 'ALL' && (
              <button
                onClick={() => setSelectedEmployee('ALL')}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border"
              >
                Clear Filter
              </button>
            )}
          </div>
          {selectedEmployee !== 'ALL' && (
            <div className="mt-2 text-xs text-blue-600">
              Showing data for: {allEmployees.find(emp => 
                String(emp.employee_id) === String(selectedEmployee) || 
                String(emp.employee_code) === String(selectedEmployee) || 
                String(emp.id) === String(selectedEmployee)
              )?.name || selectedEmployee}
            </div>
          )}
        </div>

        {error && <div className="text-red-600 mb-4">{error}</div>}
        
        {activePage === 'CL' && (
          <SupervisorCL
            loading={loading}
            summary={filteredSummary}
            activeLabel={activeLabel}
            activeSection={activeSection}
            CL_STATUS_SECTIONS={CL_STATUS_SECTIONS}
            sectionCounts={sectionCounts}
            clByStatus={filteredClByStatus}
            handleDeleteCL={handleDeleteCL}
            goTo={goTo}
            setActiveSection={setActiveSection}
          />
        )}

        {activePage === 'IDP' && (
          <SupervisorIDP
            idpSummary={filteredIdpSummary}
            idpEmployees={filteredIdpEmployees}
            idpByStatus={filteredIdpByStatus}
            activeIDPSection={activeIDPSection}
            setActiveIDPSection={setActiveIDPSection}
            IDP_STATUS_SECTIONS={IDP_STATUS_SECTIONS}
            refreshIDPs={loadDashboard}
          />
        )}
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="w-72 bg-white border-l border-gray-200 flex flex-col">
        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <button
            onClick={() => setShowFullNotifications(true)}
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

          {/* Filter controls for Notifications */}
          <div className="px-4 py-2 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              {['ALL','CL','IDP'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setNotificationFilter(opt)}
                  className={`px-2 py-1 rounded text-xs border transition ${
                    notificationFilter === opt
                      ? 'bg-orange-50 border-orange-300 text-orange-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition text-center"
              >
                Mark All as Read ({unreadCount})
              </button>
            )}
          </div>

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
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                      isUnread ? 'bg-orange-50 hover:bg-orange-100' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {n.module && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">{n.module}</span>
                      )}
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


        <div className="border-t border-gray-200" />

        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <button
            onClick={() => setShowFullRecentActions(true)}
            className="p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Recent Actions</span>
              <ArrowsPointingOutIcon className="w-4 h-4 text-gray-400" />
            </div>
            {recentActions.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white">
                {recentActions.length}
              </span>
            )}
          </button>

          {/* Filter controls for Recent Actions */}
          <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-200">
            {['ALL','CL','IDP'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRecentFilter(opt)}
                className={`px-2 py-1 rounded text-xs border transition ${
                  recentFilter === opt
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <div className="flex-1 p-2 overflow-y-auto no-scrollbar">
            {recentActions.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-2">No recent actions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-semibold text-gray-600">Action</th>
                      <th className="px-2 py-1 text-left font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActions.slice(0, 10).map((a, idx) => (
                      <tr
                        key={`${a.id}-${idx}`}
                        onClick={() => handleRecentActionClick(a)}
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-2 py-2">
                          <p className="font-medium text-gray-800 truncate">{a.title || 'Action'}</p>
                          <div className="flex items-center gap-2 text-[11px] text-gray-600">
                            {a.module && (
                              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">{a.module}</span>
                            )}
                            {a.description && (
                              <span className="truncate">{a.description}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-gray-500 whitespace-nowrap">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

      {/* IDP Creation Modal removed. All IDP creation is now handled in CreateIDPPage.jsx */}

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
        onClose={() => setShowFullNotifications(false)}
      />
    </div>
  );
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

function CLTable({ data, goTo, onDelete }) {
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
            <Th>Status</Th>
            <Th>Final Score</Th>
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
              <Td>
                {item.status === 'PENDING_AM' ? 'For Assistant Manager Review' :
                 item.status === 'PENDING_MANAGER' ? 'For Manager Approval' :
                 item.status === 'PENDING_HR' ? 'For HR Approval' :
                 item.status === 'PENDING_EMPLOYEE' ? 'For Employee Approval' :
                 item.status === 'PENDING_SUPERVISOR' ? 'For Supervisor Approval' :
                 item.status === 'APPROVED' ? 'Approved' :
                 item.status === 'CYCLE_COMPLETED' ? 'Cycle Completed' :
                 item.status === 'RETURNED' ? 'Returned for Review' :
                 item.status === 'REJECTED' ? 'Rejected' :
                 item.status === 'FOR_COMPLETION' ? 'For Completion' :
                 item.status === 'DRAFT' ? 'Draft - Not Submitted' :
                 item.status}
              </Td>
              <Td>{item.total_score != null ? item.total_score : '-'}</Td>
              <Td>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '-'}</Td>

              <Td>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => goTo(`/cl/supervisor/review/${item.id}`)}
                    className="px-3 py-1 rounded text-white text-xs
                               bg-gradient-to-r from-blue-500 to-blue-700
                               hover:from-blue-600 hover:to-blue-800"
                  >
                    Review
                  </button>

                  <button
                    onClick={() => onDelete(item.id)}
                    className="px-3 py-1 rounded text-white text-xs
                               bg-gradient-to-r from-red-500 to-red-700
                               hover:from-red-600 hover:to-red-800"
                  >
                    Delete
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
          <button
            type="button"
            onClick={onProceed}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Go to Form
          </button>
        </div>
      </div>
    </div>
  );
}

function FullRecentActionsModal({ open, recentActions, onActionClick, onClose }) {
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Filter actions by date range and search term (before any conditional logic)
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

  // Auto-reset page when filters change using derived state
  const currentValidPage = useMemo(() => {
    const total = Math.max(1, Math.ceil(filteredActions.length / PAGE_SIZE));
    if (page > total) return total;
    if (page < 1) return 1;
    return page;
  }, [filteredActions, page]);

  // Update page state only when necessary to prevent infinite loops
  useEffect(() => {
    if (currentValidPage !== page) {
      const timer = setTimeout(() => setPage(currentValidPage), 0);
      return () => clearTimeout(timer);
    }
  }, [currentValidPage, page]);

  if (!open) return null;

  const visibleActions = filteredActions.slice((currentValidPage - 1) * PAGE_SIZE, currentValidPage * PAGE_SIZE);

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
                  {visibleActions.map((a, idx) => (
                    <tr
                      key={`${a.id}-${idx}`}
                      onClick={() => {
                        onActionClick(a);
                        if (!a.title || !a.title.toLowerCase().includes('deleted')) {
                          onClose();
                        }
                      }}
                      className="hover:bg-gray-50 cursor-pointer"
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-600">
                  Page {page} of {Math.max(1, Math.ceil(filteredActions.length / PAGE_SIZE))}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className={`px-3 py-1.5 rounded text-xs border transition ${page <= 1 ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => {
                      const total = Math.max(1, Math.ceil(filteredActions.length / PAGE_SIZE));
                      return Math.min(total, p + 1);
                    })}
                    disabled={page >= Math.max(1, Math.ceil(filteredActions.length / PAGE_SIZE))}
                    className={`px-3 py-1.5 rounded text-xs border transition ${page >= Math.max(1, Math.ceil(filteredActions.length / PAGE_SIZE)) ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FullNotificationsModal({ open, notifications, onNotificationClick, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-800">All Notifications</h3>
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

export default SupervisorDashboard;
