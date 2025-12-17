// src/pages/EmployeeDashboard.jsx
import { useEffect, useState, useMemo } from 'react';
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

function EmployeeDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCL, setPendingCL] = useState([]);
  const [clHistory, setClHistory] = useState([]); // includes decision fields
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  
  const [notificationModalState, setNotificationModalState] = useState({
    open: false,
    notification: null,
  });

  const [activeView, setActiveView] = useState('pending'); // 'pending' or 'history'
  const [showFullNotifications, setShowFullNotifications] = useState(false);
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);

  // Auth check – must be logged in and Employee
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(storedUser);

    if (parsed.role !== 'Employee') {
      window.location.href = '/';
      return;
    }

    setUser(parsed);
  }, []);

  // Load pending CLs + full history for this employee
  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const [pendingData, historyData] = await Promise.all([
          apiRequest('/api/cl/employee/pending', { method: 'GET' }),
          apiRequest('/api/cl/employee/my/history', { method: 'GET' }),
        ]);

        setPendingCL(pendingData || []);
        setClHistory(historyData || []);
      } catch (err) {
        console.error(err);
        setError(
          'Failed to load your dashboard data. Please check /api/cl/employee/pending and /api/cl/employee/my/history routes.'
        );
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
      loadNotifications();
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
    } else {
      // Navigate to the URL for other actions
      goTo(action.url || '/employee');
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
    } finally {
      goTo(n?.url || '/employee');
    }
  }

  function closeNotificationModal() {
    setNotificationModalState({ open: false, notification: null });
  }

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  if (!user) {
    return null; // wait for auth check
  }

  // If you ever want only rows where employee actually acted:
  // const employeeActivity = clHistory.filter(
  //   (row) => row.employee_decision != null && row.employee_decision !== ''
  // );
  const employeeActivity = clHistory;

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT SIDEBAR - Navigation */}
      <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-blue-600">FUTURA</h2>
          <p className="text-xs text-gray-500 mt-1">Employee Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveView('pending')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded transition
                       ${
                         activeView === 'pending'
                           ? 'bg-blue-50 text-blue-700'
                           : 'text-gray-700 hover:bg-gray-100'
                       }`}
          >
            <ClipboardDocumentCheckIcon className="w-5 h-5" />
            <span>Pending Reviews</span>
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded transition
                       ${
                         activeView === 'history'
                           ? 'bg-blue-50 text-blue-700'
                           : 'text-gray-700 hover:bg-gray-100'
                       }`}
          >
            <CheckCircleIcon className="w-5 h-5" />
            <span>My Activity</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded
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
              Employee Dashboard
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

        {/* CONDITIONAL CONTENT BASED ON VIEW */}
        {activeView === 'pending' ? (
          /* Pending CLs for Employee Review */
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Pending Competency Leveling Review
            </h2>
            {pendingCL.length === 0 ? (
              <p className="text-sm text-gray-600">
                No pending competency leveling forms for your review.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Supervisor</Th>
                      <Th>Department</Th>
                      <Th>Submitted At</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingCL.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <Td>{item.supervisor_name}</Td>
                        <Td>{item.department_name}</Td>
                        <Td>
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : '-'}
                        </Td>
                        <Td>
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                            {item.status}
                          </span>
                        </Td>
                        <Td>
                          <button
                            type="button"
                            onClick={() => goTo(`/cl/employee/review/${item.id}`)}
                            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                          >
                            Review
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
          /* Employee CL Activity / History */
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              My Competency Leveling Activity
            </h2>
            {employeeActivity.length === 0 ? (
              <p className="text-sm text-gray-600">
                You don&apos;t have any competency leveling activity yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>CL ID</Th>
                      <Th>Cycle</Th>
                      <Th>Status</Th>
                      <Th>Employee Decision</Th>
                      <Th>Employee Decided At</Th>
                      <Th>Total Score</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employeeActivity.map((cl) => (
                      <tr key={cl.id} className="hover:bg-gray-50">
                        <Td>{cl.id}</Td>
                        <Td>{cl.cycle_name || cl.cycle_id || '-'}</Td>
                        <Td>{cl.status || '-'}</Td>
                        <Td>{cl.employee_decision || '-'}</Td>
                        <Td>
                          {cl.employee_decided_at
                            ? new Date(cl.employee_decided_at).toLocaleString()
                            : '-'}
                        </Td>
                        <Td>
                          {cl.total_score != null ? cl.total_score : '-'}
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

          <div className="flex-1 p-4 overflow-y-auto space-y-2 no-scrollbar">
            {recentActions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No recent actions.</p>
            ) : (
              recentActions.map((a, idx) => (
                <button
                  key={`${a.id}-${idx}`}
                  type="button"
                  onClick={() => handleRecentActionClick(a)}
                  className="w-full text-left px-3 py-2 rounded text-sm
                             bg-gray-50 hover:bg-gray-100 transition"
                >
                  <p className="font-medium text-gray-800 truncate">{a.title || 'Action'}</p>
                  {a.description && (
                    <p className="text-[12px] text-gray-600 line-clamp-2">{a.description}</p>
                  )}
                  {a.created_at && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  )}
                </button>
              ))
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
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
        
        <div className="flex-1 overflow-y-auto p-6">
          {recentActions.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No recent actions found.</p>
          ) : (
            <div className="space-y-3">
              {recentActions.map((a, idx) => (
                <button
                  key={`${a.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    onActionClick(a);
                    if (!a.title || !a.title.toLowerCase().includes('deleted')) {
                      onClose();
                    }
                  }}
                  className="w-full text-left p-4 rounded-lg border border-gray-200
                             bg-white hover:bg-gray-50 transition shadow-sm hover:shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 mb-1">{a.title || 'Action'}</p>
                      {a.description && (
                        <p className="text-sm text-gray-600 mb-2">{a.description}</p>
                      )}
                      {a.created_at && (
                        <p className="text-xs text-gray-400">
                          {new Date(a.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {a.title && a.title.toLowerCase().includes('deleted') && (
                      <span className="ml-4 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                        Deleted
                      </span>
                    )}
                  </div>
                </button>
              ))}
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

export default EmployeeDashboard;
