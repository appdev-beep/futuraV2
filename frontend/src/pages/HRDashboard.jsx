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
} from '@heroicons/react/24/outline';
import '../index.css';
import '../App.css'; 

function HRDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allCL, setAllCL] = useState([]); // one row per HR action
  const [allIncomingCL, setAllIncomingCL] = useState([]); // ALL CLs for incoming view
  const [allDepartments, setAllDepartments] = useState([]); // All departments from DB
  const [summary, setSummary] = useState({
    clPending: 0,
    clApproved: 0,
    clReturned: 0
  });
  
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  
  const [notificationModalState, setNotificationModalState] = useState({
    open: false,
    notification: null,
  });

  const [activeView, setActiveView] = useState('incoming'); // 'incoming' or 'history'
  const [selectedDepartment, setSelectedDepartment] = useState(''); // department name
  const [showFullNotifications, setShowFullNotifications] = useState(false);
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);

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

  // Load dashboard (summary, pending list, and activity log)
  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const [_clPending, clAll, clIncoming, departments] = await Promise.all([
          apiRequest('/api/cl/hr/pending', { method: 'GET' }),
          apiRequest('/api/cl/hr/all', { method: 'GET' }), // activity log
          apiRequest('/api/cl/hr/incoming', { method: 'GET' }), // all CLs from all departments
          apiRequest('/api/lookup/departments', { method: 'GET' }) // all departments
        ]);

        // Summary will be loaded separately based on selected department
        setSummary({
          clPending: 0,
          clApproved: 0,
          clReturned: 0
        });

        setAllCL(clAll || []);
        setAllIncomingCL(clIncoming || []);
        setAllDepartments(departments || []);
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
    // Modal stays closed without refresh
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
    if (!user || !selectedDepartment || activeView !== 'incoming') return;

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
  }, [user, selectedDepartment, activeView]);

  // Filter incoming CLs by selected department
  const filteredIncomingCLs = useMemo(() => {
    return allIncomingCL.filter(cl => cl.department_name === selectedDepartment);
  }, [allIncomingCL, selectedDepartment]);

  if (!user) {
    return null;
  }

  // Activity log: every APPROVED / RETURNED done by this HR
  const hrActivity = allCL;

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT SIDEBAR - Navigation */}
      <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-blue-600">FUTURA</h2>
          <p className="text-xs text-gray-500 mt-1">HR Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {/* Department List */}
          {departments.length > 0 && (
            <div className="space-y-1">
              {departments.map(dept => {
                const deptCount = allIncomingCL.filter(cl => cl.department_name === dept).length;
                return (
                  <button
                    key={dept}
                    onClick={() => { setActiveView('incoming'); setSelectedDepartment(dept); }}
                    className={`w-full text-left px-4 py-2 transition
                               ${
                                 activeView === 'incoming' && selectedDepartment === dept
                                   ? 'bg-blue-50 text-blue-700 font-semibold'
                                   : 'text-gray-700 hover:bg-gray-100'
                               }`}
                  >
                    {dept} ({deptCount})
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => { setActiveView('history'); setSelectedDepartment(''); }}
            className={`w-full flex items-center gap-3 px-4 py-2 transition
                       ${
                         activeView === 'history'
                           ? 'bg-blue-50 text-blue-700 font-semibold'
                           : 'text-gray-700 hover:bg-gray-100'
                       }`}
          >
            <CheckCircleIcon className="w-5 h-5" />
            <span>HR Activity Log</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2
                       bg-red-600 text-white hover:bg-red-700 transition"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              HR Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Welcome, <span className="font-semibold">{user.name}</span> (
              {user.employee_id})
            </p>
          </div>
        </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-4 text-sm text-gray-600">
          Loading dashboard…
        </div>
      )}

      {/* Summary Cards */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Pending Review" value={summary.clPending} />
          <SummaryCard label="Approved" value={summary.clApproved} />
          <SummaryCard label="Returned" value={summary.clReturned} />
        </div>
      </section>

      {/* Incoming CLs */}
      {activeView === 'incoming' ? (
        /* Incoming Competencies View - Single Department Table */
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {selectedDepartment}
          </h2>

          {filteredIncomingCLs.length === 0 ? (
              <p className="text-sm text-gray-600">
                No competencies for this department.
              </p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Employee</Th>
                      <Th>Position</Th>
                      <Th>Supervisor</Th>
                      <Th>Status</Th>
                      <Th>Submitted At</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredIncomingCLs.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <Td>{item.employee_name}</Td>
                        <Td>{item.position_title || '-'}</Td>
                        <Td>{item.supervisor_name || '-'}</Td>
                        <Td>
                          <span className={`px-2 py-1 text-xs font-medium ${
                            item.status === 'PENDING_HR' ? 'bg-yellow-100 text-yellow-800' :
                            item.status === 'PENDING_EMPLOYEE' ? 'bg-blue-100 text-blue-800' :
                            item.status === 'PENDING_MANAGER' ? 'bg-purple-100 text-purple-800' :
                            item.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                            item.status === 'DRAFT' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status}
                          </span>
                        </Td>
                        <Td>
                          {item.submitted_at
                            ? new Date(item.submitted_at).toLocaleString()
                            : '-'}
                        </Td>
                        <Td>
                          <button
                            type="button"
                            onClick={() => goTo(`/cl/hr/review/${item.id}`)}
                            className="inline-flex items-center bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            View
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      ) : (
        /* HR Activity Log – APPROVED & RETURNED, one row per action */
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            HR Activity Log (Approvals & Returns)
          </h2>

          {hrActivity.length === 0 ? (
            <p className="text-sm text-gray-600">
              No HR actions recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Employee</Th>
                    <Th>Supervisor</Th>
                    <Th>Department</Th>
                    <Th>HR Decision</Th>
                    <Th>HR Decided At</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {hrActivity.map((item) => (
                    <tr
                      key={`${item.id}-${item.hr_decided_at || ''}`}
                      className="hover:bg-gray-50"
                    >
                      <Td>{item.employee_name}</Td>
                      <Td>{item.supervisor_name}</Td>
                      <Td>{item.department_name}</Td>
                      <Td>{item.hr_decision || '-'}</Td>
                      <Td>
                        {item.hr_decided_at
                          ? new Date(item.hr_decided_at).toLocaleString()
                          : '-'}
                      </Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => goTo(`/cl/hr/review/${item.id}`)}
                          className="inline-flex items-center rounded-md bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                        >
                          View Details
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      </main>

      {/* RIGHT SIDEBAR - Notifications & Recent Actions */}
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
        onClose={() => setShowFullNotifications(false)}
      />
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-medium text-gray-600">{label}</h3>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  );
}

function Td({ children }) {
  return (
    <td className="px-4 py-2 align-top text-sm text-gray-700">
      {children}
    </td>
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

export default HRDashboard;
