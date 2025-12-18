// src/pages/AMReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import Modal from '../components/Modal';

function AMReviewCLPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const viewOnly = searchParams.get('viewOnly') === 'true';
  const [user, setUser] = useState(null);
  const [cl, setCl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type, isConfirm: false, onConfirm: null });
  };

  const showConfirmModal = (title, message, onConfirm, type = 'warning') => {
    setModal({ isOpen: true, title, message, type, isConfirm: true, onConfirm });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(stored);
    if (parsed.role !== 'AM') {
      showModal('Access Denied', 'Only Assistant Managers can review CLs.', 'error');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }

    setUser(parsed);
  }, []);

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
    window.location.href = '/am';
  }

  function confirmApprove() {
    showConfirmModal('Confirm Approval', 'Approve this CL?', executeApprove, 'info');
  }

  async function executeApprove() {
    closeModal();
    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/am/approve`, {
        method: 'POST',
        body: JSON.stringify({ remarks })
      });
      showModal('Success', 'CL approved successfully.', 'success');
      setTimeout(() => goBack(), 2000);
    } catch (err) {
      console.error(err);
      showModal('Error', err.message || 'Failed to approve CL.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  function confirmReturn() {
    if (!remarks.trim()) {
      showModal('Validation Error', 'Please provide remarks before returning.', 'warning');
      return;
    }
    showConfirmModal('Confirm Return', 'Return this CL to the supervisor?', executeReturn, 'warning');
  }

  async function executeReturn() {
    closeModal();
    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/am/return`, {
        method: 'POST',
        body: JSON.stringify({ remarks })
      });
      showModal('Success', 'CL returned to supervisor.', 'success');
      setTimeout(() => goBack(), 2000);
    } catch (err) {
      console.error(err);
      showModal('Error', err.message || 'Failed to return CL.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  if (!user) return null;

  if (loading) return <p className="p-4">Loading...</p>;

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-2">{error}</p>
        <button onClick={goBack} className="px-4 py-2 rounded bg-gray-600 text-white">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!cl) {
    return (
      <div className="p-4">
        <p className="text-gray-600">CL not found.</p>
        <button onClick={goBack} className="mt-2 px-4 py-2 rounded bg-gray-600 text-white">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { header, items } = cl;
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
                CL Review – #{header.id}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Status: <strong>{header.status}</strong>
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

            {/* Employee & Supervisor Info */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Employee Information</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Employee Name</p>
                  <p className="font-medium text-slate-800">{header.employee_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Supervisor</p>
                  <p className="font-medium text-slate-800">{header.supervisor_name || 'N/A'}</p>
                </div>
              </div>
            </div>

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
                    </tr>
                  </thead>

                  <tbody className="bg-white">
                    {(items || []).map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="px-2 py-1 text-slate-800">{it.competency_name}</td>
                        <td className="px-2 py-1 text-slate-700">{it.mplr_level}</td>
                        <td className="px-2 py-1 text-slate-700">{it.assigned_level}</td>
                        <td className="px-2 py-1 text-slate-700">{it.weight}</td>
                        <td className="px-2 py-1 font-semibold text-blue-600">{Number(it.score || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Remarks Section */}
            {!viewOnly && (
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <label className="block text-xs font-medium mb-1 text-slate-700">
                  Remarks {header.status === 'PENDING_AM' && <span className="text-red-600">*</span>}
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
                  This CL is being viewed in read-only mode.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {!viewOnly && header.status === 'PENDING_AM' && (
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-2">
              <button
                onClick={confirmApprove}
                disabled={actionLoading}
                className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={confirmReturn}
                disabled={actionLoading}
                className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? 'Processing...' : 'Return for Revision'}
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        isConfirm={modal.isConfirm}
      />
    </div>
  );
}

export default AMReviewCLPage;
