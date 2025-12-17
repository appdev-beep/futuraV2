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
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null });
  const [messageModal, setMessageModal] = useState({ open: false, message: '', isError: false });

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
  function handleApproveClick() {
    setConfirmModal({ open: true, action: 'approve' });
  }

  async function handleApprove() {
    setConfirmModal({ open: false, action: null });

    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/employee/approve`, {
        method: 'POST',
        body: JSON.stringify({ remarks })
      });
      setMessageModal({ open: true, message: 'CL approved successfully.', isError: false });
      setTimeout(() => goBack(), 1500);
    } catch (err) {
      console.error(err);
      setMessageModal({ open: true, message: err.message || 'Failed to approve CL.', isError: true });
    } finally {
      setActionLoading(false);
    }
  }

  function handleReturnClick() {
    if (!remarks.trim()) {
      setMessageModal({ open: true, message: 'Please provide remarks before returning.', isError: true });
      return;
    }
    setConfirmModal({ open: true, action: 'return' });
  }

  async function handleReturn() {
    setConfirmModal({ open: false, action: null });

    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/employee/return`, {
        method: 'POST',
        body: JSON.stringify({ remarks })
      });
      setMessageModal({ open: true, message: 'CL returned to supervisor.', isError: false });
      setTimeout(() => goBack(), 1500);
    } catch (err) {
      console.error(err);
      setMessageModal({ open: true, message: err.message || 'Failed to return CL.', isError: true });
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
      <div className="bg-white border border-gray-200 p-6 mb-6">
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
        <div className="bg-white border border-gray-200 p-6 mb-6 text-sm">
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
      <div className="bg-white border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Competencies</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Competency</th>
              <th className="px-4 py-2 text-left font-semibold">MPLR</th>
              <th className="px-4 py-2 text-left font-semibold">Assigned</th>
              <th className="px-4 py-2 text-left font-semibold">Weight</th>
              <th className="px-4 py-2 text-left font-semibold">Score</th>
              <th className="px-4 py-2 text-left font-semibold">Justification</th>
              <th className="px-4 py-2 text-left font-semibold">PDF</th>
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
                <td className="px-4 py-2">{it.justification || '—'}</td>
                <td className="px-4 py-2">
                  {it.pdf_path ? (
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL}/${it.pdf_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View PDF
                    </a>
                  ) : (
                    <span className="text-gray-400 text-xs">No file</span>
                  )}
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
            onClick={handleApproveClick}
            disabled={actionLoading}
            className="px-6 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={handleReturnClick}
            disabled={actionLoading}
            className="px-6 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Return for Revision'}
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {confirmModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Return'}
            </h3>
            <p className="text-gray-600 mb-6">
              {confirmModal.action === 'approve'
                ? 'Are you sure you want to approve this CL?'
                : 'Are you sure you want to return this CL to the supervisor?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmModal({ open: false, action: null })}
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.action === 'approve' ? handleApprove : handleReturn}
                className={`px-4 py-2 rounded text-white ${
                  confirmModal.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {messageModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className={`text-lg font-semibold mb-4 ${
              messageModal.isError ? 'text-red-600' : 'text-green-600'
            }`}>
              {messageModal.isError ? 'Error' : 'Success'}
            </h3>
            <p className="text-gray-600 mb-6">{messageModal.message}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setMessageModal({ open: false, message: '', isError: false })}
                className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700"
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

export default EmployeeReviewCLPage;
