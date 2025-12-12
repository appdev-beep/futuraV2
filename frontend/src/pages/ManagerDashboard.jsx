// src/pages/ManagerDashboard.jsx
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

function ManagerDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    clPending: 0,
    clInProgress: 0,
    clApproved: 0
  });
  const [pendingCL, setPendingCL] = useState([]);
  const [allCL, setAllCL] = useState([]); // <-- all CLs (we'll filter for history)

  // Only these roles can access Manager dashboard
  const managerRoles = ['Manager', 'HR', 'Admin'];

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
      alert('Only Managers / HR / Admin can access this page.');
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
        // GET /api/cl/manager/summary
        // GET /api/cl/manager/pending
        // GET /api/cl/manager/all        <-- includes manager_decision for history
        const [clSummary, clPending, clAll] = await Promise.all([
          apiRequest('/api/cl/manager/summary'),
          apiRequest('/api/cl/manager/pending'),
          apiRequest('/api/cl/manager/all')
        ]);

        setSummary({
          clPending: clSummary.clPending || 0,
          clInProgress: clSummary.clInProgress || 0,
          clApproved: clSummary.clApproved || 0
        });

        setPendingCL(clPending || []);
        setAllCL(clAll || []);
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
  // HELPERS
  // ==========================
  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  function goTo(url) {
    window.location.href = url;
  }

  if (!user) return null;

  // HISTORY:
  // Show ALL CLs where this manager already acted (APPROVED or RETURNED)
  const managerHistory = allCL.filter(
    (item) => item.manager_decision != null && item.manager_decision !== ''
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">FUTURA</h2>
          <p className="text-sm text-gray-500">{user.role}</p>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 p-4 space-y-2">
          {/* Manager CL Dashboard */}
          <button
            onClick={() => goTo('/manager')}
            className="w-full flex items-center gap-3 px-4 py-2 rounded 
                       text-gray-700 hover:bg-gray-100 transition"
          >
            <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-600" />
            <span>CL Approvals</span>
          </button>

          {/* (Optional) add other modules e.g. IDP, reports, etc. */}
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
        <h1 className="text-2xl font-bold text-gray-800">Manager Dashboard</h1>
        <p className="text-gray-600 mb-6">
          Welcome, {user.name} ({user.employee_id})
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && <p>Loading...</p>}

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <SummaryCard
            icon={ClipboardDocumentCheckIcon}
            label="CL – Pending for Manager"
            value={summary.clPending}
          />
          <SummaryCard
            icon={CheckCircleIcon}
            label="CL – Approved by Manager"
            value={summary.clApproved}
          />
          <SummaryCard
            icon={XCircleIcon}
            label="CL – In Progress / Others"
            value={summary.clInProgress}
          />
        </section>

        {/* PENDING CL TABLE */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">
            Competency Leveling – Pending Manager Approval
          </h2>

          {pendingCL.length === 0 ? (
            <p className="text-gray-500">
              No CL submissions currently pending Manager approval.
            </p>
          ) : (
            <PendingTable data={pendingCL} goTo={goTo} />
          )}
        </section>

        {/* HISTORY TABLE – MANAGER ACTIVITY LOG */}
        <section>
          <h2 className="text-xl font-semibold mb-3">
            Manager Activity Log (Approvals & Returns)
          </h2>

          {managerHistory.length === 0 ? (
            <p className="text-gray-500">
              No CL actions recorded for this manager yet.
            </p>
          ) : (
            <HistoryTable data={managerHistory} goTo={goTo} />
          )}
        </section>
      </main>
    </div>
  );
}

/* ----------------- Reusable Components ----------------- */

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white p-4 rounded shadow-sm flex items-center gap-3">
      <div className="p-2 rounded-full bg-blue-50">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <h3 className="text-sm text-gray-500">{label}</h3>
        <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

function PendingTable({ data, goTo }) {
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
                  onClick={() => goTo(`/cl/submissions/${item.id}`)}
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

export default ManagerDashboard;
