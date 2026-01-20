// src/pages/Manager/ManagerReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Modal from '../../components/Modal';
import { displayStatus } from '../../utils/statusHelper';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
function ManagerReviewCLPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const viewOnly = searchParams.get('viewOnly') === 'true';
  
  const [user, setUser] = useState(null);
  const [cl, setCl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false); // for approve/return buttons
  const [remarks, setRemarks] = useState(''); // manager remarks
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
    const managerRoles = ['Manager', 'HR', 'Admin'];
    if (!managerRoles.includes(parsed.role)) {
      showModal('Access Denied', 'Only Managers / HR / Admin can view this page.', 'error');
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
    window.location.href = '/manager';
  }

  // ==========================
  // HANDLERS: APPROVE / RETURN
  // ==========================
  function confirmApprove() {
    showConfirmModal('Confirm Approval', 'Approve this CL?', executeApprove, 'info');
  }

  async function executeApprove() {
    closeModal();
    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/manager/approve`, {
        method: 'POST',
        body: JSON.stringify({ remarks }), // send manager remarks (optional)
      });
      showModal('Success', 'CL approved successfully.', 'success');
      setTimeout(() => window.location.href = '/manager', 2000);
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
      await apiRequest(`/api/cl/${id}/manager/return`, {
        method: 'POST',
        body: JSON.stringify({ remarks }), // send manager remarks when returning
      });
      showModal('Success', 'CL returned to supervisor.', 'success');
      setTimeout(() => window.location.href = '/manager', 2000);
    } catch (err) {
      console.error(err);
      showModal('Error', err.message || 'Failed to return CL.', 'error');
      alert(err.message || 'Failed to return CL.');
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================
  // EXPORT HANDLERS
  // ==========================
  function handleExportCSV() {
    if (!cl || !cl.items) return;

    const BOM = '\uFEFF';
    let csvContent = BOM;

    // Header info
    csvContent += `CL Review #${cl.id}\n`;
    csvContent += `Employee Name,${cl.employee_name || 'N/A'}\n`;
    csvContent += `Employee ID,${cl.employee_id || 'N/A'}\n`;
    csvContent += `Position,${cl.position_title || 'N/A'}\n`;
    csvContent += `Department,${cl.department_name || 'N/A'}\n`;
    csvContent += `Supervisor,${cl.supervisor_name || 'N/A'}\n`;
    csvContent += `Status,${displayStatus(cl.status)}\n`;
    csvContent += `\n`;

    // Compute score
    const totalScore = (cl.items || []).reduce((sum, it) => sum + (Number(it.score) || 0), 0);
    const getProficiencyLevel = (score) => {
      if (score >= 4.5) return { level: 5, name: 'Expert' };
      if (score >= 3.5) return { level: 4, name: 'Advanced' };
      if (score >= 2.5) return { level: 3, name: 'Intermediate' };
      if (score >= 1.5) return { level: 2, name: 'Novice' };
      return { level: 1, name: 'Fundamental Awareness' };
    };
    const proficiency = getProficiencyLevel(totalScore);

    csvContent += `Total Score,${totalScore.toFixed(2)}\n`;
    csvContent += `Proficiency Level,Level ${proficiency.level} - ${proficiency.name}\n`;
    csvContent += `\n`;

    // Table header
    csvContent += `Competency,MPLR,Assigned Level,Weight (%),Score,Comments\n`;

    // Table rows
    cl.items.forEach((item) => {
      const competency = (item.competency_name || '').replace(/,/g, ';');
      const mplr = item.required_level || '';
      const assigned = item.assigned_level || '';
      const weight = Number(item.weight || 0).toFixed(2);
      const score = Number(item.score || 0).toFixed(2);
      const comments = (item.justification || '').replace(/,/g, ';').replace(/\n/g, ' ');

      csvContent += `${competency},${mplr},${assigned},${weight},${score},${comments}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CL_Review_${cl.id}_${cl.employee_name || 'Employee'}.csv`;
    link.click();
  }

  function handleExportPDF() {
    if (!cl || !cl.items) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`CL Review #${cl.id}`, pageWidth / 2, 15, { align: 'center' });

    // Employee info block
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let yPos = 25;
    doc.text(`Employee Name: ${cl.employee_name || 'N/A'}`, 14, yPos);
    yPos += 5;
    doc.text(`Employee ID: ${cl.employee_id || 'N/A'}`, 14, yPos);
    yPos += 5;
    doc.text(`Position: ${cl.position_title || 'N/A'}`, 14, yPos);
    yPos += 5;
    doc.text(`Department: ${cl.department_name || 'N/A'}`, 14, yPos);
    yPos += 5;
    doc.text(`Supervisor: ${cl.supervisor_name || 'N/A'}`, 14, yPos);
    yPos += 5;
    doc.text(`Status: ${displayStatus(cl.status)}`, 14, yPos);
    yPos += 8;

    // Score
    const totalScore = (cl.items || []).reduce((sum, it) => sum + (Number(it.score) || 0), 0);
    const getProficiencyLevel = (score) => {
      if (score >= 4.5) return { level: 5, name: 'Expert' };
      if (score >= 3.5) return { level: 4, name: 'Advanced' };
      if (score >= 2.5) return { level: 3, name: 'Intermediate' };
      if (score >= 1.5) return { level: 2, name: 'Novice' };
      return { level: 1, name: 'Fundamental Awareness' };
    };
    const proficiency = getProficiencyLevel(totalScore);

    doc.setFont('helvetica', 'bold');
    doc.text(`Total Score: ${totalScore.toFixed(2)} | Proficiency: Level ${proficiency.level} - ${proficiency.name}`, 14, yPos);
    yPos += 8;

    // Competency table
    const tableData = cl.items.map((item) => [
      item.competency_name || '',
      item.required_level || '',
      item.assigned_level || '',
      Number(item.weight || 0).toFixed(2),
      Number(item.score || 0).toFixed(2),
      item.justification || ''
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['Competency', 'MPLR', 'Level', 'Weight %', 'Score', 'Comments']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 15 },
        2: { cellWidth: 15 },
        3: { cellWidth: 20 },
        4: { cellWidth: 15 },
        5: { cellWidth: 'auto' }
      },
      margin: { top: 10, left: 14, right: 14 }
    });

    doc.save(`CL_Review_${cl.id}_${cl.employee_name || 'Employee'}.pdf`);
  }

  if (!user) return null;

  if (loading) return <p className="p-4">Loading...</p>;

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-2">{error}</p>
        <button onClick={goBack} className="px-4 py-2 rounded bg-gray-600 text-white">
          Back to Manager Dashboard
        </button>
      </div>
    );
  }

  if (!cl) {
    return (
      <div className="p-4">
        <p className="text-gray-600">CL not found.</p>
        <button onClick={goBack} className="mt-2 px-4 py-2 rounded bg-gray-600 text-white">
          Back to Manager Dashboard
        </button>
      </div>
    );
  }

  // 👇 include supervisor_remarks, am_remarks and manager_remarks from backend
  const { 
    id: clId, 
    status, 
    items, 
    employee_name,
    employee_id,
    employee_email,
    position_title,
    department_name,
    supervisor_name,
    supervisor_remarks, 
    am_remarks,
    manager_remarks, 
    updated_at 
  } = cl;

  // ==========================
  // COMPUTE TOTAL SCORE & PROFICIENCY LEVEL
  // ==========================
  const totalScore = (items || []).reduce(
    (sum, it) => sum + (Number(it.score) || 0),
    0
  );

  const getProficiencyLevel = (score) => {
    if (score >= 4.5) return { level: 5, name: 'Expert', color: 'bg-purple-100 border-purple-400' };
    if (score >= 3.5) return { level: 4, name: 'Advanced', color: 'bg-green-100 border-green-400' };
    if (score >= 2.5) return { level: 3, name: 'Intermediate', color: 'bg-slate-100 border-slate-400' };
    if (score >= 1.5) return { level: 2, name: 'Novice', color: 'bg-yellow-100 border-yellow-400' };
    return { level: 1, name: 'Fundamental Awareness', color: 'bg-orange-100 border-orange-400' };
  };

  const proficiency = getProficiencyLevel(totalScore);

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
                Status: <strong>{displayStatus(status)}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-100 text-xs transition border border-slate-300"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-100 text-xs transition border border-slate-300"
              >
                Export PDF
              </button>
              <button
                onClick={goBack}
                className="text-slate-500 hover:text-slate-700 px-4 py-2 rounded-md hover:bg-slate-100 text-sm transition"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4 overflow-y-auto space-y-4">
            {/* EMPLOYEE INFO */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Employee Information</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Employee Name</p>
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
                  <p className="text-slate-500">Supervisor</p>
                  <p className="font-medium text-slate-800">{supervisor_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Department</p>
                  <p className="font-medium text-slate-800">{department_name || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* ASSISTANT MANAGER / SUPERVISOR REMARKS (READ-ONLY) */}
            {(am_remarks || supervisor_remarks) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-1 text-yellow-800">
                  {am_remarks ? 'Assistant Manager Remarks' : 'Supervisor Remarks'}
                </h3>
                <p className="text-sm text-yellow-900 whitespace-pre-wrap">
                  {am_remarks || supervisor_remarks}
                </p>
              </div>
            )}

            {/* MANAGER REMARKS HISTORY (READ-ONLY) */}
            {manager_remarks && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-slate-800">Manager Remarks (Previous)</h3>
                  {updated_at && (
                    <span className="text-xs text-slate-500">
                      {new Date(updated_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-900 whitespace-pre-wrap">
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

            {/* COMPETENCY TABLE */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Competency Assessment</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                  <thead className="bg-slate-100 uppercase text-[11px] text-slate-700">
                    <tr>
                      <th className="px-2 py-1 text-left">Competency</th>
                      <th className="px-2 py-1 text-left">MPLR</th>
                      <th className="px-2 py-1 text-left">Assigned Level</th>
                      <th className="px-2 py-1 text-left">Weight (%)</th>
                      <th className="px-2 py-1 text-left">Score</th>
                      <th className="px-2 py-1 text-left">Comments (Justification / Trainings / Certificates, Etc)</th>
                      <th className="px-2 py-1 text-left">PDF</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white">
                    {items.map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="px-2 py-1 text-slate-800">{it.competency_name}</td>
                        <td className="px-2 py-1 text-slate-700">{it.required_level}</td>
                        <td className="px-2 py-1 text-slate-700">{it.assigned_level}</td>
                        <td className="px-2 py-1 text-slate-700">{Number(it.weight || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 font-semibold text-slate-700">{Number(it.score || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-slate-700">{it.justification}</td>
                        <td className="px-2 py-1">
                          {it.pdf_path ? (
                            <a
                              href={`${import.meta.env.VITE_API_BASE_URL}/${it.pdf_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-600 hover:text-slate-800 underline"
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

            {/* PROFICIENCY LEVEL GUIDE */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Proficiency Level Guide
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2 py-1 text-left text-slate-700">Level</th>
                      <th className="px-2 py-1 text-left text-slate-700">Proficiency</th>
                      <th className="px-2 py-1 text-left text-slate-700">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr className="border-t border-slate-100"><td className="px-2 py-1">1</td><td className="px-2 py-1">Fundamental Awareness</td><td className="px-2 py-1">Basic understanding…</td></tr>
                    <tr className="border-t border-slate-100"><td className="px-2 py-1">2</td><td className="px-2 py-1">Novice</td><td className="px-2 py-1">Limited experience…</td></tr>
                    <tr className="border-t border-slate-100"><td className="px-2 py-1">3</td><td className="px-2 py-1">Intermediate</td><td className="px-2 py-1">Works independently…</td></tr>
                    <tr className="border-t border-slate-100"><td className="px-2 py-1">4</td><td className="px-2 py-1">Advanced</td><td className="px-2 py-1">Handles complex tasks…</td></tr>
                    <tr className="border-t border-slate-100"><td className="px-2 py-1">5</td><td className="px-2 py-1">Expert</td><td className="px-2 py-1">Top-level mastery…</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* MANAGER REMARKS SECTION */}
            {!viewOnly && (
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <label className="block text-xs font-medium mb-1 text-slate-700">
                  Manager Remarks <span className="text-red-600">*</span>
                </label>
                <textarea
                  className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows="3"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter your remarks before approving or returning..."
                ></textarea>
              </div>
            )}

            {viewOnly && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-sm text-slate-700">
                  This CL has already been {cl.status === 'APPROVED' || cl.manager_decision === 'APPROVED' ? 'approved' : 'returned'} by the manager. 
                  You are viewing it in read-only mode.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {!viewOnly && (
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-2">
              <button
                className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 shadow-sm"
                onClick={confirmApprove}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>

              <button
                className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 shadow-sm"
                onClick={confirmReturn}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Return to Supervisor'}
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

export default ManagerReviewCLPage;
