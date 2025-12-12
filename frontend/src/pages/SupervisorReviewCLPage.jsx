// src/pages/SupervisorReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
function SupervisorReviewCLPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cl, setCl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // separate remarks state:
  const [resubmitRemarks, setResubmitRemarks] = useState(''); // when CL is DRAFT
  const [returnRemarks, setReturnRemarks] = useState('');     // when CL is PENDING_MANAGER

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
      alert('Only Supervisors can view this page.');
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

        // if there are existing supervisor remarks, you can optionally prefill
        if (data.supervisor_remarks) {
          setResubmitRemarks(data.supervisor_remarks);
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
  async function handleApprove() {
    if (!window.confirm('Are you sure you want to approve this CL?')) return;

    setActionLoading(true);
    try {
      await apiRequest(`/api/cl/${id}/manager/approve`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      alert('CL approved successfully!');
      navigate('/supervisor');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to approve CL');
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================
  // RETURN HANDLER (to employee)
  // ==========================
  async function handleReturn() {
    if (!returnRemarks.trim()) {
      alert('Please provide remarks before returning the CL');
      return;
    }
    if (!window.confirm('Are you sure you want to return this CL to the employee?')) return;

    setActionLoading(true);
    try {
      await apiRequest(`/api/cl/${id}/manager/return`, {
        method: 'POST',
        body: JSON.stringify({ remarks: returnRemarks })
      });
      alert('CL returned successfully!');
      navigate('/supervisor');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to return CL');
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================
  // RESUBMIT HANDLER (after being returned)
  // status === 'DRAFT'
  // ==========================
  async function handleResubmit() {
    if (!window.confirm('Are you sure you want to resubmit this CL?')) return;

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

      alert('CL resubmitted successfully!');
      navigate('/supervisor');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to resubmit CL');
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
    pdf_path,
    supervisor_remarks,
    manager_remarks,
    employee_remarks,
    hr_remarks,
  } = cl;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* HEADER */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review CL</h1>
            <p className="text-sm text-gray-500 mt-1">Status: {status}</p>
          </div>
          <button
            onClick={() => navigate('/supervisor')}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded text-gray-900"
          >
            Back
          </button>
        </div>

        {/* EMPLOYEE INFO */}
        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Employee Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Employee Name</p>
              <p className="font-semibold">{employee_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Employee ID</p>
              <p className="font-semibold">{employee_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Department</p>
              <p className="font-semibold">{department_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Position</p>
              <p className="font-semibold">{position_title}</p>
            </div>
          </div>
        </div>

        {/* REMARKS HISTORY (READ-ONLY) */}
        {(supervisor_remarks || manager_remarks || employee_remarks || hr_remarks) && (
          <div className="bg-white rounded shadow p-6 mb-6 text-sm">
            <h2 className="text-lg font-semibold mb-4">Remarks History</h2>

            {supervisor_remarks && (
              <div className="mb-3">
                <h3 className="font-semibold text-yellow-800 mb-1">Supervisor Remarks</h3>
                <p className="text-gray-800 whitespace-pre-wrap">
                  {supervisor_remarks}
                </p>
              </div>
            )}

            {manager_remarks && (
              <div className="mb-3">
                <h3 className="font-semibold text-blue-800 mb-1">Manager Remarks</h3>
                <p className="text-gray-800 whitespace-pre-wrap">
                  {manager_remarks}
                </p>
              </div>
            )}

            {employee_remarks && (
              <div className="mb-3">
                <h3 className="font-semibold text-green-800 mb-1">Employee Remarks</h3>
                <p className="text-gray-800 whitespace-pre-wrap">
                  {employee_remarks}
                </p>
              </div>
            )}

            {hr_remarks && (
              <div>
                <h3 className="font-semibold text-purple-800 mb-1">HR Remarks</h3>
                <p className="text-gray-800 whitespace-pre-wrap">
                  {hr_remarks}
                </p>
              </div>
            )}
          </div>
        )}

        {/* COMPETENCIES TABLE */}
        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Competencies</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Competency</th>
                  <th className="px-4 py-2 text-left font-semibold">Required Level</th>
                  <th className="px-4 py-2 text-left font-semibold">Assigned Level</th>
                  <th className="px-4 py-2 text-left font-semibold">Weight (%)</th>
                  <th className="px-4 py-2 text-left font-semibold">Score</th>
                  <th className="px-4 py-2 text-left font-semibold">Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{item.competency_name}</td>
                    <td className="px-4 py-2">{item.required_level}</td>
                    <td className="px-4 py-2">
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
                          className="w-16 px-2 py-1 border rounded"
                        />
                      ) : item.assigned_level}
                    </td>
                    <td className="px-4 py-2">
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
                          className="w-20 px-2 py-1 border rounded"
                        />
                      ) : `${Number(item.weight || 0).toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-2">
                      {Number(item.score || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      {status === 'DRAFT' ? (
                        <input
                          type="text"
                          value={item.justification || ''}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].justification = e.target.value;
                            setCl({ ...cl, items: updated });
                          }}
                          className="w-full px-2 py-1 border rounded"
                        />
                      ) : (item.justification || '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PDF SECTION */}
{pdf_path && (
  <div className="bg-white rounded shadow p-6 mb-6">
    <h2 className="text-lg font-semibold mb-4">CL Document</h2>
    <a
      href={`${import.meta.env.VITE_API_BASE_URL}/${pdf_path}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
    >
      View PDF
    </a>
  </div>
)}


        {/* ACTIONS - DRAFT (resubmit) */}
        {status === 'DRAFT' && (
          <div className="bg-white rounded shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Resubmission</h2>
            <p className="text-sm text-gray-600 mb-4">
              This CL has been returned for revision. You may modify the competencies
              and add optional remarks for the next reviewer, then resubmit when ready.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supervisor Remarks for Resubmission (optional)
              </label>
              <textarea
                value={resubmitRemarks}
                onChange={(e) => setResubmitRemarks(e.target.value)}
                placeholder="Add any notes or clarification for the next reviewer..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
              />
            </div>

            <button
              onClick={handleResubmit}
              disabled={actionLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Resubmit CL'}
            </button>
          </div>
        )}

        {/* ACTIONS - PENDING_MANAGER (approve/return) */}
        {status === 'PENDING_MANAGER' && (
          <div className="bg-white rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Approval Actions</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks (required for returning)
              </label>
              <textarea
                value={returnRemarks}
                onChange={(e) => setReturnRemarks(e.target.value)}
                placeholder="Enter remarks if you're returning this CL..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="4"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={handleReturn}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Return'}
              </button>
            </div>
          </div>
        )}

        {/* VIEW ONLY - For other statuses */}
        {!['DRAFT', 'PENDING_MANAGER'].includes(status) && (
          <div className="bg-gray-50 rounded border border-gray-200 p-6 text-center text-gray-600">
            This CL is in {status} status and cannot be modified.
          </div>
        )}
      </div>
    </div>
  );
}

export default SupervisorReviewCLPage;
