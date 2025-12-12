// src/pages/EmployeeDashboard.jsx
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import '../index.css';
import '../App.css'; 

function EmployeeDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCL, setPendingCL] = useState([]);
  const [clHistory, setClHistory] = useState([]); // includes decision fields

  // Auth check – must be logged in and Employee
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(storedUser);

    if (parsed.role !== 'Employee') {
      alert('Only Employees can access this page.');
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

  function goTo(url) {
    window.location.href = url;
  }

  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  if (!user) {
    return null; // wait for auth check
  }

  // If you ever want only rows where employee actually acted:
  // const employeeActivity = clHistory.filter(
  //   (row) => row.employee_decision != null && row.employee_decision !== ''
  // );
  const employeeActivity = clHistory;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Employee Dashboard
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

      {/* Pending CLs for Employee Review */}
      <section className="mb-8">
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

      {/* Employee CL Activity / History */}
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

export default EmployeeDashboard;
