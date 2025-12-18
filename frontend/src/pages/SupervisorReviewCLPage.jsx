// src/pages/SupervisorReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import Modal from '../components/Modal';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
function SupervisorReviewCLPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewOnly = searchParams.get('viewOnly') === 'true';
  const [user, setUser] = useState(null);
  const [cl, setCl] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // separate remarks state:
  const [resubmitRemarks, setResubmitRemarks] = useState(''); // when CL is DRAFT
  const [returnRemarks, setReturnRemarks] = useState('');     // when CL is PENDING_MANAGER
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
    if (!['Supervisor', 'Admin'].includes(parsed.role)) {
      showModal('Access Denied', 'Only Supervisors can view this page.', 'error');
      setTimeout(() => window.location.href = '/', 2000);
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
        const [clData, trail] = await Promise.all([
          apiRequest(`/api/cl/${id}`, { method: 'GET' }),
          apiRequest(`/api/cl/${id}/audit-trail`, { method: 'GET' })
        ]);
        
        setCl(clData);
        setAuditTrail(trail || []);

        // if there are existing supervisor remarks, you can optionally prefill
        if (clData.supervisor_remarks) {
          setResubmitRemarks(clData.supervisor_remarks);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load CL details.');
      } finally {
        setLoading(false);
      }
    }

    loadCL();
  }, [user, id]);

  // ==========================
  // APPROVE HANDLER
  // (This is the “manager approve” style action; if you
  //  keep it, it just moves CL forward without remarks)
  // ==========================
  function confirmApprove() {
    showConfirmModal('Confirm Approval', 'Are you sure you want to approve this CL?', executeApprove, 'info');
  }

  async function executeApprove() {
    closeModal();
    setActionLoading(true);
    try {
      await apiRequest(`/api/cl/${id}/manager/approve`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      showModal('Success', 'CL approved successfully!', 'success');
      setTimeout(() => navigate('/supervisor'), 2000);
    } catch (err) {
      console.error(err);
      showModal('Error', err.message || 'Failed to approve CL', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================
  // RETURN HANDLER (to employee)
  // ==========================
  function confirmReturn() {
    if (!returnRemarks.trim()) {
      showModal('Validation Error', 'Please provide remarks before returning the CL', 'warning');
      return;
    }
    showConfirmModal('Confirm Return', 'Are you sure you want to return this CL to the employee?', executeReturn, 'warning');
  }

  async function executeReturn() {
    closeModal();
    setActionLoading(true);
    try {
      await apiRequest(`/api/cl/${id}/manager/return`, {
        method: 'POST',
        body: JSON.stringify({ remarks: returnRemarks })
      });
      showModal('Success', 'CL returned successfully!', 'success');
      setTimeout(() => navigate('/supervisor'), 2000);
    } catch (err) {
      console.error(err);
      showModal('Error', err.message || 'Failed to return CL', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================
  // RESUBMIT HANDLER (after being returned)
  // status === 'DRAFT'
  // ==========================
  function confirmResubmit() {
    showConfirmModal('Confirm Resubmission', 'Are you sure you want to resubmit this CL?', executeResubmit, 'info');
  }

  async function executeResubmit() {
    closeModal();
    setActionLoading(true);
    try {
      // 1) Save items
      await apiRequest(`/api/cl/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ items: cl.items })
      });

      // 2) Resubmit with supervisor remarks
      await apiRequest(`/api/cl/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ remarks: resubmitRemarks })
      });

      showModal('Success', 'CL resubmitted successfully!', 'success');
      setTimeout(() => navigate('/supervisor'), 2000);
    } catch (err) {
      console.error(err);
      showModal('Error', err.message || 'Failed to resubmit CL', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================
  // RENDER STATES
  // ==========================
  if (!user) return null;
  if (loading) return <div className="p-8">Loading CL...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!cl) return <div className="p-8">CL not found</div>;

  // Normalize / destructure for readability
  const {
    status,
    employee_name,
    employee_id,
    department_name,
    position_title,
    items = [],
    supervisor_remarks,
    manager_remarks,
    employee_remarks,
    hr_remarks,
    updated_at,
  } = cl;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
            <div>
              <h1 className="text-lg font-semibold text-slate-800">Review CL</h1>
              <p className="text-xs text-slate-500 mt-0.5">Status: <strong>{status}</strong></p>
            </div>
            <button
              onClick={() => navigate('/supervisor')}
              className="text-slate-500 hover:text-slate-700 px-4 py-2 rounded-md hover:bg-slate-100 text-sm transition"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 overflow-y-auto space-y-4">

            {/* EMPLOYEE INFO */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Employee Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-600">Employee Name:</span>
                  <span className="ml-2 font-medium text-slate-800">{employee_name}</span>
                </div>
                <div>
                  <span className="text-slate-600">Employee ID:</span>
                  <span className="ml-2 font-medium text-slate-800">{employee_id}</span>
                </div>
                <div>
                  <span className="text-slate-600">Department:</span>
                  <span className="ml-2 font-medium text-slate-800">{department_name}</span>
                </div>
                <div>
                  <span className="text-slate-600">Position:</span>
                  <span className="ml-2 font-medium text-slate-800">{position_title}</span>
                </div>
              </div>
            </div>

            {/* REMARKS HISTORY (READ-ONLY) */}
            {(supervisor_remarks || manager_remarks || employee_remarks || hr_remarks) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-2 text-slate-700">Remarks History</h3>

                {supervisor_remarks && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-semibold text-yellow-800">Supervisor Remarks</h4>
                      {updated_at && (
                        <span className="text-[10px] text-slate-500">
                          {new Date(updated_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap">
                      {supervisor_remarks}
                    </p>
                  </div>
                )}

                {manager_remarks && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-semibold text-blue-800">Manager Remarks</h4>
                      {updated_at && (
                        <span className="text-[10px] text-slate-500">
                          {new Date(updated_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap">
                      {manager_remarks}
                    </p>
                  </div>
                )}

                {employee_remarks && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-semibold text-green-800">Employee Remarks</h4>
                      {updated_at && (
                        <span className="text-[10px] text-slate-500">
                          {new Date(updated_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap">
                      {employee_remarks}
                    </p>
                  </div>
                )}

                {hr_remarks && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-semibold text-purple-800">HR Remarks</h4>
                      {updated_at && (
                        <span className="text-[10px] text-slate-500">
                          {new Date(updated_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap">
                      {hr_remarks}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* AUDIT TRAIL / PROCESS HISTORY */}
            {auditTrail.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-2 text-slate-700">Process History</h3>
                <div className="space-y-2">
                  {auditTrail.map((event, idx) => {
                    const actionLabel = event.action_type.replace(/_/g, ' ');
                    const actionColor = 
                      event.action_type.includes('APPROVED') ? 'text-green-600' :
                      event.action_type.includes('RETURNED') ? 'text-red-600' :
                      'text-blue-600';
                    
                    return (
                      <div key={idx} className="flex gap-3 pb-2 border-b border-slate-100 last:border-0">
                        <div className="flex-shrink-0 w-28 text-[10px] text-slate-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold text-xs ${actionColor}`}>
                            {actionLabel}
                          </p>
                          <p className="text-xs text-slate-700">
                            by <span className="font-medium">{event.actor_name}</span> ({event.actor_role})
                          </p>
                          {event.remarks && (
                            <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                              Remarks: {event.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COMPETENCIES TABLE */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Competency Assessment</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                  <thead className="bg-slate-100 uppercase text-[11px] text-slate-700">
                    <tr>
                      <th className="px-2 py-1 text-left">Competency</th>
                      <th className="px-2 py-1 text-left">MPLR</th>
                      <th className="px-2 py-1 text-left">Level</th>
                      <th className="px-2 py-1 text-left">Weight (%)</th>
                      <th className="px-2 py-1 text-left">Score</th>
                      <th className="px-2 py-1 text-left">Comments (Justification / Trainings / Certificates, Etc)</th>
                      <th className="px-2 py-1 text-left">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-slate-800">{item.competency_name}</td>
                    <td className="px-2 py-1 text-slate-700">{item.required_level}</td>
                    <td className="px-2 py-1">
                      {status === 'DRAFT' ? (
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={item.assigned_level}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].assigned_level = Number(e.target.value);
                            updated[idx].score =
                              (Number(updated[idx].weight) / 100) *
                              Number(updated[idx].assigned_level);
                            setCl({ ...cl, items: updated });
                          }}
                          className="w-14 px-1 py-0.5 border border-slate-200 rounded text-xs text-slate-800"
                        />
                      ) : item.assigned_level}
                    </td>
                    <td className="px-2 py-1">
                      {status === 'DRAFT' ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={item.weight}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].weight = Number(e.target.value);
                            updated[idx].score =
                              (Number(updated[idx].weight) / 100) *
                              Number(updated[idx].assigned_level);
                            setCl({ ...cl, items: updated });
                          }}
                          className="w-16 px-1 py-0.5 border border-slate-200 rounded text-xs text-slate-800"
                        />
                      ) : `${Number(item.weight || 0).toFixed(2)}%`}
                    </td>
                    <td className="px-2 py-1 font-semibold text-blue-600">
                      {Number(item.score || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-1">
                      {status === 'DRAFT' ? (
                        <textarea
                          value={item.justification || ''}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].justification = e.target.value;
                            setCl({ ...cl, items: updated });
                          }}
                          className="w-full px-1 py-0.5 border border-slate-200 rounded text-xs text-slate-800 resize-y min-h-[40px]"
                        />
                      ) : (item.justification || '—')}
                    </td>
                    <td className="px-2 py-1">
                      {item.pdf_path ? (
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL}/${item.pdf_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          View
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
            </div>


            {/* ACTIONS - DRAFT (resubmit) */}
            {status === 'DRAFT' && !viewOnly && (
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-2 text-slate-700">Resubmission</h3>
                <p className="text-xs text-slate-600 mb-3">
                  This CL has been returned for revision. You may modify the competencies
                  and add optional remarks for the next reviewer, then resubmit when ready.
                </p>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Supervisor Remarks for Resubmission (optional)
                  </label>
                  <textarea
                    value={resubmitRemarks}
                    onChange={(e) => setResubmitRemarks(e.target.value)}
                    placeholder="Add any notes or clarification for the next reviewer..."
                    className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows="3"
                  />
                </div>

                <button
                  onClick={confirmResubmit}
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 shadow-sm"
                >
                  {actionLoading ? 'Processing...' : 'Resubmit CL'}
                </button>
              </div>
            )}


            {/* ACTIONS - PENDING_MANAGER (approve/return) */}
            {status === 'PENDING_MANAGER' && !viewOnly && (
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-2 text-slate-700">Approval Actions</h3>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Remarks (required for returning)
                  </label>
                  <textarea
                    value={returnRemarks}
                    onChange={(e) => setReturnRemarks(e.target.value)}
                    placeholder="Enter remarks if you're returning this CL..."
                    className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows="3"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={confirmApprove}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 shadow-sm"
                  >
                    {actionLoading ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={confirmReturn}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-md disabled:opacity-50 shadow-sm"
                  >
                    {actionLoading ? 'Processing...' : 'Return'}
                  </button>
                </div>
              </div>
            )}

            {/* VIEW ONLY - For other statuses or viewOnly mode */}
            {(viewOnly || !['DRAFT', 'PENDING_MANAGER'].includes(status)) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-sm text-slate-600">
                  {viewOnly ? (
                    <span>View only - This is a historical record from recent actions.</span>
                  ) : (
                    <span>This CL is in <strong>{status}</strong> status. View only - no actions available.</span>
                  )}
                </p>
              </div>
            )}
          </div>
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

export default SupervisorReviewCLPage;
