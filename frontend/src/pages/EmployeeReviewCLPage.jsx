// src/pages/EmployeeReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';

function EmployeeReviewCLPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [cl, setCl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState('');

  // ==========================
  // AUTH GUARD
  // ==========================
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(stored);
    if (parsed.role !== 'Employee') {
      alert('Only Employees can review CLs.');
      window.location.href = '/';
      return;
    }

    setUser(parsed);
  }, []);

  // ==========================
  // LOAD CL DETAILS
  // ==========================
  useEffect(() => {
    if (!user) return;

    async function loadCL() {
      try {
        const data = await apiRequest(`/api/cl/${id}`, { method: 'GET' });
        setCl(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load CL details.');
      } finally {
        setLoading(false);
      }
    }

    loadCL();
  }, [user, id]);

  function goBack() {
    window.location.href = '/employee';
  }

  // ==========================
  // ACTION HANDLERS
  // ==========================
  async function handleApprove() {
    if (!window.confirm('Approve this CL?')) return;

    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/employee/approve`, {
        method: 'POST',
        body: JSON.stringify({ remarks })
      });
      alert('CL approved successfully.');
      goBack();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to approve CL.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReturn() {
    if (!remarks.trim()) {
      alert('Please provide remarks before returning.');
      return;
    }

    if (!window.confirm('Return this CL to the supervisor?')) return;

    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/employee/return`, {
        method: 'POST',
        body: JSON.stringify({ remarks })
      });
      alert('CL returned to supervisor.');
      goBack();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to return CL.');
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================
  // RENDERING
  // ==========================
  if (!user) return null;

  if (loading) return <p className="p-4">Loading...</p>;

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-2">{error}</p>
        <button
          onClick={goBack}
          className="px-4 py-2 rounded bg-gray-600 text-white"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!cl) {
    return (
      <div className="p-4">
        <p className="text-gray-600">CL not found.</p>
        <button
          onClick={goBack}
          className="mt-2 px-4 py-2 rounded bg-gray-600 text-white"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const {
    id: clId,
    status,
    employee_name,
    employee_id,
    items,
    supervisor_remarks,
    manager_remarks,
  } = cl;

  const totalScore = (items || []).reduce(
    (sum, it) => sum + (Number(it.score) || 0),
    0
  );

  return (
    <div className="max-w-6xl mx-auto p-8">
      <button
        onClick={goBack}
        className="mb-4 px-4 py-2 rounded border border-gray-300 text-sm"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-2xl font-bold mb-2">CL Review – #{clId}</h1>
      <p className="text-sm text-gray-600 mb-4">
        Status: <strong>{status}</strong>
      </p>

      {/* Employee Info */}
      <div className="bg-white rounded shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Employee Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Name</p>
            <p className="font-medium">{employee_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-600">Employee ID</p>
            <p className="font-medium">{employee_id || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Supervisor & Manager Remarks (read-only) */}
      {(supervisor_remarks || manager_remarks) && (
        <div className="bg-white rounded shadow-sm p-6 mb-6 text-sm">
          {supervisor_remarks && (
            <div className="mb-4">
              <h2 className="font-semibold text-yellow-800 mb-1">
                Supervisor Remarks
              </h2>
              <p className="text-gray-800 whitespace-pre-wrap">
                {supervisor_remarks}
              </p>
            </div>
          )}

          {manager_remarks && (
            <div>
              <h2 className="font-semibold text-blue-800 mb-1">
                Manager Remarks
              </h2>
              <p className="text-gray-800 whitespace-pre-wrap">
                {manager_remarks}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Competencies Table */}
      <div className="bg-white rounded shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Competencies</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Competency</th>
              <th className="px-4 py-2 text-left font-semibold">MPLR</th>
              <th className="px-4 py-2 text-left font-semibold">Assigned</th>
              <th className="px-4 py-2 text-left font-semibold">Weight</th>
              <th className="px-4 py-2 text-left font-semibold">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items || []).map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-2">{it.competency_name}</td>
                <td className="px-4 py-2">{it.required_level}</td>
                <td className="px-4 py-2">{it.assigned_level}</td>
                <td className="px-4 py-2">
                  {Number(it.weight || 0).toFixed(2)}%
                </td>
                <td className="px-4 py-2">
                  {Number(it.score || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-right font-semibold">
          Total Score: {totalScore.toFixed(2)}
        </p>
      </div>

      {/* Remarks Section (Employee) */}
      <div className="bg-white rounded shadow-sm p-6 mb-6">
        <label className="block text-sm font-semibold mb-2">
          Your Remarks{' '}
          {status === 'PENDING_EMPLOYEE' && (
            <span className="text-red-600">*</span>
          )}
        </label>
        <textarea
          className="w-full border rounded p-3 text-sm"
          rows="5"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Enter your remarks or leave empty to approve..."
        ></textarea>
      </div>

      {/* Action Buttons */}
      {status === 'PENDING_EMPLOYEE' && (
        <div className="flex gap-4">
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="px-6 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={handleReturn}
            disabled={actionLoading}
            className="px-6 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Return for Revision'}
          </button>
        </div>
      )}
    </div>
  );
}

export default EmployeeReviewCLPage;
