// src/pages/EmployeeReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  // EXPORT FUNCTIONS
  // ==========================
  function handleExportCSV() {
    if (!cl || !Array.isArray(items) || items.length === 0) return;

    let csv = '\uFEFF'; // BOM for Excel
    csv += 'CL ID,Cycle,Status,Total Score\n';
    csv += `${clId},"${cl.cycle_name || cl.cycle_id || ''}",${status || ''},${totalScore.toFixed(2)}\n\n`;
    csv += 'Competency,MPLR,Assigned,Weight (%),Score,Justification\n';

    items.forEach((it) => {
      const w = Number(it.weight || 0).toFixed(2);
      const s = Number(it.score || 0).toFixed(2);
      const just = String(it.justification || '').replace(/"/g, '""');
      csv += `"${it.competency_name || ''}",${it.required_level || ''},${it.assigned_level || ''},${w},${s},"${just}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CL-${clId}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  function handleExportPDF() {
    if (!cl || !Array.isArray(items) || items.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Competency Leveling Form', 14, 15);

    doc.setFontSize(10);
    doc.text(`CL ID: ${clId}`, 14, 25);
    doc.text(`Cycle: ${cl.cycle_name || cl.cycle_id || ''}`, 14, 32);
    doc.text(`Status: ${status || ''}`, 14, 39);
    doc.text(`Total Score: ${totalScore.toFixed(2)}`, 14, 46);

    const tableData = items.map((it) => [
      it.competency_name || '',
      it.required_level || '',
      it.assigned_level || '',
      Number(it.weight || 0).toFixed(2),
      Number(it.score || 0).toFixed(2),
      it.justification || '',
    ]);

    autoTable(doc, {
      head: [['Competency', 'MPLR', 'Assigned', 'Weight (%)', 'Score', 'Justification']],
      body: tableData,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [0, 0, 0] },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    doc.save(`CL-${clId}-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  // ==========================
  // COMPUTE TOTAL SCORE & PROFICIENCY LEVEL
  // ==========================
  const items = cl?.items || [];
  const totalScore = items.reduce((sum, it) => sum + (Number(it.score) || 0), 0);

  const getProficiencyLevel = (score) => {
    if (score >= 4.5) return { level: 5, name: 'Expert', color: 'bg-purple-100 border-purple-400' };
    if (score >= 3.5) return { level: 4, name: 'Advanced', color: 'bg-green-100 border-green-400' };
    if (score >= 2.5) return { level: 3, name: 'Intermediate', color: 'bg-blue-100 border-blue-400' };
    if (score >= 1.5) return { level: 2, name: 'Novice', color: 'bg-yellow-100 border-yellow-400' };
    return { level: 1, name: 'Fundamental Awareness', color: 'bg-orange-100 border-orange-400' };
  };

  const proficiency = getProficiencyLevel(totalScore);

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
    supervisor_remarks,
    manager_remarks,
  } = cl;

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
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 text-sm rounded bg-slate-600 text-white hover:bg-slate-700 transition"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="px-3 py-1.5 text-sm rounded bg-slate-600 text-white hover:bg-slate-700 transition"
              >
                Export PDF
              </button>
              <button
                onClick={goBack}
                className="text-slate-600 hover:text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-100 text-sm transition"
              >
                ← Back
              </button>
            </div>
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
              </div>
            </div>

            {/* Supervisor & Manager Remarks (read-only) */}
            {supervisor_remarks && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-1 text-slate-700">
                  Supervisor Remarks
                </h3>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {supervisor_remarks}
                </p>
              </div>
            )}

            {manager_remarks && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-1 text-slate-700">
                  Manager Remarks
                </h3>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {manager_remarks}
                </p>
              </div>
            )}

            {/* TOTAL SCORE CARD */}
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 border border-slate-800 rounded-lg p-3 mb-3 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-slate-100 mb-0.5">TOTAL FINAL SCORE</p>
                  <p className="text-2xl font-bold text-white">{totalScore.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium text-slate-100 mb-0.5">PROFICIENCY LEVEL</p>
                  <p className="text-xl font-bold text-white">Level {proficiency.level}</p>
                  <p className="text-xs font-semibold text-slate-100">{proficiency.name}</p>
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
                        <td className="px-2 py-1 font-semibold text-slate-600">{Number(it.score || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-slate-700">{it.justification || '—'}</td>
                        <td className="px-2 py-1">
                          {it.pdf_path ? (
                            <a
                              href={`${import.meta.env.VITE_API_BASE_URL}/${it.pdf_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-700 hover:text-slate-900 underline"
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
            </div>

            {/* PROFICIENCY LEVEL GUIDE TABLE */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Proficiency Level Guide</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                  <thead className="bg-slate-100 uppercase text-[11px] text-slate-700">
                    <tr>
                      <th className="px-2 py-1 text-left">Level</th>
                      <th className="px-2 py-1 text-left">Proficiency</th>
                      <th className="px-2 py-1 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr className="border-t border-slate-100">
                      <td className="px-2 py-1 font-semibold text-slate-600">5</td>
                      <td className="px-2 py-1 font-semibold text-slate-600">Expert</td>
                      <td className="px-2 py-1 text-slate-700">Advanced mastery; recognized authority; can innovate and lead others</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-2 py-1 font-semibold text-slate-600">4</td>
                      <td className="px-2 py-1 font-semibold text-slate-600">Advanced</td>
                      <td className="px-2 py-1 text-slate-700">Can apply independently in complex scenarios; mentors others</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-2 py-1 font-semibold text-slate-600">3</td>
                      <td className="px-2 py-1 font-semibold text-slate-600">Intermediate</td>
                      <td className="px-2 py-1 text-slate-700">Solid working knowledge; can perform tasks with minimal guidance</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-2 py-1 font-semibold text-slate-600">2</td>
                      <td className="px-2 py-1 font-semibold text-slate-600">Novice</td>
                      <td className="px-2 py-1 text-slate-700">Basic understanding; requires supervision and support</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-2 py-1 font-semibold text-slate-600">1</td>
                      <td className="px-2 py-1 font-semibold text-slate-600">Fundamental Awareness</td>
                      <td className="px-2 py-1 text-slate-700">Limited exposure; general familiarity with concepts</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
                  className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  rows="3"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter your remarks or leave empty to approve..."
                ></textarea>
              </div>
            )}

            {viewOnly && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-sm text-slate-700">
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
