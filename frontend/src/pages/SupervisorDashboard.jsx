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
    clApproved: 0,
    idpCount: 0,          // 👈 now for IDP count
  });
  const [clByStatus, setClByStatus] = useState({});

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
        const [clSummary, clGrouped] = await Promise.all([
          apiRequest('/api/cl/supervisor/summary'),
          apiRequest('/api/cl/supervisor/all')
        ]);

        setSummary({
          clPending: clSummary.clPending || 0,
          clInProgress: clSummary.clInProgress || 0,
          clApproved: clSummary.clApproved || 0,
          idpCount: clSummary.idpCount || 0,   // 👈 read IDP count from backend
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

  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  function goTo(url) {
    window.location.href = url;
  }

  async function handleDeleteCL(clId, clStatus) {
    if (!window.confirm('Are you sure you want to delete this CL? This action cannot be undone.')) {
      return;
    }

    try {
      await apiRequest(`/api/cl/${clId}`, { method: 'DELETE' });
      alert('CL deleted successfully');
      // Reload the dashboard
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to delete CL');
    }
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white">

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
        </section>

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

        {/* PENDING CL TABLE */}
        <section>
          <h2 className="text-xl font-semibold mb-3">All Competency Levelings</h2>

          {Object.keys(clByStatus).length === 0 ? (
            <p className="text-gray-500">No CLs found.</p>
          ) : (
            Object.entries(clByStatus).map(([status, items]) => (
              <div key={status} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">{status}</h3>
                <CLTable data={items} goTo={goTo} onDelete={handleDeleteCL} />
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

/* COMPONENTS BELOW ---------------------------------------------------- */

function SummaryCard({ label, value, gradientClass }) {
  return (
    <div
      className={`p-4 rounded shadow-md bg-gradient-to-r ${gradientClass}`}
    >
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
              <Td>{new Date(item.submitted_at).toLocaleString()}</Td>

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
                    onClick={() => onDelete(item.id, item.status)}
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
              <Td>{new Date(item.submitted_at).toLocaleString()}</Td>

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
                    onClick={() => onDelete(item.id, item.status)}
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

export default SupervisorDashboard;
