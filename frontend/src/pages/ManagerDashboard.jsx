// src/pages/ManagerDashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client';
import { displayStatus } from '../utils/statusHelper';
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
  UsersIcon,
  MagnifyingGlassIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';

function ManagerDashboard() {
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
  const [expandedSupervisors, setExpandedSupervisors] = useState({}); // Track which supervisors are expanded
  const [selectedSupervisorId, setSelectedSupervisorId] = useState(null); // Selected supervisor to view employees
  const [searchQuery, setSearchQuery] = useState(''); // Search for employees
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  // ✅ NEW: notifications + recent actions (right sidebar)
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);

  const [notificationModalState, setNotificationModalState] = useState({
    open: false,
    notification: null,
  });

  const [showFullNotifications, setShowFullNotifications] = useState(false);
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);

  // Only these roles can access Manager dashboard
  const managerRoles = ['Manager', 'HR', 'Admin'];

  const CL_STATUS_SECTIONS = [
    { key: 'pending', label: 'For Approval by Manager', icon: ClockIcon },
    { key: 'returned', label: 'Returned to Supervisor', icon: PencilSquareIcon },
    { key: 'approved', label: 'Approved by Manager', icon: CheckCircleIcon },
    { key: 'department', label: 'Department CL Tracking', icon: Squares2X2Icon },
  ];

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
    if (!managerRoles.includes(parsed.role)) {
      window.location.href = '/';
      return;
    }

    setUser(parsed);
  }, []);

  // ==========================
  // LOAD DASHBOARD DATA
  // ==========================
  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      try {
        const [clSummary, clPending, clAll, deptCLs] = await Promise.all([
          apiRequest('/api/cl/manager/summary'),
          apiRequest('/api/cl/manager/pending'),
          apiRequest('/api/cl/manager/all'),
          apiRequest('/api/cl/manager/department'), // All CLs in manager's department
        ]);

        setSummary({
          clPending: clSummary.clPending || 0,
          clInProgress: clSummary.clInProgress || 0,
          clApproved: clSummary.clApproved || 0,
          clReturned: clSummary.clReturned || 0,
        });

        setPendingCL(clPending || []);
        setAllCL(clAll || []);
        setDepartmentCLs(deptCLs || []);
        
        // Fetch all users and filter by department
        const allUsers = await apiRequest('/api/users');
        
        // Get supervisors in the department
        const deptSupervisors = (allUsers || []).filter(
          u => u.department_id === user.department_id && u.role === 'Supervisor'
        );
        setSupervisors(deptSupervisors);
        
        // Get employees in the department
        const deptEmployees = (allUsers || []).filter(
          u => u.department_id === user.department_id && u.role === 'Employee'
        );
        
        // Enrich with competency data
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
        setError('Failed to load Manager dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user]);

  // ==========================
  // LOAD NOTIFICATIONS (polling)
  // ==========================
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

  // ==========================
  // LOAD RECENT ACTIONS
  // ==========================
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

  // ==========================
  // HELPERS
  // ==========================
  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  function goTo(url) {
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    
    // If already on the target page, just reload data instead of full refresh
    if (currentPath === targetPath) {
      // Reload dashboard data without page refresh
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

  function closeNotificationModal() {
    setNotificationModalState({ open: false, notification: null });
    // Modal stays closed without refresh
  }

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  // Filter CLs by section
  const approvedCLs = allCL.filter(item => item.manager_decision === 'APPROVED');
  // Only show returned CLs that are still in DRAFT status (not yet resubmitted)
  const returnedCLs = allCL.filter(item => item.manager_decision === 'RETURNED' && item.status === 'DRAFT');

  // Filter department CLs by status
  const filteredDepartmentCLs = useMemo(() => {
    if (departmentStatusFilter === 'ALL') {
      return departmentCLs;
    }
    return departmentCLs.filter(item => item.status === departmentStatusFilter);
  }, [departmentCLs, departmentStatusFilter]);

  const sectionCounts = useMemo(() => {
    return {
      pending: pendingCL.length,
      approved: approvedCLs.length,
      returned: returnedCLs.length,
      department: departmentCLs.length,
      all: pendingCL.length + approvedCLs.length + returnedCLs.length,
    };
  }, [pendingCL, approvedCLs, returnedCLs, departmentCLs]);

  const activeSectionLabel = useMemo(() => {
    if (activeSection === 'all') return 'All Competency Levelings';
    const section = CL_STATUS_SECTIONS.find(s => s.key === activeSection);
    return section ? section.label : 'Competency Levelings';
  }, [activeSection]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white">
      {/* SIDEBAR */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">FUTURA</h2>
          <p className="text-sm text-gray-500">{user.role}</p>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 p-4 space-y-4 overflow-y-auto overflow-x-hidden">
          {/* Competency Leveling */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveSection('all')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded
                         text-gray-700 hover:bg-gray-100 transition"
            >
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-600" />
              <span>All Competencies</span>
            </button>

            {/* View Employees Dropdown */}
            <div className="relative">
              <button
                onClick={() => setExpandedSupervisors(prev => ({ ...prev, main: !prev.main }))}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded
                           text-gray-700 hover:bg-gray-100 transition"
              >
                <div className="flex items-center gap-3">
                  <UsersIcon className="w-5 h-5 text-green-600" />
                  <span>View Employees</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${expandedSupervisors.main ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {expandedSupervisors.main && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                  <div className="py-1">
                    {supervisors.length === 0 ? (
                      <p className="text-xs text-gray-500 px-3 py-2">No supervisors found</p>
                    ) : (
                      supervisors.map(sup => {
                        const supervisedEmployees = employees.filter(e => e.supervisor_id === sup.id);
                        return (
                          <button
                            key={sup.id}
                            onClick={() => {
                              setSelectedSupervisorId(sup.id);
                              setActiveSection('employees');
                              setExpandedSupervisors({ main: false });
                            }}
                            className={`w-full text-left px-3 py-2 text-sm transition ${
                              selectedSupervisorId === sup.id && activeSection === 'employees'
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{sup.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                {supervisedEmployees.length}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{sup.employee_id}</div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CL Sections */}
            <div className="pr-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2 px-3">
                CL Sections
              </p>

              <button
                type="button"
                onClick={() => setActiveSection('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                  ${activeSection === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <span className="flex items-center gap-2">
                  <Squares2X2Icon className="w-4 h-4" />
                  All
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  {sectionCounts.all || 0}
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
        </nav>

        {/* LOGOUT */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2
                       py-2 rounded bg-red-600 text-white hover:bg-red-700 transition"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Manager Dashboard</h1>
            <p className="text-gray-600">
              Welcome, {user.name} ({user.employee_id})
            </p>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && <p>Loading...</p>}

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            label="For Approval by Manager"
            value={summary.clPending}
            gradientClass="from-yellow-400 to-orange-500"
          />
          <SummaryCard
            label="Returned to Supervisor"
            value={summary.clReturned}
            gradientClass="from-red-400 to-red-600"
          />
          <SummaryCard
            label="Approved by Manager"
            value={summary.clApproved}
            gradientClass="from-emerald-400 to-emerald-700"
          />
        </section>

        {/* CONDITIONAL CONTENT BASED ON SECTION */}
        <section>
          <h2 className="text-xl font-semibold mb-3">{activeSectionLabel}</h2>

          {activeSection === 'all' ? (
            <>
              {/* Pending Section */}
              {pendingCL.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">For Approval by Manager</h3>
                  <PendingTable data={pendingCL} goTo={goTo} />
                </div>
              )}

              {/* Returned Section */}
              {returnedCLs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Returned to Supervisor</h3>
                  <HistoryTable data={returnedCLs} goTo={goTo} />
                </div>
              )}

              {/* Approved Section */}
              {approvedCLs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Approved by Manager</h3>
                  <HistoryTable data={approvedCLs} goTo={goTo} />
                </div>
              )}

              {pendingCL.length === 0 && returnedCLs.length === 0 && approvedCLs.length === 0 && (
                <p className="text-gray-400 text-sm italic">No competency levelings found.</p>
              )}
            </>
          ) : activeSection === 'pending' ? (
            pendingCL.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No pending CLs for manager approval.</p>
            ) : (
              <PendingTable data={pendingCL} goTo={goTo} />
            )
          ) : activeSection === 'returned' ? (
            returnedCLs.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No CLs returned to supervisor.</p>
            ) : (
              <HistoryTable data={returnedCLs} goTo={goTo} />
            )
          ) : activeSection === 'approved' ? (
            approvedCLs.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No CLs approved by manager.</p>
            ) : (
              <HistoryTable data={approvedCLs} goTo={goTo} />
            )
          ) : activeSection === 'department' ? (
            <>
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
            </>
          ) : activeSection === 'employees' ? (
            <EmployeeCompetenciesView 
              employees={employees}
              supervisors={supervisors}
              selectedSupervisorId={selectedSupervisorId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              viewMode={viewMode}
              setViewMode={setViewMode}
              goTo={goTo}
            />
          ) : null}
        </section>
      </main>

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

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* BOTTOM: RECENT ACTIONS */}
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

function PendingTable({ data, goTo }) {
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
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <Td>{item.id}</Td>
              <Td>{item.employee_name}</Td>
              <Td>{item.employee_code || item.employee_id}</Td>
              <Td>{item.department_name}</Td>
              <Td>{item.position_title}</Td>
              <Td>{displayStatus(item.status)}</Td>
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
function HistoryTable({ data, goTo }) {
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
            <Th>Manager Decision</Th>
            <Th>Manager Decided At</Th>
            <Th>Actions</Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <Td>{item.id}</Td>
              <Td>{item.employee_name}</Td>
              <Td>{item.employee_code || item.employee_id}</Td>
              <Td>{item.department_name}</Td>
              <Td>{item.position_title}</Td>
              <Td>{item.manager_decision || '-'}</Td>
              <Td>
                {item.manager_decided_at
                  ? new Date(item.manager_decided_at).toLocaleString()
                  : '-'}
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
    <div className="bg-white shadow rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">ID</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Employee</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Supervisor</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Position</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Updated</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700">{item.id}</td>
                <td className="px-3 py-2 text-gray-700">
                  <div className="text-sm font-medium">{item.employee_name}</div>
                  <div className="text-xs text-gray-500">{item.employee_code || item.employee_id}</div>
                </td>
                <td className="px-3 py-2 text-gray-700 text-sm">{item.supervisor_name || '-'}</td>
                <td className="px-3 py-2 text-gray-700 text-sm">{item.position_title}</td>
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
                <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">
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

// Employee Competencies View Component
function EmployeeCompetenciesView({ employees, supervisors, selectedSupervisorId, searchQuery, setSearchQuery, viewMode, setViewMode, goTo }) {
  // Filter employees by selected supervisor
  const employeesForSupervisor = useMemo(() => {
    if (!selectedSupervisorId) return [];
    return employees.filter(emp => emp.supervisor_id === selectedSupervisorId);
  }, [employees, selectedSupervisorId]);

  // Find the selected supervisor's name
  const selectedSupervisor = useMemo(() => {
    return supervisors.find(s => s.id === selectedSupervisorId);
  }, [supervisors, selectedSupervisorId]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employeesForSupervisor;
    
    const query = searchQuery.toLowerCase();
    return employeesForSupervisor.filter(emp => 
      emp.name?.toLowerCase().includes(query) ||
      emp.employee_id?.toLowerCase().includes(query) ||
      emp.position_title?.toLowerCase().includes(query)
    );
  }, [employeesForSupervisor, searchQuery]);

  return (
    <div>
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {selectedSupervisor ? `Employees under ${selectedSupervisor.name}` : 'Select a Supervisor'}
          </h2>
          {selectedSupervisor && (
            <p className="text-sm text-slate-600">
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

      {!selectedSupervisorId ? (
        <p className="text-sm text-gray-500 text-center py-8">
          Please select a supervisor from the sidebar to view their employees.
        </p>
      ) : filteredEmployees.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
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
      className="relative border border-slate-200 border-l-4 border-l-blue-500 rounded-sm pl-3 pr-4 py-4 text-left shadow-sm transition
        flex gap-3 items-start bg-white hover:shadow-md hover:-translate-y-0.5"
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
          {employee.latestCL ? 'Click to view latest CL' : 'No CL available'}
        </div>
      </div>
    </button>
  );
}

// Employee List Item Component (List View)
function EmployeeListItem({ employee, goTo }) {
  const latestDate = employee.latestCL?.created_at
    ? new Date(employee.latestCL.created_at).toLocaleDateString()
    : null;

  return (
    <button
      type="button"
      onClick={() => employee.latestCL && goTo(`/cl/submissions/${employee.latestCL.id}?viewOnly=true`)}
      className="w-full border border-slate-200 border-l-4 border-l-blue-500 rounded-sm pl-3 pr-4 py-3 text-left shadow-sm transition
        flex gap-3 items-center bg-white hover:shadow-md hover:bg-slate-50"
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

export default ManagerDashboard;
