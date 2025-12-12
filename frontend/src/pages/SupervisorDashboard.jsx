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
} from '@heroicons/react/24/outline';

import '../index.css';
import '../App.css';

function SupervisorDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState({
    clPending: 0,
    clApproved: 0,
  });

  const [clByStatus, setClByStatus] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);

  const [activeSection, setActiveSection] = useState('ALL');

  const [modalState, setModalState] = useState({
    open: false,
    title: '',
    message: '',
    showCancel: false,
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: null,
  });

  const supervisorRoles = ['Supervisor', 'AM', 'Manager', 'HR'];

  const CL_STATUS_SECTIONS = [
    { key: 'DRAFT', label: 'Draft', icon: PencilSquareIcon },
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
        const [clSummary, clGrouped] = await Promise.all([
          apiRequest('/api/cl/supervisor/summary'),
          apiRequest('/api/cl/supervisor/all'),
        ]);

        setSummary({
          clPending: clSummary.clPending || 0,
          clApproved: clSummary.clApproved || 0,
        });

        setClByStatus(clGrouped || {});
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

  async function handleDeleteCL(clId) {
    openModal({
      title: 'Delete CL',
      message: 'Are you sure you want to delete this CL? This action cannot be undone.',
      showCancel: true,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await apiRequest(`/api/cl/${clId}`, { method: 'DELETE' });
          openModal({
            title: 'Deleted',
            message: 'CL deleted successfully.',
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
    try {
      if (n?.id) {
        await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
      }
    } catch (_) {
      // ignore
    } finally {
      goTo(n?.url || '/supervisor');
    }
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
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">FUTURA</h2>
          <p className="text-sm text-gray-500">{user.role}</p>
        </div>

        <nav className="p-4 space-y-4 overflow-y-auto">
          {/* Competency Leveling */}
          <div className="space-y-1">
            <button
              onClick={() => goTo('/supervisor')}
              className="w-full flex items-center gap-3 px-4 py-2 rounded
                         text-gray-700 hover:bg-gray-100 transition"
            >
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-600" />
              <span>Competency Leveling</span>
            </button>

            {/* ✅ REPLACE THE "Start" SLOT WITH OPTIONS */}
            <div className="ml-10 pr-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
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
                {CL_STATUS_SECTIONS.map(({ key, label, icon: Icon }) => (
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
                ))}
              </div>

              {/* Keep Start button, but place it AFTER the options */}
              <button
                onClick={() => goTo('/cl/start')}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded
                           text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
              >
                <span>➤ Start boombomodmfosd Competency Leveling</span>
              </button>
            </div>
          </div>

          {/* IDP */}
          <button
            onClick={() => goTo('/idp')}
            className="w-full flex items-center gap-3 px-4 py-2 rounded
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

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <SummaryCard
            label="CL – Pending"
            value={summary.clPending}
            gradientClass="from-yellow-400 to-orange-500"
          />
          <SummaryCard
            label="CL – Approved"
            value={summary.clApproved}
            gradientClass="from-emerald-400 to-emerald-700"
          />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">{activeLabel}</h2>

          {activeSection === 'ALL' ? (
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
      <aside className="w-72 bg-white border-l border-gray-200 flex flex-col">
        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-semibold text-gray-700">Notifications</span>
            </div>

            {unreadCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500 text-white">
                {unreadCount}
              </span>
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
                    <p className="font-medium text-gray-800 truncate">
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
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Recent Actions</span>
            {recentActions.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white">
                {recentActions.length}
              </span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-2 no-scrollbar">
            {recentActions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No recent actions.</p>
            ) : (
              recentActions.map((a, idx) => (
                <button
                  key={`${a.id}-${idx}`}
                  type="button"
                  onClick={() => goTo(a.url || '/supervisor')}
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
              <Td>{item.employee_name}</Td>
              <Td>{item.employee_code || item.employee_id}</Td>
              <Td>{item.department_name}</Td>
              <Td>{item.position_title}</Td>
              <Td>{item.status}</Td>
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

export default SupervisorDashboard;
