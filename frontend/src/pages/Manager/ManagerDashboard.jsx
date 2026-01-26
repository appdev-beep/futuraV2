// src/pages/Manager/ManagerDashboard.jsx
import { useEffect, useMemo, useState, Fragment } from 'react';
import { apiRequest } from '../../api/client';
import { displayStatus } from '../../utils/statusHelper';
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  ArrowsPointingOutIcon,
  Squares2X2Icon,
  ClockIcon,
  PencilSquareIcon,
  BookOpenIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  ListBulletIcon,
  InformationCircleIcon,
  ArrowLeftIcon,
  UserIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  COMPLETION_STATUS_OPTIONS,
  DEVELOPMENT_TYPES,
  CRAYON_COLORS,
  SCORING_GUIDE,
} from '../Shared/idpConstants';

// Only these roles can access Manager dashboard
const MANAGER_ROLES = ['Manager', 'HR', 'Admin'];

// IDPTable Component for rendering IDP lists
function IDPTable({ data, openIdpView }) {
  return (
    <div className="bg-white shadow-sm rounded overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-50 text-sm">
        <thead className="bg-white">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IDP No.</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Employee</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Supervisor</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created At</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-50">
          {data.map((idp) => (
            <tr key={idp.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-semibold text-purple-600">#{idp.id}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="font-medium text-gray-700">{idp.employee_name}</div>
                <div className="text-xs text-gray-400">{idp.employee_position}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-600">{idp.supervisor_name}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  idp.status === 'CYCLE_COMPLETED'
                    ? 'bg-green-100 text-green-800'
                    : idp.status === 'PENDING_MANAGER' || idp.status === 'PENDING_AM'
                    ? 'bg-yellow-100 text-yellow-800'
                    : idp.status === 'PENDING_HR'
                    ? 'bg-blue-100 text-blue-800'
                    : idp.status === 'FOR_COMPLETION'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {displayStatus(idp.status)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                {new Date(idp.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <button
                  onClick={() => openIdpView(idp)}
                  className="text-purple-600 hover:text-purple-800 font-medium"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}




// Dynamically build CL status sections based on department.has_am
const getCLStatusSections = (department) => {
  const sections = [
    { key: 'pending', label: 'For Approval by Manager', icon: ClockIcon },
    { key: 'returned', label: 'Returned to Supervisor', icon: PencilSquareIcon },
    { key: 'approved', label: 'Approved by Manager', icon: CheckCircleIcon },
    { key: 'department', label: 'Department CL Tracking', icon: Squares2X2Icon },
  ];
  if (department && department.has_am) {
    // Insert AM section before Manager
    sections.splice(1, 0, { key: 'pending_am', label: 'For Approval by Assistant Manager', icon: ClockIcon });
  }
  return sections;
};

function ManagerDashboard({ isAMDashboard = false } = {}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState({
    clPending: 0,
    clInProgress: 0,
    clApproved: 0,
    clReturned: 0,
  });

  const [pendingCL, setPendingCL] = useState([]);
  const [allCL, setAllCL] = useState([]);
  const [departmentCLs, setDepartmentCLs] = useState([]); // All CLs in department for tracking
  const [activeSection, setActiveSection] = useState('pending'); // 'pending', 'approved', 'returned', 'all', 'department', 'employees'
  const [departmentStatusFilter, setDepartmentStatusFilter] = useState('ALL'); // Filter for department tracking
  const [employees, setEmployees] = useState([]); // All employees in department
  const [supervisors, setSupervisors] = useState([]); // All supervisors in department
  const [selectedEmployee, setSelectedEmployee] = useState('ALL');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  // Date search state (restore from Supervisor dashboard)
  const [dateSearch, setDateSearch] = useState({ startDate: '', endDate: '', enabled: false });
  const [showDateSearch, setShowDateSearch] = useState(false);

  const [_expandedSupervisors, _setExpandedSupervisors] = useState({}); // Track which supervisors are expanded
  const [selectedSupervisorId, _setSelectedSupervisorId] = useState(null); // Selected supervisor to view employees
  const [_searchQuery, _setSearchQuery] = useState(''); // Search for employees
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [hasCompetenciesOnly, setHasCompetenciesOnly] = useState(false); // Filter: only employees with competencies
  // ✅ NEW: notifications + recent actions (right sidebar)
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  const [notificationFilter, setNotificationFilter] = useState('ALL'); // 'ALL', 'CL', 'IDP'
  const [recentFilter, setRecentFilter] = useState('ALL'); // 'ALL', 'CL', 'IDP'

  const [notificationModalState, setNotificationModalState] = useState({
    open: false,
    notification: null,
  });

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [employeeInputFocused, setEmployeeInputFocused] = useState(false);
  const [showEmployeeSuggestions, setShowEmployeeSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // Export modal/state for CSV export (used by header Export CSV)
  const [exportModal, setExportModal] = useState({ open: false, loading: false, startDate: '', endDate: '', module: 'CL', selectedStatus: 'ALL', employee: 'ALL' });

  const [showFullNotifications, setShowFullNotifications] = useState(false);
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);

  // Supervisor sidebar state
  const [showClAction, setShowClAction] = useState(false);
  const [_showClInReview, _setShowClInReview] = useState(false);
  const [showIdpAction, setShowIdpAction] = useState(false);
  const [showIdpInReview, setShowIdpInReview] = useState(false);

  // Department info for dynamic AM section
  const [department, setDepartment] = useState(null);
  // Fetch department info for the user
  useEffect(() => {
    if (!user) return;
    async function fetchDepartment() {
      try {
        const departments = await apiRequest('/api/lookup/departments');
        const dept = departments.find((d) => d.id === user.department_id);
        setDepartment(dept || null);
      } catch {
        setDepartment(null);
      }
    }
    fetchDepartment();
  }, [user]);

  // Only these roles can access Manager dashboard
  // If AM dashboard, restrict to AM role

  // ==========================
  // AUTH GUARD & LOAD USER
  // ==========================
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(stored);
    if (isAMDashboard) {
      if (parsed.role !== 'AM') {
        window.location.href = '/';
        return;
      }
    } else {
      if (!MANAGER_ROLES.includes(parsed.role)) {
        window.location.href = '/';
        return;
      }
    }

    setUser(parsed);
  }, [isAMDashboard]);

  // Helper: open IDP view in full page (using CreateIDPPage with viewOnly mode)
  function openIdpView(idp) {
    const path = isAMDashboard ? `/am/idp/${idp.id}` : `/manager/idp/${idp.id}`;
    window.location.href = `${path}?viewOnly=true`;
  }

  function _closeIdpView() {
    // No longer needed - navigation handles closing
  }

  // Helper components for IDP modal
  function TextBox({ value }) {
    return (
      <div className="px-3 py-2 bg-white rounded-lg text-sm font-semibold text-gray-700 border border-gray-200 shadow-sm">
        {value || 'N/A'}
      </div>
    );
  }

  function Field({ label, children }) {
    return (
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-2">{label}</label>
        {children}
      </div>
    );
  }

  function _areaColor(area) {
    const safe = CRAYON_COLORS && typeof CRAYON_COLORS === 'object' ? CRAYON_COLORS : {};
    if (safe[area]) return safe[area];

    const key = String(area || 'Other');
    const palette = [
      { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', dot: 'bg-indigo-400' },
      { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', dot: 'bg-rose-400' },
      { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', dot: 'bg-amber-400' },
      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-400' },
      { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100', dot: 'bg-sky-400' },
    ];
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 100000;
    return palette[hash % palette.length];
  }

  function _getCompetencyCompletionStatus(item) {
    const mainActivities = (item.development_activity && typeof item.development_activity === 'object') 
      ? [item.development_activity] 
      : (item.developmentActivities || []);
    const extraTables = item.extraTables || [];
    const activityType = mainActivities[0]?.type?.toLowerCase();
    
    let totalActivities = 0;
    let completedActivities = 0;
    
    if (activityType === 'education') {
      totalActivities = mainActivities.length;
      completedActivities = mainActivities.filter(a => 
        a.completionStatus === 'Completed' || a.status === 'Completed'
      ).length;
    } else if (activityType === 'experience' || activityType === 'exposure') {
      totalActivities = extraTables.length;
      completedActivities = extraTables.filter(t => 
        t.completionStatus === 'Completed' || t.status === 'Completed'
      ).length;
    } else {
      totalActivities = mainActivities.length;
      completedActivities = mainActivities.filter(a => 
        a.completionStatus === 'Completed' || a.status === 'Completed'
      ).length;
    }
    
    return {
      completed: completedActivities,
      total: totalActivities,
      percentage: totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0,
    };
  }

  function closeNotificationModal() {
    setNotificationModalState({ open: false, notification: null });
  }

  // ==========================
  // LOAD DASHBOARD DATA
  // ==========================
  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      try {
        let clSummary, clPending, clAll, deptCLs;
        if (isAMDashboard) {
          [clSummary, clPending, clAll, deptCLs] = await Promise.all([
            apiRequest('/api/cl/am/summary'),
            apiRequest('/api/cl/am/pending'),
            apiRequest('/api/cl/am/all'),
            apiRequest('/api/cl/am/department'),
          ]);
        } else {
          [clSummary, clPending, clAll, deptCLs] = await Promise.all([
            apiRequest('/api/cl/manager/summary'),
            apiRequest('/api/cl/manager/pending'),
            apiRequest('/api/cl/manager/all'),
            apiRequest('/api/cl/manager/department'),
          ]);
        }

        setSummary({
          clPending: clSummary.clPending || 0,
          clInProgress: clSummary.clInProgress || 0,
          clApproved: clSummary.clApproved || 0,
          clReturned: clSummary.clReturned || 0,
        });

        setPendingCL(clPending || []);
        setAllCL(clAll || []);
        setDepartmentCLs(deptCLs || []);

        // Fetch users and filter by assignment to avoid calling non-existent assigned endpoints
        let deptEmployees = [];
        try {
          const allUsers = await apiRequest('/api/users');
          // Get supervisors in the department
          const deptSupervisors = (allUsers || []).filter(
            u => u.department_id === user.department_id && u.role === 'Supervisor'
          );
          setSupervisors(deptSupervisors);

          // For AM/Manager dashboards, prefer users explicitly assigned to the current AM/Manager
          if (isAMDashboard) {
            deptEmployees = (allUsers || []).filter(u => String(u.am_id) === String(user.id));
            if (!deptEmployees || deptEmployees.length === 0) {
              deptEmployees = (allUsers || []).filter(
                u => u.department_id === user.department_id && u.role === 'Employee'
              );
            }
          } else {
            deptEmployees = (allUsers || []).filter(u => String(u.manager_id) === String(user.id));
            if (!deptEmployees || deptEmployees.length === 0) {
              deptEmployees = (allUsers || []).filter(
                u => u.department_id === user.department_id && u.role === 'Employee'
              );
            }
          }
        } catch {
          deptEmployees = [];
        }

        // Ensure deptEmployees only contains employees assigned to this AM/Manager
        if (isAMDashboard) {
          deptEmployees = (deptEmployees || []).filter(u => String(u.am_id) === String(user.id));
        } else {
          deptEmployees = (deptEmployees || []).filter(u => String(u.manager_id) === String(user.id));
        }

        // Enrich with competency data (preserve previous enrichment behavior)
        const enriched = await Promise.all(
          (deptEmployees || []).map(async (emp) => {
            try {
              const resp = await apiRequest(`/api/cl/employee/${emp.id}/competencies`);
              const competencyCount = (resp?.competencies || []).length;

              const histResp = await apiRequest(`/api/cl/employee/${emp.id}/history`);
              const histArr = Array.isArray(histResp) ? histResp : (histResp?.history || []);
              const historyCount = histArr.length;
              const latestCL = histArr.length > 0 ? histArr[0] : null;

              return {
                ...emp,
                competencyCount,
                historyCount,
                latestCL,
              };
            } catch {
              return { ...emp, competencyCount: 0, historyCount: 0, latestCL: null };
            }
          })
        );

        setEmployees(enriched);
        // Ensure we have a user list for mapping supervisor IDs to names
        let allUsers = [];
        try {
          allUsers = await apiRequest('/api/users');
        } catch {
          // ignore - mapping will fallback to ids
          allUsers = [];
        }
        const userMap = {};
        (allUsers || []).forEach(u => {
          const display = u.name || u.full_name || ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.employee_id || u.id;
          userMap[u.id] = display;
        });

        const mapCLsToNames = (arr) => (arr || []).map(item => ({
          ...item,
          supervisor_name: item.supervisor_name || item.supervisor || userMap[item.supervisor_id] || ''
        }));

        setPendingCL(mapCLsToNames(clPending || []));
        setAllCL(mapCLsToNames(clAll || []));
        setDepartmentCLs(mapCLsToNames(deptCLs || []));
      } catch (err) {
        console.error(err);
        setError(isAMDashboard ? 'Failed to load Assistant Manager dashboard data.' : 'Failed to load Manager dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user, isAMDashboard]);

  // ==========================
  // LOAD NOTIFICATIONS (polling)
  // ==========================
  useEffect(() => {
    if (!user) return;

    let timer;

    async function loadNotifications() {
      try {
        const endpoint = notificationFilter === 'ALL'
          ? '/api/notifications'
          : `/api/notifications?module=${notificationFilter}`;
        const data = await apiRequest(endpoint);
        setNotifications(data || []);
      } catch (err) {
        console.error('Failed to load notifications', err);
      }
    }

    loadNotifications();
    timer = setInterval(loadNotifications, 15000);

    return () => clearInterval(timer);
  }, [user, notificationFilter]);

  // ==========================
  // LOAD RECENT ACTIONS
  // ==========================
  useEffect(() => {
    if (!user) return;

    async function loadRecentActions() {
      try {
        const endpoint = recentFilter === 'ALL'
          ? '/api/recent-actions'
          : `/api/recent-actions?module=${recentFilter}`;
        const data = await apiRequest(endpoint);
        setRecentActions(data || []);
      } catch (err) {
        console.error('Failed to load recent actions', err);
      }
    }

    loadRecentActions();
  }, [user, recentFilter]);

  // ==========================
  // HELPERS
  // ==========================
  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  function goTo(url) {
    // For AM dashboard, rewrite review links to AM review page
    if (isAMDashboard && url.startsWith('/cl/submissions/')) {
      const id = url.split('/').pop();
      url = `/cl/am/review/${id}`;
    }
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    // If already on the target page, just reload data instead of full refresh
    if (currentPath === targetPath) {
      window.location.reload();
      return;
    }
    window.location.href = url;
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
    const url = action.url || '/manager';
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    
    if (currentPath === targetPath) {
      // Just close modal and stay on current page
      return;
    }
    
    // Navigate to different page
    const separator = url.includes('?') ? '&' : '?';
    window.location.href = `${url}${separator}viewOnly=true`;
  }

  // Date search helpers (copied from Supervisor behavior)
  function clearDateSearch() {
    setDateSearch({ startDate: '', endDate: '', enabled: false });
    setShowDateSearch(false);
  }

  function applyDateSearch() {
    if (dateSearch.startDate || dateSearch.endDate) {
      setDateSearch(prev => ({ ...prev, enabled: true }));
    }
  }

  function openExportModal() {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setExportModal({ open: true, loading: false, startDate: thirtyDaysAgo, endDate: today, module: 'CL', selectedStatus: 'ALL', employee: selectedEmployee });
  }

  function closeExportModal() {
    setExportModal({ open: false, loading: false, startDate: '', endDate: '', module: 'CL', selectedStatus: 'ALL', employee: 'ALL' });
  }

  async function handleExportCSV() {
    const { startDate, endDate, module, selectedStatus, employee } = exportModal;
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
      const queryParams = new URLSearchParams({ startDate, endDate });
      if (selectedStatus !== 'ALL') queryParams.set('status', selectedStatus);
      if (employee !== 'ALL') queryParams.set('employee_id', employee);

      // Choose endpoint depending on AM vs Manager
      const _endpointBase = isAMDashboard ? '/api' : '/api';
      const endpoint = module === 'CL'
        ? (isAMDashboard ? '/api/cl/am/export' : '/api/cl/manager/export')
        : (isAMDashboard ? '/api/idp/am/export' : '/api/idp/manager/export');

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        let errorMessage = 'Export failed';
        try { const error = await response.json(); errorMessage = error.message || errorMessage; } catch { /* ignore */ }
        throw new Error(errorMessage);
      }

      const csvData = await response.text();
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const employeeLabel = employee !== 'ALL'
        ? (employees.find(emp => String(emp.employee_id) === String(employee) || String(emp.employee_code) === String(employee) || String(emp.id) === String(employee))?.name || 'Employee')
        : 'AllEmployees';
      a.download = `${module}_Export_${employeeLabel}_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      closeExportModal();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error.message || error));
    } finally {
      setExportModal(prev => ({ ...prev, loading: false }));
    }
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
    const url = n?.url || '/manager';
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    
    if (currentPath === targetPath) {
      // Stay on current page without refresh
      return;
    }
    
    // Navigate to different page
    window.location.href = url;
  }

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  // Apply selected supervisor / employee / search / date filters to a flat CL list
  const applyCLFilters = (items) => {
    let results = items || [];
    // Filter by supervisor if selected
    if (selectedSupervisorId) {
      results = results.filter(item => {
        if (item.supervisor_id === selectedSupervisorId) return true;
        const emp = employees.find(e => e.id === item.employee_id);
        return emp && emp.supervisor_id === selectedSupervisorId;
      });
    }

    // Helper to compare item -> employee identity across possible fields
    const matchesEmployee = (item, val) => {
      if (!val && val !== 0) return false;
      const v = String(val).toLowerCase();
      return (String(item.employee_id || '').toLowerCase() === v)
        || (String(item.employee_code || '').toLowerCase() === v)
        || (String(item.employee?.id || '').toLowerCase() === v);
    };

    // Employee filter: selectedEmployee overrides search
    if (selectedEmployee && selectedEmployee !== 'ALL') {
      results = results.filter(item => matchesEmployee(item, selectedEmployee));
    } else if (employeeSearchTerm && employeeSearchTerm.trim()) {
      const search = employeeSearchTerm.toLowerCase().trim();
      const emp = employees.find(emp => ((emp.name || '').toLowerCase().includes(search) || (emp.employee_id || '').toLowerCase().includes(search) || (emp.employee_code || '').toLowerCase().includes(search)));
      if (emp) {
        // match by any identifier (id, employee_id, employee_code)
        const keys = [String(emp.id), String(emp.employee_id || ''), String(emp.employee_code || '')];
        results = results.filter(item => keys.some(k => matchesEmployee(item, k)));
      } else {
        results = results.filter(item => (item.employee_name || '').toLowerCase().includes(search) || String(item.employee_id || '').toLowerCase().includes(search) || String(item.employee_code || '').toLowerCase().includes(search));
      }
    }

    // Apply date filtering if enabled
    if (dateSearch && dateSearch.enabled && (dateSearch.startDate || dateSearch.endDate)) {
      const startDate = dateSearch.startDate ? new Date(dateSearch.startDate) : null;
      const endDate = dateSearch.endDate ? new Date(dateSearch.endDate + 'T23:59:59') : null;
      results = results.filter(item => {
        const itemDate = new Date(item.created_at || item.submitted_at || item.updated_at || Date.now());
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    return results;
  };

  const filteredPendingCL = applyCLFilters(pendingCL);
  const approvedCLs = applyCLFilters(allCL.filter(item => item.manager_decision === 'APPROVED'));
  // Only show returned CLs that are still in DRAFT status (not yet resubmitted)
  const returnedCLs = applyCLFilters(allCL.filter(item => item.manager_decision === 'RETURNED' && item.status === 'DRAFT'));

  // Filter department CLs by status and supervisor (if selected)
  const filteredDepartmentCLs = useMemo(() => {
    // Apply same employee + supervisor + date filters as other CL lists, then filter by department status
    let items = applyCLFilters(departmentCLs || []);
    if (departmentStatusFilter === 'ALL') return items;
    return items.filter(item => item.status === departmentStatusFilter);
  }, [departmentCLs, departmentStatusFilter, selectedSupervisorId, selectedEmployee, employeeSearchTerm, employees, dateSearch, applyCLFilters]);

  const sectionCounts = useMemo(() => {
    return {
      pending: filteredPendingCL.length,
      approved: approvedCLs.length,
      returned: returnedCLs.length,
      department: filteredDepartmentCLs.length,
      all: filteredPendingCL.length + approvedCLs.length + returnedCLs.length,
    };
  }, [filteredPendingCL, approvedCLs, returnedCLs, filteredDepartmentCLs]);


  // Dynamically build CL status sections based on department
  const CL_STATUS_SECTIONS = useMemo(() => {
    return getCLStatusSections(department);
  }, [department]);

  const activeSectionLabel = useMemo(() => {
    const supervisor = supervisors.find(s => s.id === selectedSupervisorId);
    const supervisorSuffix = supervisor ? ` (${supervisor.name})` : '';
    if (activeSection === 'all') return `All Competency Levelings${supervisorSuffix}`;
    if (activeSection === 'idp_all') return `All IDPs${supervisorSuffix}`;
    if (activeSection === 'idp_pending_am') return `For Approval by AM${supervisorSuffix}`;
    if (activeSection === 'idp_pending_manager') return `For Approval by Manager${supervisorSuffix}`;
    if (activeSection === 'idp_pending_hr') return `For Approval by HR${supervisorSuffix}`;
    if (activeSection === 'idp_for_completion') return `For Completion${supervisorSuffix}`;
    if (activeSection === 'idp_approved') return isAMDashboard ? `Assistant Manager Approved IDPs${supervisorSuffix}` : `Manager Approved IDPs${supervisorSuffix}`;
    if (activeSection === 'idp_cycle_completed') return `Cycle Completed IDPs${supervisorSuffix}`;
    // AM-specific overrides for CL labels
    if (isAMDashboard) {
      if (activeSection === 'pending') return `For Approval by Assistant Manager${supervisorSuffix}`;
      if (activeSection === 'approved') return `Approved by Assistant Manager${supervisorSuffix}`;
    }
    const section = CL_STATUS_SECTIONS.find(s => s.key === activeSection);
    if (section) return `${section.label}${supervisorSuffix}`;
    return `Competency Levelings${supervisorSuffix}`;
  }, [activeSection, CL_STATUS_SECTIONS, isAMDashboard, selectedSupervisorId, supervisors]);

  // Fetch pending IDPs for manager
  const [pendingIDPs, setPendingIDPs] = useState([]);
  useEffect(() => {
    if (!user) return;
    async function fetchPendingIDPs() {
      try {
        // Fetch grouped IDPs for the manager so we can display approved/completed items
        const endpoint = isAMDashboard ? '/api/idp/am/pending' : '/api/idp/manager/grouped';
        const grouped = await apiRequest(endpoint);
        // Flatten grouped object into an array for existing UI consumers
        const all = grouped ? Object.values(grouped).flat() : [];
        setPendingIDPs(all || []);
      } catch (err) {
        console.error('Error fetching manager IDPs grouped:', err);
      }
    }
    fetchPendingIDPs();
  }, [user, isAMDashboard]);

  // IDP status mapping - use pending IDPs as source
  const idpByStatus = useMemo(() => {
    return {
      pending_am: (pendingIDPs || []).filter(i => i.status === 'PENDING_AM'),
      pending_manager: (pendingIDPs || []).filter(i => i.status === 'PENDING_MANAGER'),
      pending_hr: (pendingIDPs || []).filter(i => i.status === 'PENDING_HR'),
      for_completion: (pendingIDPs || []).filter(i => i.status === 'FOR_COMPLETION'),
      // pending employee acknowledgement (manager-approved)
      pending_employee: (pendingIDPs || []).filter(i => i.status === 'PENDING_EMPLOYEE'),
      // alias for UI section 'Approved' (manager-approved items pending employee ack)
      approved: (pendingIDPs || []).filter(i => i.status === 'PENDING_EMPLOYEE'),
      // final cycle completed
      cycle_completed: (pendingIDPs || []).filter(i => i.status === 'CYCLE_COMPLETED'),
    };
  }, [pendingIDPs]);

  // Filter IDPs by selected supervisor
  const filteredIDPsByStatus = useMemo(() => {
    const base = Object.keys(idpByStatus).reduce((acc, key) => {
      acc[key] = (idpByStatus[key] || []).slice();
      return acc;
    }, {});

    // Apply supervisor filter if present
    if (selectedSupervisorId) {
      for (const k of Object.keys(base)) {
        base[k] = base[k].filter(i => i.supervisor_id === selectedSupervisorId);
      }
    }

    // Apply employee filtering (selectedEmployee or search term)
    const applyEmployeeFilter = (items) => {
      let results = items;
      const matchesEmployee = (item, val) => {
        if (!val && val !== 0) return false;
        const v = String(val).toLowerCase();
        return (String(item.employee_id || '').toLowerCase() === v)
          || (String(item.employee_code || '').toLowerCase() === v)
          || (String(item.employee?.id || '').toLowerCase() === v);
      };

      if (selectedEmployee && selectedEmployee !== 'ALL') {
        return results.filter(item => matchesEmployee(item, selectedEmployee));
      }
      if (employeeSearchTerm && employeeSearchTerm.trim()) {
        const search = employeeSearchTerm.toLowerCase().trim();
        const emp = employees.find(emp => ((emp.name || '').toLowerCase().includes(search) || (emp.employee_id || '').toLowerCase().includes(search) || (emp.employee_code || '').toLowerCase().includes(search)));
        if (emp) {
          const keys = [String(emp.id), String(emp.employee_id || ''), String(emp.employee_code || '')];
          return results.filter(item => keys.some(k => matchesEmployee(item, k)));
        }
        return results.filter(item => (item.employee_name || '').toLowerCase().includes(search) || String(item.employee_id || '').toLowerCase().includes(search) || String(item.employee_code || '').toLowerCase().includes(search));
      }
      return results;
    };

    // Apply date filter to a list of items when dateSearch is enabled
    const applyDateFilter = (items) => {
      if (!(dateSearch && dateSearch.enabled && (dateSearch.startDate || dateSearch.endDate))) return items;
      const startDate = dateSearch.startDate ? new Date(dateSearch.startDate) : null;
      const endDate = dateSearch.endDate ? new Date(dateSearch.endDate + 'T23:59:59') : null;
      return (items || []).filter(item => {
        const itemDate = new Date(item.created_at || item.submitted_at || item.updated_at || Date.now());
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    };

    return {
      pending_am: applyDateFilter(applyEmployeeFilter(base.pending_am || [])),
      pending_manager: applyDateFilter(applyEmployeeFilter(base.pending_manager || [])),
      pending_hr: applyDateFilter(applyEmployeeFilter(base.pending_hr || [])),
      for_completion: applyDateFilter(applyEmployeeFilter(base.for_completion || [])),
      pending_employee: applyDateFilter(applyEmployeeFilter(base.pending_employee || [])),
      approved: applyDateFilter(applyEmployeeFilter(base.approved || [])),
      cycle_completed: applyDateFilter(applyEmployeeFilter(base.cycle_completed || [])),
    };
  }, [idpByStatus, selectedSupervisorId, selectedEmployee, employeeSearchTerm, employees, dateSearch]);

  const idpSectionCounts = useMemo(() => {
    return {
      pending_am: filteredIDPsByStatus.pending_am.length,
      pending_manager: filteredIDPsByStatus.pending_manager.length,
      pending_hr: filteredIDPsByStatus.pending_hr.length,
      for_completion: filteredIDPsByStatus.for_completion.length,
      pending_employee: (filteredIDPsByStatus.pending_employee || []).length,
      approved: filteredIDPsByStatus.approved.length,
      cycle_completed: filteredIDPsByStatus.cycle_completed.length,
      all: Object.values(filteredIDPsByStatus).reduce((sum, arr) => sum + (arr ? arr.length : 0), 0),
    };
  }, [filteredIDPsByStatus]);

  const filteredPendingIDPs = useMemo(() => {
    let results = (pendingIDPs || []).slice();

    if (selectedSupervisorId) {
      results = results.filter(idp => idp.supervisor_id === selectedSupervisorId);
    }

    // Employee filter
    const matchesEmployee = (item, val) => {
      if (!val && val !== 0) return false;
      const v = String(val).toLowerCase();
      return (String(item.employee_id || '').toLowerCase() === v)
        || (String(item.employee_code || '').toLowerCase() === v)
        || (String(item.employee?.id || '').toLowerCase() === v);
    };

    if (selectedEmployee && selectedEmployee !== 'ALL') {
      results = results.filter(item => matchesEmployee(item, selectedEmployee));
    } else if (employeeSearchTerm && employeeSearchTerm.trim()) {
      const search = employeeSearchTerm.toLowerCase().trim();
      const emp = employees.find(emp => ((emp.name || '').toLowerCase().includes(search) || (emp.employee_id || '').toLowerCase().includes(search) || (emp.employee_code || '').toLowerCase().includes(search)));
      if (emp) {
        const keys = [String(emp.id), String(emp.employee_id || ''), String(emp.employee_code || '')];
        results = results.filter(item => keys.some(k => matchesEmployee(item, k)));
      } else {
        results = results.filter(item => (item.employee_name || '').toLowerCase().includes(search) || String(item.employee_id || '').toLowerCase().includes(search) || String(item.employee_code || '').toLowerCase().includes(search));
      }
    }

    // Date filter
    if (dateSearch && dateSearch.enabled && (dateSearch.startDate || dateSearch.endDate)) {
      const startDate = dateSearch.startDate ? new Date(dateSearch.startDate) : null;
      const endDate = dateSearch.endDate ? new Date(dateSearch.endDate + 'T23:59:59') : null;
      results = results.filter(item => {
        const itemDate = new Date(item.created_at || item.submitted_at || item.updated_at || Date.now());
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    }

    return results;
  }, [pendingIDPs, selectedSupervisorId, selectedEmployee, employeeSearchTerm, employees, dateSearch]);

  const selectedSupervisor = useMemo(() => {
    return supervisors.find(s => s.id === selectedSupervisorId);
  }, [supervisors, selectedSupervisorId]);

  // Compute employee suggestions for autocomplete (max 8)
  const employeeSuggestions = useMemo(() => {
    if (!employeeSearchTerm || !employeeInputFocused) return [];
    const q = employeeSearchTerm.toLowerCase().trim();
    if (!q) return [];
    return (employees || []).filter(emp => (
      (emp.name || emp.full_name || '').toLowerCase().includes(q) ||
      String(emp.employee_id || '').toLowerCase().includes(q) ||
      String(emp.employee_code || '').toLowerCase().includes(q)
    )).slice(0, 8);
  }, [employeeSearchTerm, employees, employeeInputFocused]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white">
      {/* SIDEBAR */}
      <aside className="w-72 bg-blue-900 border-r border-gray-300 flex flex-col">
        <div className="p-4 border-b border-blue-800">
          <h2 className="text-xl font-semibold text-white">FUTURA</h2>
          <p className="text-sm text-blue-100">{user.role}</p>
          {(isAMDashboard || user.role === 'Manager') && (
            <div className="mt-3">
              <button
                onClick={() => setActiveSection('employees')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded text-blue-100 hover:bg-blue-800 transition"
              >
                <UsersIcon className="w-5 h-5 text-white" />
                <span>My Employees</span>
              </button>
            </div>
          )}
        </div>

        <nav className="p-4 space-y-4 overflow-y-auto">
          {/* Competency Leveling */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveSection('all')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded transition
                ${activeSection.startsWith('all') || activeSection.startsWith('pending') ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
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
                onClick={() => setActiveSection('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                  ${activeSection === 'all' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
              >
                <span className="flex items-center gap-2">
                  <Squares2X2Icon className="w-4 h-4" />
                  All
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">
                  {sectionCounts.all || 0}
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
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.pending || 0}</span>
                </button>
                {showClAction && (
                  <div className="ml-6 space-y-1">
                    <button
                      type="button"
                      onClick={() => setActiveSection('pending')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'pending' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4" />
                        {isAMDashboard ? 'For Approval by Assistant Manager' : 'For Approval by Manager'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.pending || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('returned')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'returned' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><PencilSquareIcon className="w-4 h-4" />Returned for Review</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.returned || 0}</span>
                    </button>
                  </div>
                )}

                {/* Grouped: Approved */}
                <button
                  type="button"
                  onClick={() => setActiveSection('approved')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'approved' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" />Approved</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.approved || 0}</span>
                </button>

                {/* Department Tracking */}
                <button
                  type="button"
                  onClick={() => setActiveSection('department')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'department' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2"><Squares2X2Icon className="w-4 h-4" />Department CL Tracking</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{sectionCounts.department || 0}</span>
                </button>
              </div>
            </div>
          </div>

          {/* IDP */}
          <div className="space-y-1 mt-6">
            <button
              onClick={() => setActiveSection('idp_all')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded transition
                ${activeSection.startsWith('idp') ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
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
                onClick={() => setActiveSection('idp_all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                  ${activeSection === 'idp_all' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
              >
                <span className="flex items-center gap-2">
                  <Squares2X2Icon className="w-4 h-4" />
                  All IDPs
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">
                  {idpSectionCounts.all || 0}
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
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{isAMDashboard ? (idpSectionCounts.pending_am || 0) : (idpSectionCounts.pending_manager || 0)}</span>
                </button>
                  {showIdpAction && (
                    <div className="ml-6 space-y-1">
                      {isAMDashboard ? (
                        <Fragment>
                          <button
                            type="button"
                            onClick={() => setActiveSection('idp_pending_am')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'idp_pending_am' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                          >
                            <span className="flex items-center gap-2"><ClockIcon className="w-4 h-4" />For Approval by Assistant Manager</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.pending_am || 0}</span>
                          </button>
                        </Fragment>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveSection('idp_pending_manager')}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'idp_pending_manager' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                        >
                          <span className="flex items-center gap-2"><ClockIcon className="w-4 h-4" />For Approval by Manager</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.pending_manager || 0}</span>
                        </button>
                      )}
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
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.pending_hr || 0}</span>
                </button>
                {showIdpInReview && (
                  <div className="ml-6 space-y-1">
                    {isAMDashboard && (
                      <button
                        type="button"
                        onClick={() => setActiveSection('idp_pending_manager')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'idp_pending_manager' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                      >
                        <span className="flex items-center gap-2"><ClockIcon className="w-4 h-4" />For Approval by Manager</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.pending_manager || 0}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveSection('idp_pending_employee')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'idp_pending_employee' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><UserIcon className="w-4 h-4" />For Approval by Employee</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.pending_employee || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('idp_pending_hr')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'idp_pending_hr' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><BriefcaseIcon className="w-4 h-4" />For Approval by HR</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.pending_hr || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('idp_for_completion')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'idp_for_completion' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                    >
                      <span className="flex items-center gap-2"><PencilSquareIcon className="w-4 h-4" />For Completion</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.for_completion || 0}</span>
                    </button>
                  </div>
                )}

                {/* Approved */}
                <button
                  type="button"
                  onClick={() => setActiveSection('idp_approved')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'idp_approved' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" />Approved</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.approved || 0}</span>
                </button>

                {/* Cycle Completed */}
                <button
                  type="button"
                  onClick={() => setActiveSection('idp_cycle_completed')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${activeSection === 'idp_cycle_completed' ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
                >
                  <span className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" />Cycle Completed</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white">{idpSectionCounts.cycle_completed || 0}</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="mt-auto p-4 border-t border-blue-800">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{isAMDashboard ? 'Assistant Manager Dashboard' : 'Manager Dashboard'}</h1>
            <p className="text-gray-600">
              Welcome, {user.name} ({user.employee_id})
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDateSearch(!showDateSearch)}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition ${dateSearch.enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-600 text-white hover:bg-gray-700'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {dateSearch.enabled ? 'Date Filter Active' : 'Search by Date'}
              </button>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={selectedEmployee !== 'ALL' ? `Filtered: ${employees.find(emp => String(emp.employee_id) === String(selectedEmployee) || String(emp.employee_code) === String(selectedEmployee) || String(emp.id) === String(selectedEmployee))?.name || selectedEmployee}` : 'Search employee...'}
                    value={employeeSearchTerm}
                    onChange={(e) => { setEmployeeSearchTerm(e.target.value); if (selectedEmployee !== 'ALL') setSelectedEmployee('ALL'); }}
                    onFocus={() => { setEmployeeInputFocused(true); setShowEmployeeSuggestions(true); }}
                    onBlur={() => { setTimeout(() => { setEmployeeInputFocused(false); setShowEmployeeSuggestions(false); setActiveSuggestionIndex(-1); }, 150); }}
                    onKeyDown={(e) => {
                      // Arrow navigation and enter to select
                      if (!showEmployeeSuggestions) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setActiveSuggestionIndex((i) => Math.min(i + 1, (employeeSuggestions.length || 0) - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setActiveSuggestionIndex((i) => Math.max(i - 1, 0));
                      } else if (e.key === 'Enter') {
                        if (activeSuggestionIndex >= 0 && employeeSuggestions[activeSuggestionIndex]) {
                          const emp = employeeSuggestions[activeSuggestionIndex];
                          setEmployeeSearchTerm(emp.name || emp.full_name || '');
                          setSelectedEmployee(emp.id || emp.employee_id || emp.employee_code || 'ALL');
                          setShowEmployeeSuggestions(false);
                          setActiveSuggestionIndex(-1);
                          e.preventDefault();
                        }
                      } else if (e.key === 'Escape') {
                        setShowEmployeeSuggestions(false);
                        setActiveSuggestionIndex(-1);
                      }
                    }}
                    className="w-64 px-3 py-2 pl-9 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  {(employeeSearchTerm || selectedEmployee !== 'ALL') && (
                    <button
                      onClick={() => { setEmployeeSearchTerm(''); setSelectedEmployee('ALL'); setShowEmployeeSuggestions(false); }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                      title="Clear"
                    >
                      <XMarkIcon className="h-4 w-4 text-gray-400" />
                    </button>
                  )}

                  {/* Autocomplete suggestions */}
                  {showEmployeeSuggestions && employeeSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-auto">
                      {employeeSuggestions.map((emp, idx) => (
                        <button
                          key={emp.id || emp.employee_id || idx}
                          type="button"
                          onMouseDown={(e) => { /* use onMouseDown to avoid blur before click */
                            e.preventDefault();
                            setEmployeeSearchTerm(emp.name || emp.full_name || '');
                            setSelectedEmployee(emp.id || emp.employee_id || emp.employee_code || 'ALL');
                            setShowEmployeeSuggestions(false);
                            setActiveSuggestionIndex(-1);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${idx === activeSuggestionIndex ? 'bg-blue-50' : ''}`}
                        >
                          <div className="font-medium text-gray-800">{emp.name || emp.full_name || emp.employee_id || emp.employee_code}</div>
                          <div className="text-xs text-gray-500">{emp.employee_id ? `ID: ${emp.employee_id}` : ''} {emp.employee_code ? ` • Code: ${emp.employee_code}` : ''}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={openExportModal}
                  className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
            </div>

            <button
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center gap-3 p-1 rounded hover:bg-gray-50 focus:outline-none"
              title="View profile"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                <UserIcon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-gray-800 hover:underline">{user.name}</div>
                <div className="text-xs text-gray-500">{user.role}</div>
              </div>
            </button>

            {/* Logout moved to sidebar footer for clearer placement */}
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
              <button onClick={() => setShowDateSearch(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input type="date" value={dateSearch.startDate} onChange={(e) => setDateSearch(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" max={dateSearch.endDate || new Date().toISOString().split('T')[0]} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input type="date" value={dateSearch.endDate} onChange={(e) => setDateSearch(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" min={dateSearch.startDate} max={new Date().toISOString().split('T')[0]} />
              </div>

              <div className="col-span-2 flex items-center gap-3">
                <button onClick={() => { setDateSearch(prev => ({ ...prev, enabled: false })); setShowDateSearch(false); }} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100">Cancel</button>
                <button onClick={() => { applyDateSearch(); setShowDateSearch(false); }} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">Apply</button>
                <button onClick={() => clearDateSearch()} className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100">Clear</button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && <p>Loading...</p>}

        

        {/* SUMMARY CARDS (hidden when viewing My Employees) */}
        {activeSection !== 'employees' && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <SummaryCard
              label={isAMDashboard ? "For Approval by Assistant Manager" : "For Approval by Manager"}
              value={summary.clPending}
              gradientClass="from-yellow-400 to-orange-500"
            />
            <SummaryCard
              label="Returned to Supervisor"
              value={summary.clReturned}
              gradientClass="from-red-400 to-red-600"
            />
            <SummaryCard
              label={isAMDashboard ? "Approved by Assistant Manager" : "Approved by Manager"}
              value={summary.clApproved}
              gradientClass="from-emerald-400 to-emerald-700"
            />
          </section>
        )}

        {/* CONDITIONAL CONTENT BASED ON SECTION */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{activeSection === 'pending' ? (isAMDashboard ? 'For Approval by Assistant Manager' : 'For Approval by Manager') : activeSectionLabel}</h2>
            <div className="flex items-center gap-2">
              {/* employee search moved to header */}
            </div>
          </div>

          {activeSection === 'all' ? (
            <Fragment>
              {/* Pending Section */}

              {filteredPendingCL.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">{isAMDashboard ? 'For Approval by Assistant Manager' : 'For Approval by Manager'}</h3>
                  <PendingTable data={filteredPendingCL} goTo={goTo} isAMDashboard={isAMDashboard} />
                </div>
              )}

              {/* Returned Section */}
              {returnedCLs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Returned to Supervisor</h3>
                  <HistoryTable data={returnedCLs} goTo={goTo} isAMDashboard={isAMDashboard} />
                </div>
              )}

              {/* Approved Section */}
              {approvedCLs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">{isAMDashboard ? 'Approved by Assistant Manager' : 'Approved by Manager'}</h3>
                  <HistoryTable data={approvedCLs} goTo={goTo} isAMDashboard={isAMDashboard} />
                </div>
              )}

              {pendingCL.length === 0 && returnedCLs.length === 0 && approvedCLs.length === 0 && (
                <p className="text-gray-400 text-sm italic">No competency levelings found.</p>
              )}
            </Fragment>
          ) : activeSection === 'pending' ? (
            filteredPendingCL.length === 0 ? (
              <p className="text-gray-400 text-sm italic">{isAMDashboard ? 'No pending CLs for assistant manager approval.' : 'No pending CLs for manager approval.'}</p>
            ) : (
              <PendingTable data={filteredPendingCL} goTo={goTo} isAMDashboard={isAMDashboard} />
            )
          ) : activeSection === 'returned' ? (
              returnedCLs.length === 0 ? (
                <p className="text-gray-400 text-sm italic">No CLs returned to supervisor.</p>
              ) : (
                <HistoryTable data={returnedCLs} goTo={goTo} isAMDashboard={isAMDashboard} />
              )
          ) : activeSection === 'approved' ? (
              approvedCLs.length === 0 ? (
                <p className="text-gray-400 text-sm italic">{isAMDashboard ? 'No CLs approved by assistant manager.' : 'No CLs approved by manager.'}</p>
              ) : (
                <HistoryTable data={approvedCLs} goTo={goTo} isAMDashboard={isAMDashboard} />
              )
          ) : activeSection === 'department' ? (
            <Fragment>
              {/* Status Filter for Department Tracking */}
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
                <select
                  value={departmentStatusFilter}
                  onChange={(e) => setDepartmentStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING_EMPLOYEE">Pending Employee</option>
                  <option value="PENDING_MANAGER">Pending Manager</option>
                  <option value="PENDING_HR">Pending HR</option>
                  <option value="PENDING_AM">Pending AM</option>
                  <option value="APPROVED">Approved</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>

              {filteredDepartmentCLs.length === 0 ? (
                <p className="text-gray-400 text-sm italic">No CLs found for the selected status.</p>
              ) : (
                <DepartmentTrackingTable data={filteredDepartmentCLs} goTo={goTo} />
              )}
            </Fragment>
          ) : activeSection === 'employees' ? (
            <EmployeeCompetenciesView 
              employees={employees}
              supervisors={supervisors}
              selectedSupervisorId={selectedSupervisorId}
              searchQuery={employeeSearchTerm}
              setSearchQuery={setEmployeeSearchTerm}
              viewMode={viewMode}
              setViewMode={setViewMode}
              hasCompetenciesOnly={hasCompetenciesOnly}
              setHasCompetenciesOnly={setHasCompetenciesOnly}
              goTo={goTo}
            />
          ) : activeSection === 'idp_pending' ? (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3">IDPs For Your Approval{selectedSupervisor ? ` (${selectedSupervisor.name})` : ''}</h2>
              {filteredPendingIDPs.length === 0 ? (
                <p className="text-gray-400 text-sm italic">No IDPs pending your approval.</p>
              ) : (
                <div className="bg-white shadow-sm rounded overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-50 text-sm">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">IDP ID</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Employee</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Position</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Created At</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                      {filteredPendingIDPs.map(idp => (
                        <tr key={idp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{idp.id}</td>
                          <td className="px-4 py-2">{idp.employee_name}</td>
                          <td className="px-4 py-2">{idp.position_id ? `Position #${idp.position_id}` : ''}</td>
                          <td className="px-4 py-2">{idp.status}</td>
                          <td className="px-4 py-2">{idp.created_at ? new Date(idp.created_at).toLocaleString() : ''}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <button onClick={() => openIdpView(idp)} className="text-blue-600 hover:underline">View</button>

                              
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeSection === 'idp_all' ? (
            <Fragment>
              {filteredIDPsByStatus.pending_am && filteredIDPsByStatus.pending_am.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">For Approval by Assistant Manager</h3>
                  <IDPTable data={filteredIDPsByStatus.pending_am} openIdpView={openIdpView} />
                </div>
              )}
              {filteredIDPsByStatus.pending_manager.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">For Approval by Manager</h3>
                  <IDPTable data={filteredIDPsByStatus.pending_manager} openIdpView={openIdpView} />
                </div>
              )}
              {filteredIDPsByStatus.pending_hr.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">For Approval by HR</h3>
                  <IDPTable data={filteredIDPsByStatus.pending_hr} openIdpView={openIdpView} />
                </div>
              )}
              {filteredIDPsByStatus.for_completion.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">For Completion</h3>
                  <IDPTable data={filteredIDPsByStatus.for_completion} openIdpView={openIdpView} />
                </div>
              )}
              {filteredIDPsByStatus.approved.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Approved</h3>
                  <IDPTable data={filteredIDPsByStatus.approved} openIdpView={openIdpView} />
                </div>
              )}
              {idpSectionCounts.all === 0 && (
                <p className="text-gray-400 text-sm italic">No IDPs found.</p>
              )}
            </Fragment>
          ) : activeSection === 'idp_pending_am' ? (
            filteredIDPsByStatus.pending_am.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No IDPs pending assistant manager approval.</p>
            ) : (
              <IDPTable data={filteredIDPsByStatus.pending_am} openIdpView={openIdpView} />
            )
          ) : activeSection === 'idp_pending_manager' ? (
            filteredIDPsByStatus.pending_manager.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No IDPs pending manager approval.</p>
            ) : (
              <IDPTable data={filteredIDPsByStatus.pending_manager} openIdpView={openIdpView} />
            )
          ) : activeSection === 'idp_pending_hr' ? (
            filteredIDPsByStatus.pending_hr.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No IDPs pending HR approval.</p>
            ) : (
              <IDPTable data={filteredIDPsByStatus.pending_hr} openIdpView={openIdpView} />
            )
          ) : activeSection === 'idp_for_completion' ? (
            filteredIDPsByStatus.for_completion.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No IDPs for completion.</p>
            ) : (
              <IDPTable data={filteredIDPsByStatus.for_completion} openIdpView={openIdpView} />
            )
          ) : activeSection === 'idp_approved' ? (
            filteredIDPsByStatus.approved.length === 0 ? (
              <p className="text-gray-400 text-sm italic">{isAMDashboard ? 'No assistant manager-approved IDPs.' : 'No manager-approved IDPs.'}</p>
            ) : (
              <IDPTable data={filteredIDPsByStatus.approved} openIdpView={openIdpView} />
            )
          ) : activeSection === 'idp_cycle_completed' ? (
            filteredIDPsByStatus.cycle_completed.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No cycle-completed IDPs.</p>
            ) : (
              <IDPTable data={filteredIDPsByStatus.cycle_completed} openIdpView={openIdpView} />
            )
          ) : null}
        </section>
      </main>

      {/* Profile Modal */}
      <ProfileModal open={profileModalOpen} user={user} onClose={() => setProfileModalOpen(false)} />

      {/* RIGHT SIDEBAR – NOTIFICATIONS + RECENT ACTIONS */}
      <aside className="w-72 bg-white border-l border-gray-200 flex flex-col">
        {/* TOP: NOTIFICATIONS */}
        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={() => setShowFullNotifications(true)}
              className="w-full flex items-center justify-between hover:bg-gray-50 transition text-left rounded px-2 py-1 -mx-2"
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
            {/* Filter Buttons */}
            <div className="mt-2 flex gap-1">
              {['ALL', 'CL', 'IDP'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setNotificationFilter(filter)}
                  className={`flex-1 px-2 py-1 text-[11px] font-medium rounded transition ${
                    notificationFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="mt-2 w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition text-center"
              >
                Mark All as Read
              </button>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-2 no-scrollbar">
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No notifications.</p>
            ) : (
              notifications.map((n) => {
                const isUnread = String(n.status || '').toLowerCase() === 'unread';
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition
                      ${isUnread ? 'bg-orange-50 hover:bg-orange-100' : 'bg-gray-50 hover:bg-gray-100'}`}
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

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* BOTTOM: RECENT ACTIONS */}
        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <div className="p-4 border-b border-gray-100">
            <button
              onClick={() => setShowFullRecentActions(true)}
              className="w-full flex items-center justify-between hover:bg-gray-50 transition text-left rounded px-2 py-1 -mx-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">Recent Actions</span>
                <ArrowsPointingOutIcon className="w-4 h-4 text-gray-400" />
              </div>
              {recentActions.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white">
                  {recentActions.length}
                </span>
              )}
            </button>
            {/* Filter Buttons */}
            <div className="mt-2 flex gap-1">
              {['ALL', 'CL', 'IDP'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setRecentFilter(filter)}
                  className={`flex-1 px-2 py-1 text-[11px] font-medium rounded transition ${
                    recentFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-2 overflow-y-auto no-scrollbar">
            {recentActions.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-2">No recent actions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-bold text-gray-700">Action</th>
                      <th className="px-2 py-1 text-left font-bold text-gray-700">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActions.slice(0, 10).map((a, idx) => (
                      <tr
                        key={`${a.id}-${idx}`}
                        className="border-t border-gray-75 hover:bg-gray-50"
                      >
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <p className="font-bold text-gray-900 truncate">{a.title || 'Action'}</p>
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
            )}
          </div>
        </div>
      </aside>

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
          <div className="absolute inset-0" onClick={closeExportModal} />

          <div className="relative z-50 bg-white rounded-lg shadow-xl border border-gray-300 max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Export Data</h3>
              <button onClick={closeExportModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee <span className="text-xs text-gray-500 ml-2">(Filter by specific employee or all)</span></label>
                <select
                  value={exportModal.employee || selectedEmployee}
                  onChange={(e) => setExportModal(prev => ({ ...prev, employee: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="ALL">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.employee_id || emp.employee_code || emp.id}>{emp.name} ({emp.employee_id || emp.employee_code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input type="date" value={exportModal.startDate} onChange={(e) => setExportModal(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" max={exportModal.endDate || new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input type="date" value={exportModal.endDate} onChange={(e) => setExportModal(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md" min={exportModal.startDate} max={new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
                <select value={exportModal.selectedStatus} onChange={(e) => setExportModal(prev => ({ ...prev, selectedStatus: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="ALL">All Statuses</option>
                  {exportModal.module === 'CL' ? (
                    CL_STATUS_SECTIONS.map(section => (
                      <option key={section.key} value={section.key}>{section.label}</option>
                    ))
                  ) : (
                    [
                      'DRAFT','RETURNED','PENDING_EMPLOYEE','PENDING_HR','PENDING_AM','FOR_COMPLETION','PENDING_MANAGER','CYCLE_COMPLETED'
                    ].map(s => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button onClick={closeExportModal} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100" disabled={exportModal.loading}>Cancel</button>
              <button onClick={handleExportCSV} className={`px-6 py-2 text-sm text-white rounded-md transition-all ${exportModal.loading ? 'bg-gray-400 cursor-not-allowed' : !exportModal.startDate || !exportModal.endDate ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`} disabled={exportModal.loading || !exportModal.startDate || !exportModal.endDate} title={!exportModal.startDate || !exportModal.endDate ? 'Please select both start and end dates' : ''}>
                {exportModal.loading ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------- Reusable Components ----------------- */

function SummaryCard({ label, value, gradientClass }) {
  return (
    <div className={`bg-gradient-to-br ${gradientClass} p-6 rounded-lg shadow-md text-white`}>
      <h3 className="text-sm font-medium opacity-90">{label}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

function PendingTable({ data, goTo, isAMDashboard }) {
  return (
    <div className="bg-white shadow-sm rounded overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-50 text-sm">
        <thead className="bg-white">
          <tr>
            <Th>CL ID</Th>
            <Th>Employee</Th>
            <Th>Employee ID</Th>
            <Th>Department</Th>
            <Th>Position</Th>
            <Th>{isAMDashboard ? 'For AM Approval' : 'Status'}</Th>
            <Th>Submitted At</Th>
            <Th>Actions</Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-50">
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <Td>{item.id}</Td>
              <Td>{item.employee_name}</Td>
              <Td>{item.employee_code || item.employee_id}</Td>
              <Td>{item.department_name}</Td>
              <Td>{item.position_title}</Td>
              <Td>{isAMDashboard ? 'For AM Approval' : displayStatus(item.status)}</Td>
              <Td>{new Date(item.submitted_at).toLocaleString()}</Td>

              <Td>
                <button
                  onClick={() => goTo(`/cl/submissions/${item.id}`)}
                  className="px-3 py-1 rounded text-white text-xs
                             bg-gradient-to-r from-blue-500 to-blue-700
                             hover:from-blue-600 hover:to-blue-800"
                >
                  Review & Decide
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// History table – MANAGER ACTIVITY LOG (APPROVED / RETURNED)
function HistoryTable({ data, goTo, isAMDashboard }) {
  return (
    <div className="bg-white shadow-sm rounded overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-50 text-sm">
        <thead className="bg-white">
          <tr>
            <Th>CL ID</Th>
            <Th>Employee</Th>
            <Th>Employee ID</Th>
            <Th>Department</Th>
            <Th>Position</Th>
            <Th>{isAMDashboard ? 'AM Decision' : 'Manager Decision'}</Th>
            <Th>{isAMDashboard ? 'AM Decided At' : 'Manager Decided At'}</Th>
            <Th>Actions</Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-50">
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <Td>{item.id}</Td>
              <Td>{item.employee_name}</Td>
              <Td>{item.employee_code || item.employee_id}</Td>
              <Td>{item.department_name}</Td>
              <Td>{item.position_title}</Td>
              <Td>{isAMDashboard ? (item.am_decision || '-') : (item.manager_decision || '-')}</Td>
              <Td>
                {isAMDashboard
                  ? (item.am_decided_at ? new Date(item.am_decided_at).toLocaleString() : '-')
                  : (item.manager_decided_at ? new Date(item.manager_decided_at).toLocaleString() : '-')}
              </Td>
              <Td>
                <button
                  onClick={() => goTo(`/cl/submissions/${item.id}?viewOnly=true`)}
                  className="px-3 py-1 rounded text-white text-xs
                             bg-gradient-to-r from-gray-500 to-gray-700
                             hover:from-gray-600 hover:to-gray-800"
                >
                  View Details
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Department Tracking table - ALL CLs in manager's department
function DepartmentTrackingTable({ data, goTo }) {
  return (
    <div className="bg-white shadow-sm rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-50 text-sm">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">ID</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">Employee</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">Supervisor</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">Position</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">Status</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">Updated</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600">{item.id}</td>
                <td className="px-3 py-2 text-gray-600">
                  <div className="text-sm font-medium">{item.employee_name}</div>
                  <div className="text-xs text-gray-400">{item.employee_code || item.employee_id}</div>
                </td>
                <td className="px-3 py-2 text-gray-600 text-sm">{item.supervisor_name || '-'}</td>
                <td className="px-3 py-2 text-gray-600 text-sm">{item.position_title}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    item.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    item.status === 'PENDING_MANAGER' ? 'bg-yellow-100 text-yellow-800' :
                    item.status === 'PENDING_HR' ? 'bg-blue-100 text-blue-800' :
                    item.status === 'PENDING_AM' ? 'bg-purple-100 text-purple-800' :
                    item.status === 'PENDING_EMPLOYEE' ? 'bg-cyan-100 text-cyan-800' :
                    item.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {displayStatus(item.status)}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">
                  {item.updated_at
                    ? new Date(item.updated_at).toLocaleDateString()
                    : '-'}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => goTo(`/cl/submissions/${item.id}?viewOnly=true`)}
                    className="px-3 py-1 rounded text-white text-xs whitespace-nowrap
                               bg-gradient-to-r from-indigo-500 to-indigo-700
                               hover:from-indigo-600 hover:to-indigo-800"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-600">
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="px-4 py-2 text-gray-700 font-medium">{children}</td>;
}

function NotificationModal({ open, notification, onProceed, onClose }) {
  const [canProceed, setCanProceed] = useState(true);

  useEffect(() => {
    if (!open || !notification) return;

    async function checkIfActionNeeded() {
      try {
        const url = notification.url || '';
        const msg = String(notification.message || '').toLowerCase();
        // If the message indicates acknowledgement or informational, don't show action
        if (msg.includes('acknowledg') || msg.includes('acknowledged') || msg.includes('requires completion per hr')) {
          setCanProceed(false);
          return;
        }

        // Manager review links: check current status via manager APIs
        if (url.includes('/cl/manager/')) {
          const clean = String(url).split('?')[0].split('#')[0];
          const parts = clean.split('/').filter(Boolean);
          const id = parts[parts.length - 1];
          if (!id) { setCanProceed(true); return; }
          const data = await apiRequest(`/api/cl/manager/${id}`);
          const status = (data && data.status) ? String(data.status).toUpperCase() : '';
          // Manager action required when status is PENDING_MANAGER or RETURNED
          setCanProceed(['PENDING_MANAGER', 'RETURNED'].includes(status));
        } else if (url.includes('/idp/manager/') || url.includes('/idp/am/')) {
          const clean = String(url).split('?')[0].split('#')[0];
          const parts = clean.split('/').filter(Boolean);
          const id = parts[parts.length - 1];
          if (!id) { setCanProceed(true); return; }
          const res = await apiRequest(`/api/idp/manager/${id}`);
          // idp may return header.status
          const status = (res && res.header && res.header.status) ? String(res.header.status).toUpperCase() : '';
          setCanProceed(['PENDING_MANAGER', 'PENDING_AM', 'RETURNED'].includes(status));
        } else {
          // Non-review links keep the button visible
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
          <h3 className="text-lg font-bold text-gray-800">Notification Details</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Message</p>
            <p className="text-sm text-gray-700 mt-1">
              {notification.message || notification.title || 'No message'}
            </p>
          </div>
          {notification.module && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Module</p>
              <p className="text-sm text-gray-700 mt-1">{notification.module}</p>
            </div>
          )}
          {notification.created_at && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Time</p>
              <p className="text-sm text-gray-700 mt-1">
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

function FullRecentActionsModal({ open, recentActions, onClose }) {
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;


  // Reset pagination when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [dateFilter, searchTerm]);

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
    
    // Search term filtering (by employee name)
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      const employeeName = (a.employee_name || a.employee || '').toLowerCase();
      if (!employeeName.includes(search)) return false;
    }
    
    return true;
  });

  const totalPages = Math.ceil(filteredActions.length / PAGE_SIZE) || 1;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const paginatedActions = filteredActions.slice(startIdx, startIdx + PAGE_SIZE);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Recent Actions</h3>
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
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-700">Action</th>
                    <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-700">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-bold uppercase text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {paginatedActions.map((a, idx) => (
                    <tr
                      key={`${a.id}-${idx}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-900 font-bold">{a.title || 'Action'}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{a.description || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 font-medium">
                        {a.created_at ? new Date(a.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-700">
                  Showing {(startIdx + 1)}–{Math.min(startIdx + PAGE_SIZE, filteredActions.length)} of {filteredActions.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      className={`px-2 py-1 text-xs rounded border ${currentPage === i + 1 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
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

function FullNotificationsModal({ open, notifications, onNotificationClick, onClose, onMarkAllRead }) {
  if (!open) return null;

  const unreadCount = notifications.filter(n => String(n.status || '').toLowerCase() === 'unread').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-gray-900">All Notifications</h3>
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
                    className={`w-full text-left p-4 rounded-lg border border-gray-100
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
                          <p className="text-sm text-gray-700 mb-2 font-medium">Module: {n.module}</p>
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

// Employee Competencies View Component
function EmployeeCompetenciesView({ employees, supervisors, selectedSupervisorId, searchQuery, viewMode, setViewMode, hasCompetenciesOnly, setHasCompetenciesOnly, goTo }) {
  // Filter employees by selected supervisor. If no supervisor selected, show all provided employees.
  const employeesForSupervisor = useMemo(() => {
    if (!selectedSupervisorId) return employees || [];
    return (employees || []).filter(emp => String(emp.supervisor_id) === String(selectedSupervisorId));
  }, [employees, selectedSupervisorId]);

  // Find the selected supervisor's name    
  const selectedSupervisor = useMemo(() => {
    return supervisors.find(s => s.id === selectedSupervisorId);
  }, [supervisors, selectedSupervisorId]);

  const filteredEmployees = useMemo(() => {
    let list = employeesForSupervisor;
    if (hasCompetenciesOnly) {
      list = list.filter(emp => (emp.competencyCount || 0) > 0);
    }
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(emp => 
      emp.name?.toLowerCase().includes(query) ||
      emp.employee_id?.toLowerCase().includes(query) ||
      emp.position_title?.toLowerCase().includes(query)
    );
  }, [employeesForSupervisor, hasCompetenciesOnly, searchQuery]);

  return (
    <div>
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            {selectedSupervisor ? `Employees under ${selectedSupervisor.name}` : 'My Employees'}
          </h2>
          {selectedSupervisor && (
            <p className="text-sm text-gray-600 font-medium">
              Supervisor ID: {selectedSupervisor.employee_id}
            </p>
          )}
        </div>
        
        {/* View Toggle Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition ${
              viewMode === 'grid'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title="Grid View"
          >
            <Squares2X2Icon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition ${
              viewMode === 'list'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title="List View"
          >
            <ListBulletIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters: show-only checkbox (search is handled by header input) */}
      <div className="mb-4 flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={hasCompetenciesOnly}
            onChange={(e) => setHasCompetenciesOnly(e.target.checked)}
            className="rounded border-gray-200"
          />
          Show only employees with competencies
        </label>
      </div>

      {filteredEmployees.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          {searchQuery ? 'No employees found matching your search.' : 'No employees found.'}
        </p>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <EmployeeCard key={emp.id} employee={emp} goTo={goTo} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEmployees.map((emp) => (
            <EmployeeListItem key={emp.id} employee={emp} goTo={goTo} />
          ))}
        </div>
      )}
    </div>
  );
}

// Employee Card Component (Grid View)
function EmployeeCard({ employee, goTo }) {
  const latestDate = employee.latestCL?.created_at
    ? new Date(employee.latestCL.created_at).toLocaleDateString()
    : null;

  return (
    <button
      type="button"
      onClick={() => employee.latestCL && goTo(`/cl/submissions/${employee.latestCL.id}?viewOnly=true`)}
      className="relative border border-gray-200 border-l-4 border-l-blue-400 rounded-sm pl-3 pr-4 py-4 text-left shadow-sm transition
        flex gap-3 items-start bg-white hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Avatar / Icon */}
      <div className="flex-shrink-0 mt-1">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5.5 20.5a7 7 0 0113 0M12 12a4 4 0 100-8 4 4 0 000 8z"
            />
          </svg>
        </div>
      </div>

      {/* Text content */}
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-sm truncate text-gray-800">
            {employee.name}
          </div>
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
            {employee.employee_id}
          </span>
        </div>

        {employee.position_title && (
          <div className="text-xs text-gray-700 font-medium mt-1">
            {employee.position_title}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
            {employee.competencyCount || 0} competenc{employee.competencyCount === 1 ? 'y' : 'ies'}
          </span>
          
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            {employee.historyCount || 0} CL record(s)
          </span>

          {employee.latestCL?.status ? (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              employee.latestCL.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
              employee.latestCL.status === 'PENDING_MANAGER' ? 'bg-yellow-50 text-yellow-600' :
              employee.latestCL.status === 'PENDING_HR' ? 'bg-blue-50 text-blue-600' :
              employee.latestCL.status === 'PENDING_AM' ? 'bg-purple-50 text-purple-600' :
              employee.latestCL.status === 'DRAFT' ? 'bg-gray-50 text-gray-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              Latest: {displayStatus(employee.latestCL.status)}
              {latestDate ? ` • ${latestDate}` : ''}
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              No CL yet
            </span>
          )}
        </div>

        <div className="mt-2 text-[11px] text-gray-400">
          {employee.latestCL ? 'Click to view latest CL' : 'No CL available'}
        </div>
      </div>
    </button>
  );
}

// Employee List Item Component (List View)
function EmployeeListItem({ employee, goTo }) {
  

  return (
    <button
      type="button"
      onClick={() => employee.latestCL && goTo(`/cl/submissions/${employee.latestCL.id}?viewOnly=true`)}
      className="w-full border border-gray-200 border-l-4 border-l-blue-400 rounded-sm pl-3 pr-4 py-3 text-left shadow-sm transition
        flex gap-3 items-center bg-white hover:shadow-md hover:bg-gray-50"
    >
      {/* Avatar / Icon */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5.5 20.5a7 7 0 0113 0M12 12a4 4 0 100-8 4 4 0 000 8z"
            />
          </svg>
        </div>
      </div>

      {/* Main Content - Horizontal Layout */}
      <div className="flex-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="font-bold text-sm truncate text-gray-800">
                {employee.name}
              </div>
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold flex-shrink-0">
                {employee.employee_id}
              </span>
            </div>
            
            {employee.position_title && (
              <div className="text-xs text-gray-700 font-medium mt-0.5 truncate">
                {employee.position_title}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 whitespace-nowrap">
              {employee.competencyCount || 0} competenc{employee.competencyCount === 1 ? 'y' : 'ies'}
            </span>
            
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 whitespace-nowrap">
              {employee.historyCount || 0} CL
            </span>

            {employee.latestCL?.status ? (
              <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                employee.latestCL.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                employee.latestCL.status === 'PENDING_MANAGER' ? 'bg-yellow-50 text-yellow-600' :
                employee.latestCL.status === 'PENDING_HR' ? 'bg-blue-50 text-blue-600' :
                employee.latestCL.status === 'PENDING_AM' ? 'bg-purple-50 text-purple-600' :
                employee.latestCL.status === 'DRAFT' ? 'bg-gray-50 text-gray-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {displayStatus(employee.latestCL.status)}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">
                No CL
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// IDP Viewing Modal Component
// IDP Full Page View Component (matches supervisor's CreateIDPPage exactly)
function IDPFullPageView({ open, idp, employee, supervisor, loading, items, header, onClose, areaColor, getCompetencyCompletionStatus }) {
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState('');

  // Approve IDP handler
  const handleApproveIDP = async () => {
    try {
      setActionLoading(true);
      await apiRequest(`/api/idp/${idp.id}/manager/approve`, {
        method: 'PUT',
        body: JSON.stringify({ remarks }),
      });
      alert('IDP approved successfully');
      onClose(); // Close the view and refresh
    } catch (err) {
      console.error('Error approving IDP:', err);
      alert('Failed to approve IDP: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Return IDP handler
  const handleReturnIDP = async () => {
    if (!remarks.trim()) {
      alert('Please provide remarks before returning the IDP');
      return;
    }
    
    try {
      setActionLoading(true);
      await apiRequest(`/api/idp/${idp.id}/manager/return`, {
        method: 'PUT',
        body: JSON.stringify({ remarks }),
      });
      alert('IDP returned to supervisor');
      onClose(); // Close the view and refresh
    } catch (err) {
      console.error('Error returning IDP:', err);
      alert('Failed to return IDP: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };
  
  if (!open) return null;

  const creationDate = header?.created_at ? new Date(header.created_at).toLocaleDateString() : new Date().toLocaleDateString();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-gray-600">Loading IDP details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      {/* Header - Matches supervisor's CreateIDPPage exactly */}
      <div className="border-b bg-black sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <button
                onClick={onClose}
                className="shrink-0 p-2 bg-white/10 hover:bg-white/15 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30"
                aria-label="Back"
              >
                <ArrowLeftIcon className="h-5 w-5 text-white" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white leading-tight">Individual Development Plan (IDP)</h1>
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border bg-yellow-50 text-yellow-800 border-yellow-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                    {idp?.status || header?.status || 'For Manager Approval'}
                  </span>
                </div>
                <p className="text-xs text-white/70 mt-0.5 truncate">
                  View IDP for {employee?.name || ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Matches supervisor's CreateIDPPage exactly */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Top summary - Employee Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Employee Information</h2>
                <p className="text-sm text-gray-600 mt-1">Review details and development activity information.</p>
              </div>
              <div className="text-xs text-gray-600 text-right font-medium">
                <div className="hidden sm:block">Date of IDP Creation</div>
                <div className="font-bold text-gray-800">{creationDate}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-bold text-gray-700 mb-2">Name</label>
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-semibold text-gray-800 border border-gray-100 shadow-sm">
                  {employee?.name}
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-bold text-gray-700 mb-2">Position</label>
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-semibold text-gray-800 border border-gray-100 shadow-sm">
                  {employee?.position_title}
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-bold text-gray-700 mb-2">Department</label>
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-semibold text-gray-800 border border-gray-100 shadow-sm">
                  {employee?.department_name}
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-bold text-gray-700 mb-2">Supervisor/Manager</label>
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-semibold text-gray-800 border border-gray-100 shadow-sm">
                  {supervisor?.name}
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-bold text-gray-700 mb-2">CL Score</label>
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-semibold text-gray-800 border border-gray-100 shadow-sm">
                  {header?.latest_cl_score ? Number(header.latest_cl_score).toFixed(2) : 'No approved CL'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Review Period</label>
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-semibold text-gray-800 border border-gray-100 shadow-sm">
                  {header?.review_period || '1st Cycle Performance Review'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Next Review Date</label>
                <div className="px-3 py-2 bg-white rounded-lg text-sm font-semibold text-gray-800 border border-gray-100 shadow-sm">
                  {header?.next_review_date ? new Date(header.next_review_date).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* IDP Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-1">IDP Status</h3>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-bold text-gray-700 mb-2\">Current Status</div>
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border bg-yellow-50 text-yellow-800 border-yellow-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  For Manager Approval
                </span>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-700 mb-2\">Competencies</div>
                <p className="text-sm font-bold text-gray-900">{items?.length || 0} development plan{items?.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => setShowScoringGuide(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-black text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <InformationCircleIcon className="h-5 w-5" />
                View Scoring Guide
              </button>
            </div>
          </div>
        </div>

        {/* Manager Remarks and Action Buttons - Visible at top */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Manager Remarks</h3>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black resize-none"
              rows="4"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter your remarks for approval or return to supervisor..."
            />
            
            {/* Action Buttons - stacked so Approve / For Completion appears above Return */}
            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={handleApproveIDP}
                className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Approve IDP'}
              </button>

              <button
                onClick={handleReturnIDP}
                className="w-full px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Return to Supervisor'}
              </button>

              <button
                onClick={onClose}
                className="w-full px-6 py-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-gray-300/50"
                disabled={actionLoading}
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Action Guide</h3>
            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <p className="font-bold text-gray-900 mb-1">Approve</p>
                <p className="text-gray-700">Accept the IDP as is and move to next step</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-1">Return</p>
                <p className="text-gray-700">Send back with remarks for supervisor revision</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scoring Guide Modal */}
        {showScoringGuide && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowScoringGuide(false)} aria-hidden="true" />
            <div className="relative h-full w-full flex items-center justify-center p-4">
              <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl bg-white rounded-xl border border-gray-100">
                <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100\">
                  <h2 className="text-lg font-bold text-gray-900\">\n                    Scoring Guide for IDP Completion and Competency Mastery\n                  </h2>
                  <button
                    onClick={() => setShowScoringGuide(false)}
                    className="text-black text-2xl font-bold bg-gray-100 hover:bg-gray-200 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-black/10"
                    aria-label="Close scoring guide"
                  >
                    ×
                  </button>
                </div>

                <div className="p-5 space-y-3 overflow-y-auto max-h-[calc(85vh-64px)]">
                  {SCORING_GUIDE.map((guide) => (
                    <div key={guide.score} className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg text-gray-900 bg-gray-50 rounded-md px-3 py-1 border border-gray-100">
                          {guide.score}
                        </span>
                        <span className="font-bold text-gray-900">{guide.status}</span>
                      </div>
                      <p className="text-gray-800 text-sm leading-relaxed font-medium">{guide.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Development Plan Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Development Plan</h2>
              <p className="text-sm text-gray-600 mt-1">Detailed competency development activities and progress.</p>
            </div>
            <div className="text-xs text-gray-600 text-right font-medium">
              <div>{items?.length || 0} competenc{items?.length !== 1 ? 'ies' : 'y'}</div>
            </div>
          </div>

          {!items || items.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100 mx-5 my-5">
              <p className="text-gray-900 font-bold">No development activities found</p>
              <p className="text-sm text-gray-600 mt-1 font-medium">This IDP does not contain any development activities.</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {items.map((item, itemIndex) => {
                const activity = (item.development_activity && typeof item.development_activity === 'object') 
                  ? item.development_activity 
                  : ((item.developmentActivities || [])[0]);
                const chip = areaColor(item.competency_area || 'Technical');
                const competencyStatus = getCompetencyCompletionStatus(item);
                
                // Calculate activities count
                const mainActivities = activity ? [activity] : [];
                const extraTables = item.extraTables || [];
                const totalActivities = mainActivities.length + extraTables.length;

                return (
                  <div key={item.id || itemIndex} className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-5 py-4 bg-white border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-base font-bold text-gray-900">{item.competency_name}</span>
                            <span
                              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${chip.bg} ${chip.text} ${chip.border}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                              {item.competency_area || 'Technical'}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-700 font-medium">
                            Current level <span className="font-bold text-gray-900">{item.current_level}</span> → Target level{' '}
                            <span className="font-bold text-gray-900">{item.target_level}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-700 px-2 py-1 rounded-lg bg-gray-100 border border-gray-100 shadow-sm">
                            {totalActivities} {totalActivities === 1 ? 'Activity' : 'Activities'}
                          </span>
                          
                          {/* Progress Circle */}
                          <div className="relative w-12 h-12">
                            <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                              <path
                                d="M18 2.0845
                                  a 15.9155 15.9155 0 0 1 0 31.831
                                  a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#f3f4f6"
                                strokeWidth="3"
                              />
                              <path
                                d="M18 2.0845
                                  a 15.9155 15.9155 0 0 1 0 31.831
                                  a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="3"
                                strokeDasharray={`${competencyStatus.percentage}, 100`}
                                className="transition-all duration-500"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-bold text-gray-700">{competencyStatus.percentage}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Activity Details */}
                    {activity && (
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">Activity Type</label>
                            <div className="px-3 py-2 bg-white rounded-lg text-sm text-gray-800 font-semibold border border-gray-100 shadow-sm">
                              {activity.type || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">Completion Status</label>
                            <div className="px-3 py-2 bg-white rounded-lg text-sm text-gray-800 font-semibold border border-gray-100 shadow-sm">
                              {activity.completionStatus || activity.status || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">Score</label>
                            <div className="px-3 py-2 bg-white rounded-lg text-sm text-gray-800 font-semibold border border-gray-100 shadow-sm">
                              {activity.score || 'N/A'}
                            </div>
                          </div>
                          {activity.targetDate && (
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-2">Target Date</label>
                              <div className="px-3 py-2 bg-white rounded-lg text-sm text-gray-800 font-semibold border border-gray-100 shadow-sm">
                                {new Date(activity.targetDate).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                          {activity.actualDate && (
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-2">Actual Date</label>
                              <div className="px-3 py-2 bg-white rounded-lg text-sm text-gray-800 font-semibold border border-gray-100 shadow-sm">
                                {new Date(activity.actualDate).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                        </div>

                        {activity.activity && (
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">Development Activity</label>
                            <div className="px-3 py-2 bg-white rounded-lg text-sm text-gray-800 font-semibold border border-gray-100 min-h-[60px] shadow-sm">
                              {activity.activity}
                            </div>
                          </div>
                        )}

                        {(activity.expectedResults || activity.sharingMethod || activity.applicationMethod) && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {activity.expectedResults && (
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2">Expected Results</label>
                                <div className="px-3 py-2 bg-white rounded-lg text-sm text-gray-800 font-semibold border border-gray-100 min-h-[80px] shadow-sm">
                                  {activity.expectedResults}
                                </div>
                              </div>
                            )}
                            {activity.sharingMethod && (
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2">Knowledge Sharing Method</label>
                                <div className="px-3 py-2 bg-white rounded-lg text-sm text-gray-800 font-semibold border border-gray-100 min-h-[80px] shadow-sm">
                                  {activity.sharingMethod}
                                </div>
                              </div>
                            )}
                            {activity.applicationMethod && (
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2">Application Method</label>
                                <div className="px-3 py-2 bg-white rounded-lg text-sm text-gray-800 font-semibold border border-gray-100 min-h-[80px] shadow-sm">
                                  {activity.applicationMethod}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Extra Tables for Experience/Exposure */}
                    {extraTables && extraTables.length > 0 && (
                      <div className="p-4 border-t border-gray-100">
                        <h4 className="text-sm font-bold text-gray-900 mb-3">Additional Activities</h4>
                        <div className="space-y-3">
                          {extraTables.map((table, tableIndex) => (
                            <div key={tableIndex} className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <span className="font-bold text-gray-700">Activity:</span> <span className="text-gray-800 font-medium">{table.activity || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-700">Type:</span> <span className="text-gray-800 font-medium">{table.type || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-700">Status:</span> <span className="text-gray-800 font-medium">{table.completionStatus || table.status || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-700">Score:</span> <span className="text-gray-800 font-medium">{table.score || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>


      </div>
    </div>
  );
}

export default ManagerDashboard;

function ProfileModal({ open, user, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [departmentLocal, setDepartmentLocal] = useState(null);
  const [positionLocal, setPositionLocal] = useState(null);
  useEffect(() => {
    let mounted = true;
    async function fetchLookups() {
      try {
        // Fetch departments if department not provided
        if (!user?.department_name && user?.department_id) {
          const depts = await apiRequest('/api/lookup/departments');
          if (!mounted) return;
          const found = Array.isArray(depts) && depts.find(d => String(d.id) === String(user.department_id));
          if (found) setDepartmentLocal(found);
        }

        // Fetch positions if position not provided
        if (!user?.position_title && user?.position_id) {
          const positions = await apiRequest('/api/lookup/positions');
          if (!mounted) return;
          const foundPos = Array.isArray(positions) && positions.find(p => String(p.id) === String(user.position_id));
          if (foundPos) setPositionLocal(foundPos);
        }
        } catch {
          // ignore lookup errors; modal will fallback to user fields
        }
    }
    fetchLookups();
    return () => { mounted = false; };
  }, [user]);

  if (!open || !user) return null;

  async function handleChangePassword(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Profile</h3>
            <p className="text-sm text-gray-500">{user.role} information</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-500">Name</p>
            <p className="text-sm text-gray-800">{user.name}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Employee ID</p>
            <p className="text-sm text-gray-800">{user.employee_id || user.employee_code || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Email</p>
            <p className="text-sm text-gray-800">{user.email || user.username || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Department</p>
            <p className="text-sm text-gray-800">{departmentLocal?.name || user.department_name || user.department || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Position</p>
            <p className="text-sm text-gray-800">{positionLocal?.title || user.position_title || user.position || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Role</p>
            <p className="text-sm text-gray-800">{user.role}</p>
          </div>

          <form onSubmit={handleChangePassword} className="mt-2">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Change Password</h4>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
            {success && <div className="text-sm text-green-600 mb-2">{success}</div>}

            <div className="space-y-2">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100">Close</button>
              <button type="submit" disabled={loading} className={`px-4 py-2 text-sm rounded text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {loading ? 'Saving...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
