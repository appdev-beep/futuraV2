// src/pages/SupervisorDashboard.jsx
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import {
  ClipboardDocumentCheckIcon,
  BookOpenIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

function SupervisorDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    clPending: 0,
    clInProgress: 0,
    clApproved: 0
  });
  const [pendingCL, setPendingCL] = useState([]);

  const supervisorRoles = ['Supervisor', 'AM', 'Manager', 'HR'];

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(stored);
    if (!supervisorRoles.includes(parsed.role)) {
      alert('Only Supervisors and related roles can access this page.');
      window.location.href = '/';
      return;
    }

    setUser(parsed);
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      try {
        const [clSummary, clPending] = await Promise.all([
          apiRequest('/api/cl/supervisor/summary'),
          apiRequest('/api/cl/supervisor/pending')
        ]);

        setSummary({
          clPending: clSummary.clPending || 0,
          clInProgress: clSummary.clInProgress || 0,
          clApproved: clSummary.clApproved || 0
        });

        setPendingCL(clPending || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load Supervisor dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user]);

  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  function goTo(url) {
    window.location.href = url;
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-100">

      {/* CLEAN SOFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">

        {/* HEADER */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">FUTURA</h2>
          <p className="text-sm text-gray-500">{user.role}</p>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 p-4 space-y-2">

          {/* Competency Leveling */}
          <button
            onClick={() => goTo('/supervisor')}
            className="w-full flex items-center gap-3 px-4 py-2 rounded 
                       text-gray-700 hover:bg-gray-100 transition"
          >
            <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-600" />
            <span>Competency Leveling</span>
          </button>

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
        <h1 className="text-2xl font-bold text-gray-800">Supervisor Dashboard</h1>
        <p className="text-gray-600 mb-6">
          Welcome, {user.name} ({user.employee_id})
        </p>

        {error && <div className="text-red-600 mb-4">{error}</div>}
        {loading && <p>Loading...</p>}

        {/* MAIN ACTION BUTTONS */}
        <section className="flex flex-wrap gap-3 mb-8">
          <button
            className="px-4 py-2 rounded text-white 
                       bg-gradient-to-r from-blue-500 to-blue-700 
                       hover:from-blue-600 hover:to-blue-800"
            onClick={() => goTo('/cl/start')}

          >
            Start Competency Leveling
          </button>

          <button
            className="px-4 py-2 rounded text-white 
                       bg-gradient-to-r from-blue-400 to-blue-600 
                       hover:from-blue-500 hover:to-blue-700"
            onClick={() => goTo('/cl/my-submissions')}
          >
            View My CL Submissions
          </button>

          <button
            className="px-4 py-2 rounded text-white 
                       bg-gradient-to-r from-purple-500 to-purple-700 
                       hover:from-purple-600 hover:to-purple-800"
            onClick={() => goTo('/supervisor')}
          >
            Pending CL Approvals
          </button>
        </section>

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <SummaryCard label="CL – Pending" value={summary.clPending} />
          <SummaryCard label="CL – In Progress" value={summary.clInProgress} />
          <SummaryCard label="CL – Approved" value={summary.clApproved} />
        </section>

        {/* PENDING CL TABLE */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Pending CL Approvals</h2>

          {pendingCL.length === 0 ? (
            <p className="text-gray-500">No pending CL approvals.</p>
          ) : (
            <PendingTable data={pendingCL} goTo={goTo} />
          )}
        </section>
      </main>
    </div>
  );
}

/* COMPONENTS BELOW ---------------------------------------------------- */

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white p-4 rounded shadow-md">
      <h3 className="text-sm text-gray-500">{label}</h3>
      <p className="text-3xl font-semibold text-gray-900 mt-1">{value}</p>
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
                  Review
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

export default SupervisorDashboard;
