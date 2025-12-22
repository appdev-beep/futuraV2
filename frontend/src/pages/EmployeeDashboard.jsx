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
import Modal from '../components/Modal';
import { displayStatus } from '../utils/statusHelper';

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

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileDetails, setProfileDetails] = useState(null);
  const [selectedCL, setSelectedCL] = useState(null);
  const [selectedCLLoading, setSelectedCLLoading] = useState(false);

  const [activeView, setActiveView] = useState('pending'); // 'pending' or 'history'
  const [currentCompetencies, setCurrentCompetencies] = useState(null);
  const [approvedCompetencies, setApprovedCompetencies] = useState(null);
  const [competenciesLoading, setCompetenciesLoading] = useState(false);
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

    // Kick off dashboard load
    loadDashboard();
  }, [user]);

  // ==========================
  // LOAD NOTIFICATIONS
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

  // Load competencies for employee and split into current (in-flow) and approved
  useEffect(() => {
    if (!user) return;

    async function loadCompetencies() {
      setCompetenciesLoading(true);
      try {
        const data = await apiRequest(`/api/cl/employee/${user.id}/competencies`, { method: 'GET' });
        const all = data?.competencies || [];

        // Determine approved items from API
        const approvedFromApi = all.filter((c) => {
          const s = String(c.status || c.approval_status || '').toLowerCase();
          if (s.includes('approved')) return true;
          if (c.approved === true) return true;
          if (c.approved_at) return true;
          return false;
        });

        // Determine current/in-flow items from API (not approved)
        const currentFromApi = all.filter((c) => !approvedFromApi.includes(c));

        // Also derive competencies from CL history by fetching CL details
        const clHistorySource = Array.isArray(clHistory) ? clHistory : [];
        const clToFetch = clHistorySource.slice(0, 25); // limit to recent 25 CLs to avoid too many requests
        const clDetails = await Promise.all(
          clToFetch.map(async (cl) => {
            try {
              const d = await apiRequest(`/api/cl/${cl.id}`);
              return { header: cl, details: d };
            } catch (e) {
              return { header: cl, details: null };
            }
          })
        );

        const currentFromCLs = [];
        const approvedFromCLs = [];

        for (const pair of clDetails) {
          const cl = pair.header;
          const d = pair.details;
          const s = String(cl.status || '').toLowerCase();
          const items = (d && Array.isArray(d.items)) ? d.items : [];

          if (s.includes('approved')) {
            for (const it of items) {
              approvedFromCLs.push({
                id: it.competency_id || it.id || null,
                competency_name: it.competency_name || it.name || it.competency || null,
                approved_level: it.assigned_level || it.approved_level || it.mplr || null,
                approved_at: cl.approved_at || cl.updated_at || cl.decision_at || null,
                notes: it.justification || it.description || it.notes || null,
              });
            }
          } else {
            for (const it of items) {
              currentFromCLs.push({
                id: it.competency_id || it.id || null,
                competency_name: it.competency_name || it.name || it.competency || null,
                current_level: it.current_level || it.assigned_level || it.mplr || null,
                suggested_level: it.suggested_level || it.mplr || null,
                notes: it.justification || it.description || it.notes || null,
              });
            }
          }
        }

        // Merge API + CL-derived lists and dedupe by competency_name or id
        const keyFor = (c) => (c.id ? String(c.id) : (c.competency_name ? `name:${c.competency_name}` : JSON.stringify(c)));

        const mergedCurrent = [...currentFromApi.map(c => ({ ...c })), ...currentFromCLs];
        const seenCurrent = new Set();
        const uniqueCurrent = [];
        for (const c of mergedCurrent) {
          const k = keyFor(c);
          if (!seenCurrent.has(k)) {
            seenCurrent.add(k);
            uniqueCurrent.push(c);
          }
        }

        const mergedApproved = [...approvedFromApi.map(c => ({ ...c })), ...approvedFromCLs];
        const seenApproved = new Set();
        const uniqueApproved = [];
        for (const c of mergedApproved) {
          const k = keyFor(c);
          if (!seenApproved.has(k)) {
            seenApproved.add(k);
            uniqueApproved.push(c);
          }
        }

        setApprovedCompetencies(uniqueApproved);
        setCurrentCompetencies(uniqueCurrent);
      } catch (err) {
        console.error('Failed to load competencies:', err);
        setApprovedCompetencies([]);
        setCurrentCompetencies([]);
      } finally {
        setCompetenciesLoading(false);
      }
    }

    // Only load when user is present; keep cached between views
    loadCompetencies();
  }, [user, pendingCL, clHistory]);

  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  function goTo(url) {
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    if (currentPath === targetPath) {
      window.location.reload();
      return;
    }
    window.location.href = url;
  }

  async function openProfileModal() {
    setShowProfileModal(true);
    setProfileLoading(true);
    try {
      const data = await apiRequest(`/api/users/${user?.id}`);
      setProfileDetails(data || user);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setProfileDetails(user);
    } finally {
      setProfileLoading(false);
    }
  }

  function closeProfileModal() {
    setShowProfileModal(false);
    setProfileDetails(null);
  }

  async function handleNotificationClick(n) {
    // Mark notification as read
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/notifications/${n.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
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
    const url = action.url || '/employee';
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
    const url = n?.url || '/employee';
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

  // open profile modal when user presses View Profile
  // (uses clHistory already loaded above)

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
          <button
            onClick={() => setActiveView('current')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded transition
                       ${
                         activeView === 'current'
                           ? 'bg-blue-50 text-blue-700'
                           : 'text-gray-700 hover:bg-gray-100'
                       }`}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m2 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Current Competencies</span>
          </button>
          <button
            onClick={() => setActiveView('approved')}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded transition
                       ${
                         activeView === 'approved'
                           ? 'bg-blue-50 text-blue-700'
                           : 'text-gray-700 hover:bg-gray-100'
                       }`}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Approved Competencies</span>
          </button>
          {/* Past CLs removed per user request */}
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Employee Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">
                Welcome, <span className="font-semibold">{user.name}</span> ({user.employee_id})
              </p>
            </div>

            <div>
              <button
                onClick={openProfileModal}
                title="View profile"
                aria-label="View profile"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
              >
                {user && user.name ? (
                  <span>{user.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}</span>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 6.196 9 9 0 015.12 17.804z" />
                  </svg>
                )}
              </button>
            </div>
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

        <ProfileModal
          open={showProfileModal}
          userData={profileDetails || user}
          clHistory={clHistory}
          loading={profileLoading}
          onClose={closeProfileModal}
          goTo={goTo}
          displayStatus={displayStatus}
        />

        {/* Current Competencies View */}
        {activeView === 'current' && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Current Competencies</h2>
            {competenciesLoading ? (
              <p className="text-sm text-gray-600">Loading competencies…</p>
            ) : (currentCompetencies && currentCompetencies.length > 0) ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Competency</Th>
                      <Th>Current Level</Th>
                      <Th>Suggested MPLR</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentCompetencies.map((c, i) => (
                      <tr key={c.id || i} className="hover:bg-gray-50">
                        <Td>{c.competency_name || c.name || '-'}</Td>
                        <Td>{c.current_level || c.mplr || '-'}</Td>
                        <Td>{c.suggested_level || c.mplr || '-'}</Td>
                        <Td className="text-xs text-gray-600">{c.notes || c.description || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-600">No current competencies in flow.</p>
            )}
          </section>
        )}

        {/* Approved Competencies View */}
        {activeView === 'approved' && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Approved Competencies</h2>
            {competenciesLoading ? (
              <p className="text-sm text-gray-600">Loading competencies…</p>
            ) : (approvedCompetencies && approvedCompetencies.length > 0) ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Competency</Th>
                      <Th>Approved Level</Th>
                      <Th>Approved On</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {approvedCompetencies.map((c, i) => (
                      <tr key={c.id || i} className="hover:bg-gray-50">
                        <Td>{c.competency_name || c.name || '-'}</Td>
                        <Td>{c.approved_level || c.assigned_level || c.mplr || '-'}</Td>
                        <Td>{c.approved_at ? new Date(c.approved_at).toLocaleString() : (c.approved_on ? new Date(c.approved_on).toLocaleString() : '-')}</Td>
                        <Td className="text-xs text-gray-600">{c.notes || c.description || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-600">No approved competencies found.</p>
            )}
          </section>
        )}

        {/* CONDITIONAL CONTENT BASED ON VIEW */}

        {activeView === 'pending' && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Pending Competency Leveling Review</h2>
            {pendingCL.length === 0 ? (
              <p className="text-sm text-gray-600">No pending competency leveling forms for your review.</p>
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
                        <Td>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</Td>
                        <Td>
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">{displayStatus(item.status)}</span>
                        </Td>
                        <Td>
                          <button type="button" onClick={() => goTo(`/cl/employee/review/${item.id}`)} className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">Review</button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeView === 'history' && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">My Competency Leveling Activity</h2>
            {selectedCLLoading ? (
              <div className="p-6 text-center text-gray-500">Loading CL details…</div>
            ) : selectedCL ? (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">CL Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">CL ID:</span>
                      <span className="ml-2 font-medium text-gray-800">{selectedCL.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Cycle:</span>
                      <span className="ml-2 font-medium text-gray-800">{selectedCL.cycle_name || selectedCL.cycle_id || ''}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2 font-medium text-blue-600">{displayStatus(selectedCL.status)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Score:</span>
                      <span className="ml-2 font-medium text-green-600">{selectedCL.total_score != null ? Number(selectedCL.total_score).toFixed(2) : ''}</span>
                    </div>
                  </div>
                </div>

                {selectedCL.items && selectedCL.items.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 p-4 border-b border-gray-200">Competency Assessment Items</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Competency</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Weight (%)</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Level</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Score</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Comments</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedCL.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-800">{item.competency_name || ''}</td>
                              <td className="px-4 py-3 text-center text-gray-700">{item.weight || 0}%</td>
                              <td className="px-4 py-3 text-center font-medium text-blue-600">{item.assigned_level || ''}</td>
                              <td className="px-4 py-3 text-center font-semibold text-green-600">{((item.weight/100) * item.assigned_level).toFixed(2)}</td>
                              <td className="px-4 py-3 text-gray-700 text-xs">{item.justification || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : employeeActivity.length === 0 ? (
              <p className="text-sm text-gray-600">You don&apos;t have any competency leveling activity yet.</p>
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
                        <Td>{displayStatus(cl.status) || '-'}</Td>
                        <Td>{cl.employee_decision || '-'}</Td>
                        <Td>{cl.employee_decided_at ? new Date(cl.employee_decided_at).toLocaleString() : '-'}</Td>
                        <Td>{cl.total_score != null ? cl.total_score : '-'}</Td>
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

// Profile modal for viewing complete employee information
function ProfileModal({ open, userData, clHistory, loading, onClose, goTo, displayStatus }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-50 bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Employee Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading profile…</p>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold">Basic Information</h4>
                <div className="space-y-2 mt-2 text-sm">
                  <div className="flex justify-between">
                    <div className="text-slate-600">Name:</div>
                    <div className="font-medium text-right">{userData?.name || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Employee ID:</div>
                    <div className="font-medium text-right">{userData?.employee_id || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Email:</div>
                    <div className="font-medium text-right">{userData?.email || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Position:</div>
                    <div className="font-medium text-right">{userData?.position_title || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Department:</div>
                    <div className="font-medium text-right">{userData?.department_name || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Supervisor:</div>
                    <div className="font-medium text-right">{userData?.supervisor_name || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Past competencies moved to sidebar */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeDashboard;
