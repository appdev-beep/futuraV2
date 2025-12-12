// src/pages/SupervisorDashboard.jsx
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import {
  ClipboardDocumentCheckIcon,
  BookOpenIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
} from '@heroicons/react/24/outline';

import '../index.css';
import '../App.css';

function SupervisorDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    clPending: 0,
    clInProgress: 0,
    clApproved: 0,
    idpCount: 0,
  });
  const [clByStatus, setClByStatus] = useState({});
  const [notifications, setNotifications] = useState([]);

  // ✅ NEW: recent actions (all departments)
  const [recentActions, setRecentActions] = useState([]);

  // Modal state
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

  // List of statuses we want to always show as tables
  // key = exact backend status string
  // label = nice text to show in UI
  const CL_STATUS_SECTIONS = [
    { key: 'DRAFT', label: 'Draft' },
    { key: 'PENDING_EMPLOYEE', label: 'Pending – Employee' },
    { key: 'PENDING_HR', label: 'Pending – HR' },
    { key: 'PENDING_MANAGER', label: 'Pending – Manager' },
    { key: 'APPROVED', label: 'Approved' },
  ];

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(stored);
    if (!supervisorRoles.includes(parsed.role)) {
      // No alert, just redirect
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
          clInProgress: clSummary.clInProgress || 0,
          clApproved: clSummary.clApproved || 0,
          idpCount: clSummary.idpCount || 0,
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

  // Load notifications (for the right sidebar)
  useEffect(() => {
    if (!user) return;

    async function loadNotifications() {
      try {
        const data = await apiRequest('/api/notifications'); // adjust URL if needed
        setNotifications(data || []);
      } catch (err) {
        console.error('Failed to load notifications', err);
      }
    }

    loadNotifications();
  }, [user]);

  // ✅ NEW: Load recent actions (for the bottom right panel)
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

  // Helpers for modal
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
    if (fn) {
      await fn();
    }
  }

  // ✅ ALLOW DELETE FOR ALL STATUSES (backend must permit)
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
            onConfirm: () => {
              window.location.reload();
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

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">FUTURA</h2>
          <p className="text-sm text-gray-500">{user.role}</p>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 p-4 space-y-4">
          {/* Competency Leveling + Start */}
          <div className="space-y-1">
            <button
              onClick={() => goTo('/supervisor')}
              className="w-full flex items-center gap-3 px-4 py-2 rounded
                         text-gray-700 hover:bg-gray-100 transition"
            >
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-600" />
              <span>Competency Leveling</span>
            </button>

            {/* Start Competency Leveling */}
            <button
              onClick={() => goTo('/cl/start')}
              className="w-full flex items-center gap-2 pl-10 pr-4 py-1.5 rounded
                         text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
            >
              <span>➤ Start Competency Leveling</span>
            </button>
          </div>

          {/* IDP Leveling */}
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
        {/* Top header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Supervisor Dashboard</h1>
            <p className="text-gray-600">
              Welcome, {user.name} ({user.employee_id})
            </p>
          </div>

          {/* Right side: user info + logout */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2
                         px-3 py-2 rounded bg-red-600 text-white
                         text-sm hover:bg-red-700 transition"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {error && <div className="text-red-600 mb-4">{error}</div>}
        {loading && <p>Loading...</p>}

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="CL – Pending"
            value={summary.clPending}
            gradientClass="from-yellow-400 to-orange-500"
          />
          <SummaryCard
            label="CL – In Progress"
            value={summary.clInProgress}
            gradientClass="from-blue-400 to-blue-700"
          />
          <SummaryCard
            label="CL – Approved"
            value={summary.clApproved}
            gradientClass="from-emerald-400 to-emerald-700"
          />
          <SummaryCard
            label="IDP – Count"
            value={summary.idpCount}
            gradientClass="from-purple-400 to-purple-700"
          />
        </section>

        {/* ALL CL TABLES BY STATUS */}
        <section>
          <h2 className="text-xl font-semibold mb-3">All Competency Levelings</h2>

          {CL_STATUS_SECTIONS.map(({ key, label }) => {
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
          })}
        </section>
      </main>

      {/* RIGHT SIDEBAR – SPLIT: NOTIFICATIONS (TOP) + RECENT ACTIONS (BOTTOM) */}
      <aside className="w-72 bg-white border-l border-gray-200 flex flex-col">
        {/* TOP: NOTIFICATIONS */}
        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-semibold text-gray-700">Notifications</span>
            </div>
            {notifications.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500 text-white">
                {notifications.length}
              </span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-2 no-scrollbar">
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No notifications.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => goTo(n.url || '/supervisor')}
                  className="w-full text-left px-3 py-2 rounded text-sm
                             bg-gray-50 hover:bg-gray-100 transition"
                >
                  <p className="font-medium text-gray-800 truncate">
                    {n.title || 'Notification'}
                  </p>
                  {n.created_at && (
                    <p className="text-[11px] text-gray-400">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* BOTTOM: RECENT ACTIONS */}
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
              recentActions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => goTo(a.url || '/supervisor')}
                  className="w-full text-left px-3 py-2 rounded text-sm
                             bg-gray-50 hover:bg-gray-100 transition"
                >
                  <p className="font-medium text-gray-800 truncate">{a.title || 'Action'}</p>

                  {a.description && (
                    <p className="text-[12px] text-gray-600 line-clamp-2">
                      {a.description}
                    </p>
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

      {/* Global Modal */}
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

/* COMPONENTS BELOW ---------------------------------------------------- */

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
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <Td>{item.employee_name}</Td>
              <Td>{item.employee_code || item.employee_id}</Td>
              <Td>{item.department_name}</Td>
              <Td>{item.position_title}</Td>
              <Td>{item.status}</Td>

              {/* ✅ Safe date rendering */}
              <Td>
                {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '-'}
              </Td>

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

                  {/* ✅ Delete always available */}
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

// (Unused, but kept if needed elsewhere)
function PendingTable({ data, goTo, onDelete }) {
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
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <Td>{item.employee_name}</Td>
              <Td>{item.employee_code || item.employee_id}</Td>
              <Td>{item.department_name}</Td>
              <Td>{item.position_title}</Td>
              <Td>{item.status}</Td>

              {/* ✅ Safe date rendering */}
              <Td>
                {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '-'}
              </Td>

              <Td>
                <div className="flex gap-2">
                  <button
                    onClick={() => goTo(`/cl/submissions/${item.id}`)}
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

// Simple reusable modal
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
