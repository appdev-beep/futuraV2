// src/pages/AMDashboard.jsx
import { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../api/client';
import { BellIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';

function AMDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCL, setPendingCL] = useState([]);
  const [summary, setSummary] = useState({
    clPending: 0,
    clApproved: 0,
    clReturned: 0
  });

  // Notifications and Recent Actions
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  const [notificationModalState, setNotificationModalState] = useState({
    open: false,
    notification: null,
  });
  const [showFullNotifications, setShowFullNotifications] = useState(false);
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);

  // Auth check – must be logged in and AM
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(storedUser);

    if (parsed.role !== 'AM') {
      window.location.href = '/';
      return;
    }

    setUser(parsed);
  }, []);

  // Load pending CLs for AM review
  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const [clSummary, clPending] = await Promise.all([
          apiRequest('/api/cl/am/summary', { method: 'GET' }),
          apiRequest('/api/cl/am/pending', { method: 'GET' })
        ]);

        setSummary({
          clPending: clSummary.clPending || 0,
          clApproved: clSummary.clApproved || 0,
          clReturned: clSummary.clReturned || 0
        });

        setPendingCL(clPending || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load Assistant Manager dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user]);

  // Load notifications (polling every 15 seconds)
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

  // Load recent actions
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

  async function proceedToNotificationLink(n) {
    setNotificationModalState({ open: false, notification: null });
    goTo(n?.url || '/am');
  }

  function closeNotificationModal() {
    setNotificationModalState({ open: false, notification: null });
  }

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  function goTo(url) {
    window.location.href = url;
  }

  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <header className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Assistant Manager Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Welcome, <span className="font-semibold">{user.name}</span> (
                {user.employee_id})
              </p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
            >
              Logout
            </button>
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

          {/* Pending CLs for AM Review */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Pending CL Approvals
            </h2>
            {pendingCL.length === 0 ? (
              <p className="text-sm text-gray-600">
                No pending competency leveling forms for your approval.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Employee</Th>
                      <Th>Supervisor</Th>
                      <Th>Department</Th>
                      <Th>Submitted At</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingCL.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <Td>{item.employee_name}</Td>
                        <Td>{item.supervisor_name}</Td>
                        <Td>{item.department_name}</Td>
                        <Td>
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : '-'}
                        </Td>
                        <Td>
                          <button
                            type="button"
                            onClick={() => goTo(`/cl/am/review/${item.id}`)}
                            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
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
        </div>
      </div>

      {/* Right Sidebar - Notifications & Recent Actions */}
      <aside className="w-72 bg-white border-l border-gray-200 flex flex-col">
        {/* TOP: NOTIFICATIONS */}
        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <button
            onClick={() => setShowFullNotifications(!showFullNotifications)}
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
            onClick={() => setShowFullRecentActions(!showFullRecentActions)}
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
                  onClick={() => goTo(a.url)}
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

      {/* Notification Modal */}
      {notificationModalState.open && notificationModalState.notification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Notification</h3>
            <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap">
              {notificationModalState.notification.message}
            </p>

            {/* Extract CL ID from message */}
            {(() => {
              const msg = notificationModalState.notification.message || '';
              const match = msg.match(/CL #(\d+)/);
              const clId = match ? match[1] : null;
              return clId ? (
                <a
                  href={`/cl/am/review/${clId}`}
                  className="text-blue-600 hover:underline text-sm mb-4 block"
                >
                  View CL #{clId}
                </a>
              ) : null;
            })()}

            <div className="flex gap-2 justify-end">
              <button
                onClick={closeNotificationModal}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
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

export default AMDashboard;
