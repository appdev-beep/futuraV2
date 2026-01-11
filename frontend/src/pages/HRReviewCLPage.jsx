// src/pages/HRReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import Modal from '../components/Modal';
import { displayStatus } from '../utils/statusHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function HRReviewCLPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const viewOnly = searchParams.get('viewOnly') === 'true';
  const [user, setUser] = useState(null);
  const [cl, setCl] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
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
      showModal('Access Denied', 'Only HR can review CLs.', 'error');
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
        const [clData, trailData] = await Promise.all([
          apiRequest(`/api/cl/${id}`, { method: 'GET' }),
          apiRequest(`/api/cl/${id}/audit-trail`, { method: 'GET' })
        ]);
        
        setCl(clData);
        setAuditTrail(trailData);

        // Normalize header to safely read hr_remarks
        const header = clData.header || clData;
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

  // Date formatting helpers
  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatTime = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // ==========================
  // EXPORT: CSV
  // ==========================
  function handleExportCSV() {
    if (!cl) return;
    const header = cl.header || cl;
    const csvRows = [];

    // Header Info
    csvRows.push(['CL Header']);
    csvRows.push(['CL ID', header.id || '-']);
    csvRows.push(['Employee', header.employee_name || '-']);
    csvRows.push(['Supervisor', header.supervisor_name || '-']);
    csvRows.push(['Department', header.department_name || '-']);
    csvRows.push(['Status', displayStatus(header.status)]);
    if (header.created_at) csvRows.push(['Created At', formatDate(header.created_at) + ' ' + formatTime(header.created_at)]);
    if (header.updated_at) csvRows.push(['Last Updated', formatDate(header.updated_at) + ' ' + formatTime(header.updated_at)]);
    csvRows.push(['Total Score', totalScore.toFixed(2)]);
    csvRows.push(['Proficiency', `Level ${proficiency.level} – ${proficiency.name}`]);
    csvRows.push(['']);

    // Competencies Table
    csvRows.push(['Competency Leveling Summary']);
    csvRows.push(['Competency','MPLR/Required','Assigned','Weight %','Score','Justification','PDF']);
    (items || []).forEach(it => {
      csvRows.push([
        it.competency_name || '',
        String(it.mplr_level || it.required_level || ''),
        String(it.assigned_level || ''),
        Number(it.weight || 0).toFixed(2),
        Number(it.score || 0).toFixed(2),
        (it.justification || '').replace(/\n/g, ' '),
        it.pdf_path ? 'Available' : '—',
      ]);
    });
    csvRows.push(['']);

    // Process History
    csvRows.push(['Process History']);
    csvRows.push(['Date','Time','Actor','Role','Action','Remarks']);
    (auditTrail || []).forEach(event => {
      const action = (event.action_type || '-').replace(/_/g, ' ');
      csvRows.push([
        formatDate(event.timestamp),
        formatTime(event.timestamp),
        event.actor_name || '-',
        event.actor_role || '-',
        action,
        (event.remarks || '').replace(/\n/g, ' '),
      ]);
    });
    csvRows.push(['']);

    // Remarks Section
    csvRows.push(['Remarks']);
    csvRows.push(['Supervisor Remarks', (header.supervisor_remarks || '').replace(/\n/g, ' ')]);
    csvRows.push(['Manager Remarks', (header.manager_remarks || '').replace(/\n/g, ' ')]);
    csvRows.push(['Employee Remarks', (header.employee_remarks || '').replace(/\n/g, ' ')]);
    csvRows.push(['Previous HR Remarks', (header.hr_remarks || '').replace(/\n/g, ' ')]);
    csvRows.push(['HR Remarks (Current)', (remarks || '').replace(/\n/g, ' ')]);

    const csvContent = csvRows.map(r => r.map(v => `\"${String(v).replace(/\"/g, '\"\"')}\"`).join(',')).join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const employee = header.employee_name || 'employee';
    link.href = URL.createObjectURL(blob);
    link.download = `CL_${header.id || 'unknown'}_${employee}_HR_Review.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==========================
  // EXPORT: PDF
  // ==========================
  function handleExportPDF() {
    if (!cl) return;
    const header = cl.header || cl;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const title = `Competency Leveling – HR Review`;
    doc.setFontSize(14);
    doc.text(title, 40, 40);

    doc.setFontSize(10);
    const infoLines = [
      `CL ID: ${header.id || '-'}`,
      `Employee: ${header.employee_name || '-'}`,
      `Supervisor: ${header.supervisor_name || '-'}`,
      `Department: ${header.department_name || '-'}`,
      `Status: ${displayStatus(header.status)}`,
      `Total Score: ${totalScore.toFixed(2)} | Proficiency: Level ${proficiency.level} – ${proficiency.name}`,
    ];
    if (header.created_at) infoLines.push(`Created: ${formatDate(header.created_at)} ${formatTime(header.created_at)}`);
    if (header.updated_at) infoLines.push(`Updated: ${formatDate(header.updated_at)} ${formatTime(header.updated_at)}`);
    infoLines.forEach((line, idx) => doc.text(line, 40, 60 + idx * 14));

    autoTable(doc, {
      startY: 60 + infoLines.length * 14 + 10,
      head: [[
        'Competency','MPLR/Required','Assigned','Weight %','Score','Justification','PDF'
      ]],
      body: (items || []).map(it => [
        it.competency_name || '',
        String(it.mplr_level || it.required_level || ''),
        String(it.assigned_level || ''),
        Number(it.weight || 0).toFixed(2),
        Number(it.score || 0).toFixed(2),
        (it.justification || '').replace(/\n/g, ' '),
        it.pdf_path ? 'Available' : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [68, 76, 85] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    let y = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 20 : 60 + infoLines.length * 14 + 20;

    // Process History Table
    doc.setFontSize(12);
    doc.text('Process History', 40, y);
    y += 6;
    autoTable(doc, {
      startY: y + 10,
      head: [['Date','Time','Actor','Role','Action','Remarks']],
      body: (auditTrail || []).map(event => [
        formatDate(event.timestamp),
        formatTime(event.timestamp),
        event.actor_name || '-',
        event.actor_role || '-',
        (event.action_type || '-').replace(/_/g, ' '),
        (event.remarks || '').replace(/\n/g, ' '),
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [68, 76, 85] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    y = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 20 : y + 40;

    // Remarks Section
    doc.setFontSize(12);
    doc.text('Remarks', 40, y);
    y += 6;
    autoTable(doc, {
      startY: y + 10,
      head: [['Type','Text']],
      body: [
        ['Supervisor Remarks', (header.supervisor_remarks || '').replace(/\n/g, ' ')],
        ['Manager Remarks', (header.manager_remarks || '').replace(/\n/g, ' ')],
        ['Employee Remarks', (header.employee_remarks || '').replace(/\n/g, ' ')],
        ['Previous HR Remarks', (header.hr_remarks || '').replace(/\n/g, ' ')],
        ['HR Remarks (Current)', (remarks || '').replace(/\n/g, ' ')],
      ],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [68, 76, 85] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 1: { cellWidth: 420 } },
    });

    const employee = header.employee_name || 'employee';
    doc.save(`CL_${header.id || 'unknown'}_${employee}_HR_Review.pdf`);
  }

  // ==========================
  // APPROVE HANDLER
  // ==========================
  function confirmApprove() {
    showConfirmModal(
      'Confirm Approval',
      'Approve this CL? This will enable IDP creation for the employee.',
      executeApprove,
      'info'
    );
  }

  async function executeApprove() {
    closeModal();
    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/hr/approve`, {
        method: 'POST',
        body: JSON.stringify({ remarks }),
      });
      showModal('Success', 'CL approved successfully. Employee can now create IDP.', 'success');
      setTimeout(() => goBack(), 2000);
    } catch (err) {
      console.error(err);
      showModal('Error', err.message || 'Failed to approve CL.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================
  // RETURN HANDLER
  // ==========================
  function confirmReturn() {
    if (!remarks.trim()) {
      showModal('Validation Error', 'Please provide remarks before returning.', 'warning');
      return;
    }

    showConfirmModal(
      'Confirm Return',
      'Return this CL to the supervisor?',
      executeReturn,
      'warning'
    );
  }

  async function executeReturn() {
    closeModal();
    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/hr/return`, {
        method: 'POST',
        body: JSON.stringify({ remarks }),
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

  const {
    supervisor_remarks,
    manager_remarks,
    employee_remarks,
    hr_remarks,
  } = header;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
            <div>
              <h1 className="text-lg font-semibold text-slate-800">
                CL Final Review – #{header.id}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Status: <strong>{displayStatus(header.status)}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="text-slate-600 hover:text-slate-800 px-3 py-2 rounded-md hover:bg-slate-100 text-sm border border-slate-200"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="text-slate-600 hover:text-slate-800 px-3 py-2 rounded-md hover:bg-slate-100 text-sm border border-slate-200"
              >
                Export PDF
              </button>
              <button
                onClick={goBack}
                className="text-slate-500 hover:text-slate-700 px-4 py-2 rounded-md hover:bg-slate-100 text-sm transition"
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4 overflow-y-auto space-y-4">

            {/* Employee & Supervisor Info */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Employee Information</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Employee Name</p>
                  <p className="font-medium text-slate-800">{header.employee_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Supervisor</p>
                  <p className="font-medium text-slate-800">{header.supervisor_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Department</p>
                  <p className="font-medium text-slate-800">{header.department_name || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* All Previous Remarks (read-only) */}
            {supervisor_remarks && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-1 text-slate-800">Supervisor Remarks</h3>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {supervisor_remarks}
                </p>
              </div>
            )}

            {manager_remarks && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-1 text-slate-800">Manager Remarks</h3>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {manager_remarks}
                </p>
              </div>
            )}

            {employee_remarks && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-1 text-slate-800">Employee Remarks</h3>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {employee_remarks}
                </p>
              </div>
            )}

            {hr_remarks && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-1 text-slate-800">Previous HR Remarks</h3>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {hr_remarks}
                </p>
              </div>
            )}

            {/* Process History / Audit Trail */}
            {auditTrail && auditTrail.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold mb-2 text-slate-700">Process History</h3>
                <div className="space-y-3">
                  {auditTrail.map((event, idx) => {
                    let badgeColor = 'bg-slate-100 text-slate-800';
                    let label = event.action_type;

                    if (event.action_type === 'CREATED') {
                      badgeColor = 'bg-blue-100 text-blue-800';
                      label = 'Created';
                    } else if (event.action_type.includes('APPROVE')) {
                      badgeColor = 'bg-green-100 text-green-800';
                      label = event.action_type.replace('_', ' ');
                    } else if (event.action_type.includes('RETURN')) {
                      badgeColor = 'bg-red-100 text-red-800';
                      label = event.action_type.replace('_', ' ');
                    }

                    return (
                      <div key={idx} className="flex items-start gap-2 pb-2 border-b border-slate-200 last:border-0">
                        <span className={`px-2 py-1 text-[11px] font-semibold rounded ${badgeColor}`}>
                          {label}
                        </span>
                        <div className="flex-1">
                          <p className="text-[11px] text-slate-500">
                            {new Date(event.timestamp).toLocaleString()} • {event.actor_name} ({event.actor_role})
                          </p>
                          {event.remarks && (
                            <p className="mt-1 text-xs text-slate-800 whitespace-pre-wrap">
                              {event.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TOTAL SCORE CARD */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-900 rounded-lg p-3 mb-3 shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-slate-200 mb-0.5">TOTAL FINAL SCORE</p>
                  <p className="text-2xl font-bold text-white">{totalScore.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium text-slate-200 mb-0.5">PROFICIENCY LEVEL</p>
                  <p className="text-xl font-bold text-white">Level {proficiency.level}</p>
                  <p className="text-xs font-semibold text-slate-200">{proficiency.name}</p>
                </div>
              </div>
            </div>

            {/* Competencies Table */}
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-slate-700">Competency Leveling Summary</h3>

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
                    {items.map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="px-2 py-1 text-slate-800">{it.competency_name}</td>
                        <td className="px-2 py-1 text-slate-700">{it.mplr_level || it.required_level}</td>
                        <td className="px-2 py-1 text-slate-700">{it.assigned_level}</td>
                        <td className="px-2 py-1 text-slate-700">{Number(it.weight || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 font-semibold text-slate-800">{Number(it.score || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 text-slate-700">{it.justification || '—'}</td>
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
                      <td className="px-2 py-1 font-semibold text-slate-800">5</td>
                      <td className="px-2 py-1 font-semibold text-slate-800">Expert</td>
                      <td className="px-2 py-1 text-slate-700">Advanced mastery; recognized authority; can innovate and lead others</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-2 py-1 font-semibold text-slate-800">4</td>
                      <td className="px-2 py-1 font-semibold text-slate-800">Advanced</td>
                      <td className="px-2 py-1 text-slate-700">Can apply independently in complex scenarios; mentors others</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-2 py-1 font-semibold text-slate-800">3</td>
                      <td className="px-2 py-1 font-semibold text-slate-800">Intermediate</td>
                      <td className="px-2 py-1 text-slate-700">Solid working knowledge; can perform tasks with minimal guidance</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-2 py-1 font-semibold text-slate-800">2</td>
                      <td className="px-2 py-1 font-semibold text-slate-800">Novice</td>
                      <td className="px-2 py-1 text-slate-700">Basic understanding; requires supervision and support</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-2 py-1 font-semibold text-slate-800">1</td>
                      <td className="px-2 py-1 font-semibold text-slate-800">Fundamental Awareness</td>
                      <td className="px-2 py-1 text-slate-700">Limited exposure; general familiarity with concepts</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* HR Remarks Section */}
            {!viewOnly && (
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <label className="block text-xs font-medium mb-1 text-slate-700">
                  HR Remarks{' '}
                  {header.status === 'PENDING_HR' && (
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
                  This CL is being viewed in read-only mode.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {!viewOnly && header.status === 'PENDING_HR' && (
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-2">
              <button
                onClick={confirmApprove}
                disabled={actionLoading}
                className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 shadow-sm"
              >
                {actionLoading ? 'Processing...' : 'Approve & Enable IDP'}
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

export default HRReviewCLPage;
