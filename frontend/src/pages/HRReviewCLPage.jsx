// src/pages/HRReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';

function HRReviewCLPage() {
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
    if (parsed.role !== 'HR' && parsed.role !== 'Admin') {
      alert('Only HR can review CLs.');
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

        // Normalize header to safely read hr_remarks
        const header = data.header || data;
        if (header.hr_remarks) {
          setRemarks(header.hr_remarks);
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

  function goBack() {
    window.location.href = '/hr';
  }

  // ==========================
  // APPROVE HANDLER
  // ==========================
  async function handleApprove() {
    if (!window.confirm('Approve this CL? This will enable IDP creation for the employee.')) return;

    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/hr/approve`, {
        method: 'POST',
        body: JSON.stringify({ remarks }),
      });
      alert('CL approved successfully. Employee can now create IDP.');
      goBack();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to approve CL.');
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================
  // RETURN HANDLER
  // ==========================
  async function handleReturn() {
    if (!remarks.trim()) {
      alert('Please provide remarks before returning.');
      return;
    }

    if (!window.confirm('Return this CL to the supervisor?')) return;

    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/hr/return`, {
        method: 'POST',
        body: JSON.stringify({ remarks }),
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
  // RENDER STATES
  // ==========================
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

  // ==========================
  // NORMALIZED DATA
  // ==========================
  const header = cl.header || cl;
  const items = cl.items || [];

  const {
    supervisor_remarks,
    manager_remarks,
    employee_remarks,
    hr_remarks,
  } = header;

  const totalScore = items.reduce(
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

      <h1 className="text-2xl font-bold mb-2">
        CL Final Review – #{header.id}
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        Status: <strong>{header.status}</strong>
      </p>

      {/* Employee & Supervisor Info */}
      <div className="bg-white rounded shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Employee Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Employee Name</p>
            <p className="font-medium">{header.employee_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-600">Supervisor</p>
            <p className="font-medium">{header.supervisor_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-600">Department</p>
            <p className="font-medium">{header.department_name || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* All Previous Remarks (read-only) */}
      {(supervisor_remarks || manager_remarks || employee_remarks || hr_remarks) && (
        <div className="bg-white rounded shadow-sm p-6 mb-6 text-sm">
          <h2 className="text-lg font-semibold mb-3">Remarks History</h2>

          {supervisor_remarks && (
            <div className="mb-3">
              <p className="font-semibold text-yellow-800">Supervisor Remarks</p>
              <p className="text-gray-800 whitespace-pre-wrap">
                {supervisor_remarks}
              </p>
            </div>
          )}

          {manager_remarks && (
            <div className="mb-3">
              <p className="font-semibold text-blue-800">Manager Remarks</p>
              <p className="text-gray-800 whitespace-pre-wrap">
                {manager_remarks}
              </p>
            </div>
          )}

          {employee_remarks && (
            <div className="mb-3">
              <p className="font-semibold text-green-800">Employee Remarks</p>
              <p className="text-gray-800 whitespace-pre-wrap">
                {employee_remarks}
              </p>
            </div>
          )}

          {hr_remarks && (
            <div>
              <p className="font-semibold text-purple-800">Previous HR Remarks</p>
              <p className="text-gray-800 whitespace-pre-wrap">
                {hr_remarks}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Competencies Table */}
      <div className="bg-white rounded shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Competency Leveling Summary</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Competency</th>
              <th className="px-4 py-2 text-left font-semibold">MPLR</th>
              <th className="px-4 py-2 text-left font-semibold">Assigned</th>
              <th className="px-4 py-2 text-left font-semibold">Weight</th>
              <th className="px-4 py-2 text-left font-semibold">Score</th>
              <th className="px-4 py-2 text-left font-semibold">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-2">{it.competency_name}</td>
                <td className="px-4 py-2">{it.mplr_level || it.required_level}</td>
                <td className="px-4 py-2">{it.assigned_level}</td>
                <td className="px-4 py-2">
                  {Number(it.weight || 0).toFixed(2)}%
                </td>
                <td className="px-4 py-2">
                  {Number(it.score || 0).toFixed(2)}
                </td>
                <td className="px-4 py-2">
                  {it.pdf_path ? (
                    <a
                      href={`http://localhost:4000/${it.pdf_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline text-xs"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
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

      {/* HR Remarks Section */}
      <div className="bg-white rounded shadow-sm p-6 mb-6">
        <label className="block text-sm font-semibold mb-2">
          HR Remarks{' '}
          {header.status === 'PENDING_HR' && (
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
      {header.status === 'PENDING_HR' && (
        <div className="flex gap-4">
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="px-6 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Approve & Enable IDP'}
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

export default HRReviewCLPage;
