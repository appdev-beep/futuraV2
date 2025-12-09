// src/pages/HRDashboard.jsx
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

function HRDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCL, setPendingCL] = useState([]);
  const [summary, setSummary] = useState({
    clPending: 0,
    clApproved: 0,
    clReturned: 0
  });

  // Auth check – must be logged in and HR
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(storedUser);

    if (parsed.role !== 'HR') {
      alert('Only HR can access this page.');
      window.location.href = '/';
      return;
    }

    setUser(parsed);
  }, []);

  // Load pending CLs for HR review
  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const [clSummary, clPending] = await Promise.all([
          apiRequest('/api/cl/hr/summary', { method: 'GET' }),
          apiRequest('/api/cl/hr/pending', { method: 'GET' })
        ]);

        setSummary({
          clPending: clSummary.clPending || 0,
          clApproved: clSummary.clApproved || 0,
          clReturned: clSummary.clReturned || 0
        });

        setPendingCL(clPending || []);
      } catch (err) {
        console.error(err);
        setError(
          'Failed to load HR dashboard data.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user]);

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
    <div className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            HR Dashboard
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

      {/* Pending CLs for HR Review */}
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
                        onClick={() => goTo(`/cl/hr/review/${item.id}`)}
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

export default HRDashboard;
