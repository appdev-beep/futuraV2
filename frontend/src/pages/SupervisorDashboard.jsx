// src/pages/SupervisorDashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client';
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
  UsersIcon,
  MagnifyingGlassIcon,
  ListBulletIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import '../index.css';
import '../App.css';
import ProficiencyTable, { getProficiencyFromScore } from '../components/ProficiencyGuide';
import { displayStatus } from '../utils/statusHelper';

function SupervisorDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState({
    clPending: 0,
    clApproved: 0,
    clReturned: 0,
  });

  const [clByStatus, setClByStatus] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const [activeSection, setActiveSection] = useState('ALL');
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);
  const [showFullNotifications, setShowFullNotifications] = useState(false);

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

  const [employeeDetailsModal, setEmployeeDetailsModal] = useState({
    open: false,
    employee: null,
    history: [],
    loading: false,
  });

  const [clDetailsModal, setClDetailsModal] = useState({
    open: false,
    clId: null,
    details: null,
    loading: false,
  });

  const supervisorRoles = ['Supervisor', 'AM', 'Manager', 'HR'];

  const CL_STATUS_SECTIONS = [
    { key: 'DRAFT', label: 'Returns', icon: PencilSquareIcon },
    { key: 'PENDING_EMPLOYEE', label: 'Pending – Employee', icon: UserIcon },
    { key: 'PENDING_HR', label: 'Pending – HR', icon: BriefcaseIcon },
    { key: 'PENDING_MANAGER', label: 'Pending – Manager', icon: ClockIcon },
    { key: 'APPROVED', label: 'Approved', icon: CheckCircleIcon },
  ];

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      try {
        const [clSummary, clGrouped, allUsers] = await Promise.all([
          apiRequest('/api/cl/supervisor/summary'),
          apiRequest('/api/cl/supervisor/all'),
          apiRequest('/api/users'),
        ]);

        setSummary({
          clPending: clSummary.clPending || 0,
          clApproved: clSummary.clApproved || 0,
          clReturned: clSummary.clInProgress || 0,
        });

        setClByStatus(clGrouped || {});
        
        // Filter employees in same department with Employee role
        const deptEmployees = (allUsers || []).filter(
          u => u.department_id === user.department_id && u.role === 'Employee'
        );
        
        // Enrich with competency and history data
        const enriched = await Promise.all(
          deptEmployees.map(async (emp) => {
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
      } catch (err) {
        console.error(err);
        setError('Failed to load Supervisor dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user]);

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
  }, [user]);

  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

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

  async function openEmployeeDetails(employee) {
    setEmployeeDetailsModal({
      open: true,
      employee,
      history: [],
      loading: true,
    });

    try {
      const histResp = await apiRequest(`/api/cl/employee/${employee.id}/history`);
      const histArr = Array.isArray(histResp) ? histResp : (histResp?.history || []);
      
      setEmployeeDetailsModal(prev => ({
        ...prev,
        history: histArr,
        loading: false,
      }));
    } catch (err) {
      console.error('Failed to load employee history:', err);
      setEmployeeDetailsModal(prev => ({
        ...prev,
        history: [],
        loading: false,
      }));
    }
  }

  function closeEmployeeDetails() {
    setEmployeeDetailsModal({
      open: false,
      employee: null,
      history: [],
      loading: false,
    });
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
            onConfirm: () => window.location.reload(),
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
      openModal({
        title: 'Recent Action Details',
        message: `${action.title}\n\n${action.description || ''}\n\nDeleted at: ${new Date(action.created_at).toLocaleString()}`,
        showCancel: false,
        confirmText: 'OK',
      });
      return;
    }
    
    // Check if we're staying on the same page
    const url = action.url || '/supervisor';
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
    const url = n?.url || '/supervisor';
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
    // Modal stays closed without refresh
  }

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  const sectionCounts = useMemo(() => {
    const counts = { ALL: 0 };
    for (const s of CL_STATUS_SECTIONS) {
      counts[s.key] = (clByStatus?.[s.key] || []).length;
      counts.ALL += counts[s.key];
    }
    return counts;
  }, [clByStatus]);

  const activeLabel = useMemo(() => {
    if (activeSection === 'ALL') return 'All Competency Levelings';
    const s = CL_STATUS_SECTIONS.find((x) => x.key === activeSection);
    return s ? s.label : 'All Competency Levelings';
  }, [activeSection]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT SIDEBAR */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">FUTURA</h2>
          <p className="text-sm text-gray-500">{user.role}</p>
        </div>

        <nav className="p-4 space-y-4 overflow-y-auto">
          {/* Competency Leveling */}
          <div className="space-y-1">
            <button
              onClick={() => goTo('/supervisor')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded
                         text-gray-700 hover:bg-gray-100 transition"
            >
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-600" />
              <span>Competency Leveling</span>
            </button>
            
            <button
              onClick={() => setActiveSection('employees')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded
                         text-gray-700 hover:bg-gray-100 transition"
            >
              <UsersIcon className="w-5 h-5 text-green-600" />
              <span>View Employees</span>
            </button>

            {/* ✅ REPLACE THE "Start" SLOT WITH OPTIONS */}
            <div className="pr-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2 px-3">
                CL Sections
              </p>

              <button
                type="button"
                onClick={() => setActiveSection('ALL')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                  ${activeSection === 'ALL' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <span className="flex items-center gap-2">
                  <Squares2X2Icon className="w-4 h-4" />
                  All
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  {sectionCounts.ALL || 0}
                </span>
              </button>

              <div className="mt-1 space-y-1">
                {CL_STATUS_SECTIONS.map(({ key, label, icon }) => {
                  const Icon = icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveSection(key)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                        ${activeSection === key ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {sectionCounts[key] || 0}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Keep Start button, but place it AFTER the options */}
              <button
                onClick={() => goTo('/cl/start')}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded
                           text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
              >
                <span>➤ Start Competency Leveling</span>
              </button>
            </div>
          </div>

          {/* IDP */}
          <button
            onClick={() => goTo('/idp')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded
                       text-gray-700 hover:bg-gray-100 transition"
          >
            <BookOpenIcon className="w-5 h-5 text-green-600" />
            <span>IDP Leveling</span>
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Supervisor Dashboard</h1>
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

        {error && <div className="text-red-600 mb-4">{error}</div>}
        {loading && <p>Loading...</p>}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            label="CL - Approval"
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
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{activeLabel}</h2>

          {activeSection === 'employees' ? (
            <EmployeeCompetenciesView 
              employees={employees}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              viewMode={viewMode}
              setViewMode={setViewMode}
              onEmployeeClick={openEmployeeDetails}
            />
          ) : activeSection === 'ALL' ? (
            CL_STATUS_SECTIONS.map(({ key, label }) => {
              const items = clByStatus[key] || [];
              return (
                <div key={key} className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">{label}</h3>
                  {items.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No employees in this status.</p>
                  ) : (
                    <CLTable data={items} goTo={goTo} onDelete={handleDeleteCL} />
                  )}
                </div>
              );
            })
          ) : (
            (() => {
              const items = clByStatus[activeSection] || [];
              if (items.length === 0) {
                return <p className="text-gray-400 text-sm italic">No employees in this status.</p>;
              }
              return <CLTable data={items} goTo={goTo} onDelete={handleDeleteCL} />;
            })()
          )}
        </section>
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="w-56 bg-white border-l border-gray-200 flex flex-col">
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
                    <p className="font-medium text-gray-800 whitespace-pre-wrap">
                      {n.message || n.title || 'Notification'}
                    </p>
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

      <EmployeeDetailsModal
        open={employeeDetailsModal.open}
        employee={employeeDetailsModal.employee}
        history={employeeDetailsModal.history}
        loading={employeeDetailsModal.loading}
        onClose={closeEmployeeDetails}
        onCLClick={handleCLClick}
      />

      {/* CL Details Modal */}
      {clDetailsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h4>
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
                        <span className="ml-2 font-medium text-green-600">
                          {clDetailsModal.details.total_score != null ? Number(clDetailsModal.details.total_score).toFixed(2) : 'N/A'}
                        </span>
                        {clDetailsModal.details.total_score != null && (() => {
                          const p = getProficiencyFromScore(clDetailsModal.details.total_score);
                          return p ? (<div className="text-xs text-slate-600 mt-1">Level {p.level} — {p.proficiency}</div>) : null;
                        })()}
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
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Comments</th>
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
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <ProficiencyTable />
                  </div>

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
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={closeCLDetailsModal}
                className="px-4 py-2 text-sm rounded-md bg-gray-600 text-white hover:bg-gray-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
                {item.status === 'DRAFT' 
                  ? (item.awaiting_approval_from 
                      ? `Returned from ${item.awaiting_approval_from.replace('PENDING_', '').replace(/_/g, ' ')}` 
                      : 'Draft - Not Submitted')
                  : displayStatus(item.status)}
              </Td>
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

  if (!open) return null;

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
                  {filteredActions.map((a, idx) => (
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

// Employee Details Modal Component
function EmployeeDetailsModal({ open, employee, history, loading, onClose, onCLClick }) {
  if (!open || !employee) return null;

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING_SUPERVISOR': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'PENDING_MANAGER': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-300';
      case 'PENDING_AM': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'PENDING_HR': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'RETURNED': return 'bg-red-100 text-red-800 border-red-300';
      case 'DRAFT': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl border border-gray-300 max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-300 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Employee Details
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {employee.name} ({employee.employee_id})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded transition text-gray-600"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {/* Employee Information */}
          <div className="border border-gray-200 rounded p-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-900">
              Employee Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-600">Name</p>
                <p className="text-sm text-gray-900 font-medium">{employee.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Employee ID</p>
                <p className="text-sm text-gray-900 font-medium">{employee.employee_id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Email</p>
                <p className="text-sm text-gray-900 font-medium">{employee.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Position</p>
                <p className="text-sm text-gray-900 font-medium">{employee.position_title || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Department</p>
                <p className="text-sm text-gray-900 font-medium">{employee.department_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Competencies</p>
                <p className="text-sm text-gray-900 font-medium">{employee.competencyCount || 0}</p>
              </div>
            </div>
          </div>

          {/* CL History */}
          <div className="border border-gray-200 rounded p-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-900">
              Competency Leveling History
            </h3>

            {loading && (
              <p className="text-xs text-gray-600">Loading history...</p>
            )}

            {!loading && history.length === 0 && (
              <p className="text-xs text-gray-600">
                No competency leveling records found.
              </p>
            )}

            {!loading && history.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-300">
                  <thead className="bg-white border-b-2 border-gray-300 text-gray-900">
                    <tr>
                      <th className="px-2 py-1.5 text-left border-b border-gray-300">CL ID</th>
                      <th className="px-2 py-1.5 text-left border-b border-gray-300">Cycle</th>
                      <th className="px-2 py-1.5 text-left border-b border-gray-300">Status</th>
                      <th className="px-2 py-1.5 text-left border-b border-gray-300">Date</th>
                      <th className="px-2 py-1.5 text-left border-b border-gray-300">Score</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {history.map((cl) => (
                      <tr
                        key={cl.id}
                        onClick={() => onCLClick(cl.id)}
                        className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                      >
                        <td className="px-2 py-1.5 text-blue-600 font-medium">{cl.id}</td>
                        <td className="px-2 py-1.5 text-gray-900">
                          {cl.cycle_name || cl.cycle_id || '-'}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${getStatusColor(cl.status)}`}>
                            {displayStatus(cl.status) || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-900">
                          {cl.created_at
                            ? new Date(cl.created_at).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-gray-900">
                          {cl.total_score != null ? cl.total_score : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-gray-600 mt-2">
                  Click on any row to view full CL details
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Employee Competencies View Component
function EmployeeCompetenciesView({ employees, searchQuery, setSearchQuery, viewMode, setViewMode, onEmployeeClick }) {
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    
    const query = searchQuery.toLowerCase();
    return employees.filter(emp => 
      emp.name?.toLowerCase().includes(query) ||
      emp.employee_id?.toLowerCase().includes(query) ||
      emp.position_title?.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  return (
    <div>
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Department Employees
        </h2>
        
        {/* View Toggle Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition ${
              viewMode === 'grid'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="List View"
          >
            <ListBulletIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-4 relative">
        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, employee ID, or position..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
      </div>

      {filteredEmployees.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          {searchQuery ? 'No employees found matching your search.' : 'No employees found.'}
        </p>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <EmployeeCard key={emp.id} employee={emp} onClick={() => onEmployeeClick(emp)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEmployees.map((emp) => (
            <EmployeeListItem key={emp.id} employee={emp} onClick={() => onEmployeeClick(emp)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Employee Card Component (Grid View)
function EmployeeCard({ employee, onClick }) {
  const latestDate = employee.latestCL?.created_at
    ? new Date(employee.latestCL.created_at).toLocaleDateString()
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative border border-slate-200 border-l-4 border-l-blue-500 rounded-sm pl-3 pr-4 py-4 text-left shadow-sm transition
        flex gap-3 items-start bg-white hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
    >
      {/* Avatar / Icon */}
      <div className="flex-shrink-0 mt-1">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">
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
          <div className="font-semibold text-sm truncate text-slate-800">
            {employee.name}
          </div>
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {employee.employee_id}
          </span>
        </div>

        {employee.position_title && (
          <div className="text-xs text-slate-700 mt-1">
            {employee.position_title}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
            {employee.competencyCount || 0} competenc{employee.competencyCount === 1 ? 'y' : 'ies'}
          </span>
          
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            {employee.historyCount || 0} CL record(s)
          </span>

          {employee.latestCL?.status ? (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              employee.latestCL.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
              employee.latestCL.status === 'PENDING_SUPERVISOR' ? 'bg-yellow-50 text-yellow-700' :
              employee.latestCL.status === 'PENDING_MANAGER' ? 'bg-yellow-50 text-yellow-700' :
              employee.latestCL.status === 'PENDING_HR' ? 'bg-blue-50 text-blue-700' :
              employee.latestCL.status === 'PENDING_AM' ? 'bg-purple-50 text-purple-700' :
              employee.latestCL.status === 'DRAFT' ? 'bg-slate-50 text-slate-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              Latest: {displayStatus(employee.latestCL.status)}
              {latestDate ? ` • ${latestDate}` : ''}
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              No CL yet
            </span>
          )}
        </div>

        <div className="mt-2 text-[11px] text-slate-500">
          Click to view employee details
        </div>
      </div>
    </button>
  );
}

// Employee List Item Component (List View)
function EmployeeListItem({ employee, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border border-slate-200 border-l-4 border-l-blue-500 rounded-sm pl-3 pr-4 py-3 text-left shadow-sm transition
        flex gap-3 items-center bg-white hover:shadow-md hover:bg-slate-50 cursor-pointer"
    >
      {/* Avatar / Icon */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">
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
              <div className="font-semibold text-sm truncate text-slate-800">
                {employee.name}
              </div>
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                {employee.employee_id}
              </span>
            </div>
            
            {employee.position_title && (
              <div className="text-xs text-slate-600 mt-0.5 truncate">
                {employee.position_title}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 whitespace-nowrap">
              {employee.competencyCount || 0} competenc{employee.competencyCount === 1 ? 'y' : 'ies'}
            </span>
            
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
              {employee.historyCount || 0} CL
            </span>

            {employee.latestCL?.status ? (
              <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                employee.latestCL.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                employee.latestCL.status === 'PENDING_SUPERVISOR' ? 'bg-yellow-50 text-yellow-700' :
                employee.latestCL.status === 'PENDING_MANAGER' ? 'bg-yellow-50 text-yellow-700' :
                employee.latestCL.status === 'PENDING_HR' ? 'bg-blue-50 text-blue-700' :
                employee.latestCL.status === 'PENDING_AM' ? 'bg-purple-50 text-purple-700' :
                employee.latestCL.status === 'DRAFT' ? 'bg-slate-50 text-slate-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {displayStatus(employee.latestCL.status)}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                No CL
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default SupervisorDashboard;
