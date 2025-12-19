// src/pages/EmployeeReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';

function EmployeeReviewCLPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const viewOnly = searchParams.get('viewOnly') === 'true';
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
    employee_email,
    department_name,
    position_title,
    items,
    supervisor_remarks,
    manager_remarks,
  } = cl;

  const totalScore = (items || []).reduce(
    (sum, it) => sum + (Number(it.score) || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
            <div>
              <h1 className="text-lg font-semibold text-slate-800">
                CL Review – #{clId}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Status: <strong>{status}</strong>
              </p>
            </div>
            <button
              onClick={goBack}
              className="text-slate-500 hover:text-slate-700 px-4 py-2 rounded-md hover:bg-slate-100 text-sm transition"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 overflow-y-auto space-y-4">

            {/* Employee Info */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Employee Information</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Name</p>
                  <p className="font-medium text-slate-800">{employee_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Employee ID</p>
                  <p className="font-medium text-slate-800">{employee_id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium text-slate-800">{employee_email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Position</p>
                  <p className="font-medium text-slate-800">{position_title || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Department</p>
                  <p className="font-medium text-slate-800">{department_name || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Supervisor & Manager Remarks (read-only) */}
            {supervisor_remarks && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-1 text-yellow-800">
                  Supervisor Remarks
                </h3>
                <p className="text-sm text-yellow-900 whitespace-pre-wrap">
                  {supervisor_remarks}
                </p>
              </div>
            )}

            {manager_remarks && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-1 text-blue-800">
                  Manager Remarks
                </h3>
                <p className="text-sm text-blue-900 whitespace-pre-wrap">
                  {manager_remarks}
                </p>
              </div>
            )}

            {/* Competencies Table */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Competency Assessment</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                  <thead className="bg-slate-100 uppercase text-[11px] text-slate-700">
                    <tr>
                      <th className="px-2 py-1 text-left">Competency</th>
                      <th className="px-2 py-1 text-left">MPLR</th>
                      <th className="px-2 py-1 text-left">Assigned</th>
                      <th className="px-2 py-1 text-left">Weight (%)</th>
                      <th className="px-2 py-1 text-left">Score</th>
                      <th className="px-2 py-1 text-left">Justification</th>
                      <th className="px-2 py-1 text-left">PDF</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white">
                    {(items || []).map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="px-2 py-1 text-slate-800">{it.competency_name}</td>
                        <td className="px-2 py-1 text-slate-700">{it.required_level}</td>
                        <td className="px-2 py-1 text-slate-700">{it.assigned_level}</td>
                        <td className="px-2 py-1 text-slate-700">{Number(it.weight || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 font-semibold text-blue-600">{Number(it.score || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-slate-700">{it.justification || '—'}</td>
                        <td className="px-2 py-1">
                          {it.pdf_path ? (
                            <a
                              href={`${import.meta.env.VITE_API_BASE_URL}/${it.pdf_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              View PDF
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">No file</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-700">
                <strong>Total Score:</strong> {totalScore.toFixed(2)}
              </p>
            </div>
            {/* Remarks Section (Employee) */}
            {!viewOnly && (
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <label className="block text-xs font-medium mb-1 text-slate-700">
                  Your Remarks{' '}
                  {status === 'PENDING_EMPLOYEE' && (
                    <span className="text-red-600">*</span>
                  )}
                </label>
                <textarea
                  className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows="3"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter your remarks or leave empty to approve..."
                ></textarea>
              </div>
            )}

            {viewOnly && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  View only - This is a historical record from recent actions.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {!viewOnly && status === 'PENDING_EMPLOYEE' && (
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-2">
              <button
                onClick={handleApproveClick}
                disabled={actionLoading}
                className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={handleReturnClick}
                disabled={actionLoading}
                className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? 'Processing...' : 'Return for Revision'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">
              {confirmModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Return'}
            </h3>
            <p className="text-slate-600 mb-6 text-sm">
              {confirmModal.action === 'approve'
                ? 'Are you sure you want to approve this CL?'
                : 'Are you sure you want to return this CL to the supervisor?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmModal({ open: false, action: null })}
                className="px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.action === 'approve' ? handleApprove : handleReturn}
                className={`px-4 py-2 rounded-md text-white text-sm shadow-sm ${
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className={`text-lg font-semibold mb-4 ${
              messageModal.isError ? 'text-red-600' : 'text-green-600'
            }`}>
              {messageModal.isError ? 'Error' : 'Success'}
            </h3>
            <p className="text-slate-600 mb-6 text-sm">{messageModal.message}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setMessageModal({ open: false, message: '', isError: false })}
                className="px-4 py-2 rounded-md bg-slate-600 text-white hover:bg-slate-700 text-sm shadow-sm"
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
