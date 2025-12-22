// src/pages/HRDashboard.jsx
import { useEffect, useState, useMemo } from 'react';
import React from 'react';
import { apiRequest } from '../api/client';
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
} from '@heroicons/react/24/outline';
import '../index.css';
import '../App.css'; 
import ProficiencyTable, { getProficiencyFromScore } from '../components/ProficiencyGuide';
import { displayStatus } from '../utils/statusHelper';

function HRDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [summary, setSummary] = useState({
    clPending: 0,
    clApproved: 0,
    clReturned: 0,
  });

  const [clByStatus, setClByStatus] = useState({});
  const [allIncomingCL, setAllIncomingCL] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);

  const [activeSection, setActiveSection] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);
  const [showFullNotifications, setShowFullNotifications] = useState(false);

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

  const CL_STATUS_SECTIONS = [
    { key: 'DRAFT', label: 'Returned for Review', icon: PencilSquareIcon },
    { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee', icon: UserIcon },
    { key: 'PENDING_HR', label: 'For Approval by HR', icon: BriefcaseIcon },
    { key: 'PENDING_MANAGER', label: 'For Approval by Manager', icon: ClockIcon },
    { key: 'APPROVED', label: 'Approved', icon: CheckCircleIcon },
  ];

  // Auth check – must be logged in and HR
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(storedUser);

    if (parsed.role !== 'HR') {
      window.location.href = '/';
      return;
    }

    setUser(parsed);
  }, []);

  // Load dashboard
  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const [clIncoming, departments] = await Promise.all([
          apiRequest('/api/cl/hr/incoming', { method: 'GET' }),
          apiRequest('/api/lookup/departments', { method: 'GET' })
        ]);

        setAllIncomingCL(clIncoming || []);
        setAllDepartments(departments || []);

        // Group CLs by status
        const grouped = {};
        CL_STATUS_SECTIONS.forEach(s => {
          grouped[s.key] = [];
        });
        
        (clIncoming || []).forEach(cl => {
          const status = cl.status;
          if (grouped[status]) {
            grouped[status].push(cl);
          }
        });

        setClByStatus(grouped);

        // Calculate summary across all departments
        const pendingHR = (clIncoming || []).filter(cl => cl.status === 'PENDING_HR').length;
        const approved = (clIncoming || []).filter(cl => cl.status === 'APPROVED').length;
        const draft = (clIncoming || []).filter(cl => cl.status === 'DRAFT').length;

        setSummary({
          clPending: pendingHR,
          clApproved: approved,
          clReturned: draft,
        });

      } catch (err) {
        console.error(err);
        setError('Failed to load HR dashboard data.');
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

  function logout() {
    localStorage.clear();
    window.location.href = '/login';
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

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  // Get unique departments from incoming CLs
  const departments = useMemo(() => {
    return allDepartments.map(d => d.name).sort();
  }, [allDepartments]);

  // Set first department as default when departments load
  React.useEffect(() => {
    if (departments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(departments[0]);
    }
  }, [departments, selectedDepartment]);

  // Load department-specific summary when department changes
  React.useEffect(() => {
    if (!user || !selectedDepartment) return;

    async function loadDepartmentSummary() {
      try {
        const clSummary = await apiRequest(
          `/api/cl/hr/summary?department=${encodeURIComponent(selectedDepartment)}`, 
          { method: 'GET' }
        );

        setSummary({
          clPending: clSummary.clPending || 0,
          clApproved: clSummary.clApproved || 0,
          clReturned: clSummary.clReturned || 0
        });
      } catch (err) {
        console.error('Failed to load department summary:', err);
      }
    }

    loadDepartmentSummary();
  }, [user, selectedDepartment]);

  const sectionCounts = useMemo(() => {
    const counts = { ALL: 0 };
    const dataToCount = selectedDepartment 
      ? allIncomingCL.filter(cl => cl.department_name === selectedDepartment)
      : allIncomingCL;
    
    for (const s of CL_STATUS_SECTIONS) {
      counts[s.key] = dataToCount.filter(cl => cl.status === s.key).length;
      counts.ALL += counts[s.key];
    }
    return counts;
  }, [allIncomingCL, selectedDepartment]);

  const activeLabel = useMemo(() => {
    if (activeSection === 'ALL') return 'All Competency Levelings';
    const s = CL_STATUS_SECTIONS.find((x) => x.key === activeSection);
    return s ? s.label : 'All Competency Levelings';
  }, [activeSection]);

  // Filter incoming CLs by selected department
  const filteredIncomingCLs = useMemo(() => {
    if (!selectedDepartment) return allIncomingCL;
    return allIncomingCL.filter(cl => cl.department_name === selectedDepartment);
  }, [allIncomingCL, selectedDepartment]);

  if (!user) {
    return null;
  }

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
              onClick={() => goTo('/hr')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded
                         text-gray-700 hover:bg-gray-100 transition"
            >
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-600" />
              <span>Competency Leveling</span>
            </button>

            {/* CL Sections */}
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
            <h1 className="text-2xl font-bold text-gray-800">HR Dashboard</h1>
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

        {/* Department Selector */}
        <section className="mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Departments</option>
                {departments.map(dept => {
                  const deptCount = allIncomingCL.filter(cl => cl.department_name === dept).length;
                  return (
                    <option key={dept} value={dept}>
                      {dept} ({deptCount} CLs)
                    </option>
                  );
                })}
              </select>
            </div>
            {selectedDepartment && (
              <button
                onClick={() => setSelectedDepartment('')}
                className="mt-7 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
              >
                Clear Filter
              </button>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">
            {activeLabel}
            {selectedDepartment && <span className="text-gray-500 text-lg ml-2">- {selectedDepartment}</span>}
          </h2>

          {activeSection === 'ALL' ? (
            /* All Sections View */
            CL_STATUS_SECTIONS.map(({ key, label }) => {
              const items = filteredIncomingCLs.filter(cl => cl.status === key);
              return (
                <div key={key} className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">{label}</h3>
                  {items.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">No employees in this status.</p>
                  ) : (
                    <CLTable data={items} goTo={goTo} onCLClick={handleCLClick} />
                  )}
                </div>
              );
            })
          ) : (
            /* Single Section View */
            (() => {
              const items = filteredIncomingCLs.filter(cl => cl.status === activeSection);
              if (items.length === 0) {
                return <p className="text-gray-400 text-sm italic">No employees in this status.</p>;
              }
              return <CLTable data={items} goTo={goTo} onCLClick={handleCLClick} />;
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
                  Go to Review
                </button>
              )}
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

function CLTable({ data, goTo, onCLClick }) {
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
                  ? (item.awaiting_approval_from 
                      ? `Returned from ${item.awaiting_approval_from.replace('PENDING_', '').replace(/_/g, ' ')}` 
                      : 'Draft - Not Submitted')
                  : displayStatus(item.status)}
              </Td>
              <Td>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '-'}</Td>

              <Td>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => goTo(`/cl/hr/review/${item.id}`)}
                    className="px-3 py-1 rounded text-white text-xs
                               bg-gradient-to-r from-blue-500 to-blue-700
                               hover:from-blue-600 hover:to-blue-800"
                  >
                    Review
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCLClick(item.id);
                    }}
                    className="px-3 py-1 rounded text-white text-xs
                               bg-gradient-to-r from-purple-500 to-purple-700
                               hover:from-purple-600 hover:to-purple-800"
                  >
                    Details
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

export default HRDashboard;
