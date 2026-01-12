import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import CreateIDPPage from './CreateIDPPage';
import { COMPLETION_STATUS_OPTIONS, DEVELOPMENT_TYPES, CRAYON_COLORS } from './idpConstants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import displayStatus from '../../utils/statusHelper';


export default function SupervisorViewIDPPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search || '');
  const viewOnly = searchParams.get('viewOnly') === 'true';
  const [idp, setIdp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [supervisorInfo, setSupervisorInfo] = useState(null);
  const [compAssignedMap, setCompAssignedMap] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [positionsMap, setPositionsMap] = useState({});
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setCurrentUser(JSON.parse(stored)); } catch { setCurrentUser(null); }
    }
  }, []);

  useEffect(() => {
    async function fetchIDP() {
      try {
        const data = await apiRequest(`/api/idp/${id}`);
        setIdp(data);
      } catch (err) {
        setError(err.message || 'Failed to load IDP');
      } finally {
        setLoading(false);
      }
    }
    fetchIDP();
  }, [id]);

  // Fetch competency assigned levels for the employee so we can default missing levels
  useEffect(() => {
    if (!idp || !idp.header) return;
    // fetch positions lookup once to resolve position_id -> title when needed
    (async () => {
      try {
        const rows = await apiRequest('/api/lookup/positions');
        if (Array.isArray(rows)) {
          const map = {};
          rows.forEach(r => {
            if (!r || r.id == null) return;
            // Accept multiple possible title field names returned by different APIs
            map[r.id] = r.title || r.name || r.label || r.position_title || r.position || r.title_name || r.display_name || '';
          });
          setPositionsMap(map);
        }
      } catch (e) { /* ignore lookup failures */ }
    })();
    const empId = idp.header.employee_id || idp.header.employee || idp.employee_id;
    if (!empId) return;
    let cancelled = false;
    (async () => {
      try {
        const comps = await apiRequest(`/api/cl/employee/${empId}/competencies`);
        const map = {};
        (comps?.competencies || []).forEach(c => {
          if (c && c.competency_id != null) map[c.competency_id] = c.assigned_level || map[c.competency_id];
        });
        if (!cancelled) setCompAssignedMap(map);
      } catch {
        void 0;
      }
    })();
    return () => { cancelled = true; };
  }, [idp]);

  useEffect(() => {
    if (!idp || !idp.header) return;
    const h = idp.header;
    // Prefer location state (manager passed data) to avoid permission issues
    const passed = location?.state || {};
    const rawEmpName = h.employee_name;
    const hasNonNumericEmpName = rawEmpName && String(rawEmpName).trim() !== '' && isNaN(Number(String(rawEmpName).trim()));
    // Always try to fetch employee info if we don't have it yet — some headers omit position fields
    if (!employeeInfo) {
      if (passed.employee) setEmployeeInfo(passed.employee);
      else if (h.employee_id) {
        apiRequest(`/api/users/${h.employee_id}`).then(setEmployeeInfo).catch(() => {});
      }
    }

    const rawSupName = h.supervisor_name;
    const hasNonNumericSupName = rawSupName && String(rawSupName).trim() !== '' && isNaN(Number(String(rawSupName).trim()));
    // Ensure we fetch supervisor info when missing so we can display full name/title
    if (!supervisorInfo) {
      if (passed.supervisor) setSupervisorInfo(passed.supervisor);
      else if (h.supervisor_id) {
        apiRequest(`/api/users/${h.supervisor_id}`).then(setSupervisorInfo).catch(() => {});
      }
    }
  }, [idp, location, employeeInfo, supervisorInfo]);

  // Debug: log idp + fetched users to help map fields (always registered)
  useEffect(() => {
    console.log('IDP (debug):', idp, 'employeeInfo:', employeeInfo, 'supervisorInfo:', supervisorInfo);
  }, [idp, employeeInfo, supervisorInfo]);

  const editable = !viewOnly && idp && idp.header &&
    (idp.header.status === 'DRAFT' || idp.header.status === 'RETURNED' || idp.header.status === 'FOR_COMPLETION') &&
    currentUser && (
      // Only the assigned supervisor can edit/resubmit, or Admins
      (currentUser.role === 'Supervisor' && Number(currentUser.id) === Number(idp.header.supervisor_id)) ||
      currentUser.role === 'Admin'
    );

  useEffect(() => {
    if (idp && editable) {
      setEditData({
        items: idp.items.map(item => {
          let activity = item.development_activity;
          if (typeof activity === 'string') {
            try { activity = JSON.parse(activity); } catch { void 0; }
          }
          const assignedFromMap = compAssignedMap[item.competency_id];
          const current_level = (item.current_level ?? item.currentLevel ?? item.assigned_level ?? item.mplr ?? item.mplr_level ?? assignedFromMap ?? null);
          const target_level = (item.target_level ?? item.targetLevel ?? (current_level ? Math.min(Number(current_level) + 1, 5) : (assignedFromMap ? Math.min(Number(assignedFromMap) + 1, 5) : null)));
          return {
            id: item.id,
            competency_name: item.competency_name,
            current_level,
            target_level,
            activity: {
              ...activity
            }
          };
        })
      });
    }
  }, [idp, editable, compAssignedMap]);

  if (loading) return <div className="p-8 text-center">Loading IDP...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!idp) return <div className="p-8 text-center">IDP not found.</div>;


  async function handleSaveAndResubmit() {
    try {
      setSaving(true);
      // Update items
      await apiRequest(`/api/idp/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          items: editData.items.map(item => ({
            id: item.id,
            development_activity: JSON.stringify(item.activity || {})
          }))
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      // Resubmit
      await apiRequest(`/api/idp/${id}/submit`, { method: 'PUT' });
      alert('IDP resubmitted successfully!');
      navigate(-1);
    } catch (err) {
      alert('Failed to save and resubmit.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (!idp || !idp.header) return <div className="p-8 text-center">IDP not found or invalid data.</div>;
  const header = idp.header || {};
  const empId = header.employee_id || header.employee || idp.employee_id || null;
  const supId = header.supervisor_id || header.supervisor || idp.supervisor_id || null;
  function getDisplayName(u) {
    if (!u) return '';
    if (typeof u === 'string') return u;
    return u.name || u.full_name || ((u.first_name || u.last_name) && `${(u.first_name || '')} ${(u.last_name || '')}`.trim()) || u.display_name || u.email || '';
  }

  const empName = header.employee_name
    || (header.employee && typeof header.employee !== 'number' && getDisplayName(header.employee))
    || getDisplayName(employeeInfo)
    || (empId && isNaN(Number(String(empId).trim())) ? empId : '') || '';
  const empPosition = header.position_title || (header.employee && header.employee.position) || employeeInfo?.position || employeeInfo?.title || '';
  // broaden accepted header/user position sources and fall back to lookup by position_id
  const empPositionResolved = empPosition
    || header.position
    || header.employee_position
    || header.employee?.position_title
    || header.employee?.position
    || employeeInfo?.position_title
    || employeeInfo?.position
    || (header.position_id ? positionsMap[header.position_id] : '')
    || (employeeInfo?.position_id ? positionsMap[employeeInfo.position_id] : '')
    || '';
  const empDept = header.department_name || employeeInfo?.department_name || employeeInfo?.department || '';
  const empEmail = header.employee_email || employeeInfo?.email || '';
  // Prefer a real name; ignore numeric supervisor_name fields that appear to be IDs
  const rawSupName = header.supervisor_name;
  const hasNonNumericSupName = rawSupName && String(rawSupName).trim() !== '' && isNaN(Number(String(rawSupName).trim()));
  const supObjName = (header.supervisor && typeof header.supervisor !== 'number') ? getDisplayName(header.supervisor) : null;
  const supInfoName = getDisplayName(supervisorInfo) || null;
  const supName = supObjName || supInfoName || (hasNonNumericSupName ? rawSupName : '') || '';
  const supPosition = header.supervisor_title || supervisorInfo?.position || supervisorInfo?.title || '';
  const supDept = header.supervisor_department_name || supervisorInfo?.department_name || supervisorInfo?.department || '';

  // Match create page chip color logic
  const areaColor = (area) => {
    const safe = (CRAYON_COLORS && typeof CRAYON_COLORS === 'object') ? CRAYON_COLORS : {};
    if (safe[area]) return safe[area];
    const key = String(area || 'Other');
    const palette = [
      { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', dot: 'bg-indigo-500' },
      { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', dot: 'bg-rose-500' },
      { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
      { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500' },
      { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200', dot: 'bg-sky-500' },
    ];
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 100000;
    return palette[hash % palette.length];
  };

  // If the IDP is RETURNED or FOR_COMPLETION and the current user is the supervisor owner, show full Create/Edit form so supervisor can modify and resubmit.
  // Do not render the editable Create form when viewing in view-only mode.
  if (!viewOnly && currentUser && currentUser.role === 'Supervisor' && (header.status === 'RETURNED' || header.status === 'FOR_COMPLETION') && Number(supId) === Number(currentUser.id)) {
    return <CreateIDPPage routeId={id} />;
  }

  // Manager/AM actions
  async function handleApproveAsManager() {
    if (!window.confirm('Mark this IDP as Cycle Completed?')) return;
    try {
      await apiRequest(`/api/idp/${id}/manager/approve`, { method: 'PUT' });
      alert('IDP marked Cycle Completed.');
      navigate(-1);
    } catch (err) {
      alert('Failed to mark IDP.');
      console.error(err);
    }
  }

  async function handleReturnAsManager() {
    const remarks = window.prompt('Enter remarks for return:');
    if (!remarks) return;
    try {
      await apiRequest(`/api/idp/${id}/manager/return`, {
        method: 'PUT',
        body: JSON.stringify({ remarks }),
        headers: { 'Content-Type': 'application/json' },
      });
      alert('IDP returned to supervisor.');
      navigate(-1);
    } catch (err) {
      alert('Failed to return IDP.');
      console.error(err);
    }
  }

  // HR actions
  async function handleApproveAsHR() {
    // Determine whether any competency is incomplete
    const anyIncomplete = (idp.items || []).some(it => {
      let activity = it.development_activity;
      if (typeof activity === 'string') {
        try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
      }
      return !isCompletedStatus(activity?.status || activity?.completionStatus || '');
    });

    // For initial HR review (PENDING_HR), can approve incomplete items to FOR_COMPLETION
    // For FOR_COMPLETION status, must have all completed to approve cycle
    const isForCompletion = header.status === 'FOR_COMPLETION';
    
    if (isForCompletion && anyIncomplete) {
      alert('Need to complete all');
      return;
    }

    if (!window.confirm(anyIncomplete ? 'Mark this IDP as For Completion (notify supervisor)?' : 'Mark this IDP as Cycle Completed?')) return;
    try {
      if (anyIncomplete) {
        await apiRequest(`/api/idp/${id}/hr/approve-for-completion`, { method: 'PUT' });
        alert('IDP marked For Completion.');
      } else {
        await apiRequest(`/api/idp/${id}/hr/approve-cycle`, { method: 'PUT' });
        alert('IDP marked Cycle Completed.');
      }
      navigate(-1);
    } catch (err) {
      alert(err?.message || 'Failed to approve IDP.');
      console.error(err);
    }
  }
  async function handleReturnAsHR() {
    const remarks = window.prompt('Enter remarks for returning to supervisor:');
    if (!remarks) return;
    try {
      await apiRequest(`/api/idp/${id}/hr/return`, {
        method: 'PUT',
        body: JSON.stringify({ remarks }),
        headers: { 'Content-Type': 'application/json' }
      });
      alert('IDP returned to supervisor for completion.');
      navigate(-1);
    } catch (err) {
      alert('Failed to return IDP.');
      console.error(err);
    }
  }

  // Helper to determine explicit completed statuses
  function isCompletedStatus(status) {
    if (!status) return false;
    const s = String(status).trim().toLowerCase();
    return COMPLETION_STATUS_OPTIONS.slice(2).some(opt => String(opt).toLowerCase() === s || s.startsWith('completed'));
  }

  // Employee actions (acknowledge or return to supervisor)
  async function handleApproveAsEmployee() {
    if (!window.confirm('Acknowledge and accept this IDP?')) return;
    try {
      await apiRequest(`/api/idp/${id}/employee/approve`, { method: 'PUT' });
      alert('IDP acknowledged successfully.');
      navigate(-1);
    } catch (err) {
      alert('Failed to acknowledge IDP.');
      console.error(err);
    }
  }

  async function handleReturnAsEmployee() {
    const remarks = window.prompt('Enter remarks to return to supervisor:');
    if (!remarks) return;
    try {
      await apiRequest(`/api/idp/${id}/employee/return`, {
        method: 'PUT',
        body: JSON.stringify({ remarks }),
        headers: { 'Content-Type': 'application/json' },
      });
      alert('IDP returned to supervisor.');
      navigate(-1);
    } catch (err) {
      alert('Failed to return IDP.');
      console.error(err);
    }
  }

  // status badge similar to CreateIDPPage
  const statusBadge = (() => {
    const status = header.status;
    if (!status) return null;
    const base = "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border";
    if (status === 'RETURNED') return (<span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{status}</span>);
    if (status === 'PENDING_MANAGER' || status === 'PENDING_AM') return (<span className={`${base} bg-blue-50 text-blue-800 border-blue-200`}><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{status}</span>);
    if (status === 'CYCLE_COMPLETED') return (<span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{status}</span>);
    return (<span className={`${base} bg-gray-50 text-gray-800 border-gray-200`}><span className="h-1.5 w-1.5 rounded-full bg-gray-500" />{status}</span>);
  })();

  // Helpers for export formatting
  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d)) return String(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const formatTime = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Compute aging between creation and completion (days/weeks). Prefer explicit header timestamps,
  // otherwise fall back to the latest actual completion date across items.
  function getAgingText() {
    if (!header || !header.created_at) return null;
    if (header.status !== 'CYCLE_COMPLETED') return null;
    const created = new Date(header.created_at);
    let completed = header.updated_at ? new Date(header.updated_at) : null;

    if ((!completed || isNaN(completed)) && Array.isArray(idp.items)) {
      // find latest actual completion date from items
      let latest = null;
      idp.items.forEach(it => {
        let activity = it.development_activity;
        if (typeof activity === 'string') {
          try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
        }
        const a = activity?.actualDate || activity?.actualCompletionDate || null;
        if (a) {
          const d = new Date(a);
          if (!isNaN(d) && (!latest || d > latest)) latest = d;
        }
      });
      if (latest) completed = latest;
    }

    if (!completed || isNaN(completed) || isNaN(created)) return null;
    const ms = completed - created;
    if (ms < 0) return null;
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    if (weeks >= 1) return `${weeks} week${weeks>1? 's':''} (${days} day${days>1? 's':''})`;
    return `${days} day${days>1? 's':''}`;
  }

  // Compute aging for a single item using IDP creation date and the activity's actual completion date
  function getItemAging(activity) {
    if (!header || !header.created_at) return null;
    const created = new Date(header.created_at);
    if (isNaN(created)) return null;
    if (typeof activity === 'string') {
      try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
    }
    const a = activity?.actualDate || activity?.actualCompletionDate || null;
    if (!a) return null;
    const completed = new Date(a);
    if (isNaN(completed)) return null;
    const ms = completed - created;
    if (ms < 0) return null;
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    if (weeks >= 1) return `${weeks} week${weeks>1? 's':''} (${days} day${days>1? 's':''})`;
    return `${days} day${days>1? 's':''}`;
  }

  function handleExportCSV() {
    if (!idp || !idp.header) return;
    const h = idp.header;
    const csvRows = [];
    // Header block
    csvRows.push(['IDP Header']);
    csvRows.push(['IDP ID', h.id || '-']);
    csvRows.push(['Employee', empName || '-']);
    csvRows.push(['Supervisor', supName || '-']);
    csvRows.push(['Department', empDept || '-']);
    csvRows.push(['Cycle ID', h.cycle_id || '-']);
    csvRows.push(['Review Period', h.review_period || '-']);
    csvRows.push(['Next Review Date', h.next_review_date || '-']);
    csvRows.push(['Status', h.status || '-']);
    if (h.created_at) csvRows.push(['Created At', `${formatDate(h.created_at)} ${formatTime(h.created_at)}`]);
    if (h.updated_at) csvRows.push(['Last Updated', `${formatDate(h.updated_at)} ${formatTime(h.updated_at)}`]);
    csvRows.push(['']);

    // Items table
    csvRows.push(['Development Plan Items']);
    csvRows.push(['Competency','Area','Current Level','Target Level','Activity Type','Activity','Target Date','Actual Date','Status','Score','Expected Results','Sharing Method','Application Method','Attachment']);
    (idp.items || []).forEach(item => {
      let activity = item.development_activity;
      if (typeof activity === 'string') {
        try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
      }
      const current = item.current_level ?? item.currentLevel ?? item.assigned_level ?? item.mplr ?? compAssignedMap[item.competency_id] ?? '';
      const target = item.target_level ?? item.targetLevel ?? (current ? Math.min(Number(current) + 1, 5) : '');
      csvRows.push([
        item.competency_name || '',
        item.development_area || item.competency_area || '',
        String(current || ''),
        String(target || ''),
        activity?.type || '',
        (activity?.activity || '').replace(/\n/g, ' '),
        activity?.targetDate || activity?.targetCompletionDate || '',
        activity?.actualDate || activity?.actualCompletionDate || '',
        activity?.status || activity?.completionStatus || '',
        activity?.score != null ? String(activity.score) : '',
        (activity?.expectedResults || '').replace(/\n/g, ' '),
        (activity?.sharingMethod || '').replace(/\n/g, ' '),
        (activity?.applicationMethod || '').replace(/\n/g, ' '),
        activity?.pdfPath ? 'Available' : '—',
      ]);
    });

    const csvContent = csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `IDP_${h.id || 'unknown'}_${(empName || 'employee').replace(/\s+/g,'_')}_View.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportPDF() {
    if (!idp || !idp.header) return;
    const h = idp.header;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text('Individual Development Plan – View', 40, 40);

    doc.setFontSize(10);

    // Render header metadata as a neat two-column table
    const headerRows = [
      ['IDP ID', h.id || '-'],
      ['Employee', empName || '-'],
      ['Supervisor', supName || '-'],
      ['Department', empDept || '-'],
      ['Cycle ID', h.cycle_id || '-'],
      ['Review Period', h.review_period || '-'],
      ['Next Review Date', h.next_review_date || '-'],
      ['Status', displayStatus(h.status) || '-'],
    ];
    if (h.created_at) headerRows.push(['Created', `${formatDate(h.created_at)} ${formatTime(h.created_at)}`]);
    if (h.updated_at) headerRows.push(['Updated', `${formatDate(h.updated_at)} ${formatTime(h.updated_at)}`]);

    autoTable(doc, {
      startY: 60,
      margin: { left: 40, right: 40 },
      theme: 'plain',
      styles: { fontSize: 10 },
      tableWidth: 'auto',
      head: [['', '']],
      body: headerRows,
      columnStyles: { 0: { cellWidth: 120, halign: 'left' }, 1: { cellWidth: 360, halign: 'left' } },
    });

    const itemsStartY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 60;

    autoTable(doc, {
      startY: itemsStartY,
      margin: { left: 40, right: 40 },
      tableWidth: 'auto',
      head: [[
        'Competency','Area','Current','Target','Type','Activity','Target Date','Actual Date','Status','Score','Expected Results','Sharing','Application','Attachment'
      ]],
      body: (idp.items || []).map(item => {
        let activity = item.development_activity;
        if (typeof activity === 'string') {
          try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
        }
        const current = item.current_level ?? item.currentLevel ?? item.assigned_level ?? item.mplr ?? compAssignedMap[item.competency_id] ?? '';
        const target = item.target_level ?? item.targetLevel ?? (current ? Math.min(Number(current) + 1, 5) : '');
        return [
          item.competency_name || '',
          item.development_area || item.competency_area || '',
          String(current || ''),
          String(target || ''),
          activity?.type || '',
          (activity?.activity || '').replace(/\n/g, ' '),
          activity?.targetDate || activity?.targetCompletionDate || '',
          activity?.actualDate || activity?.actualCompletionDate || '',
          activity?.status || activity?.completionStatus || '',
          activity?.score != null ? String(activity.score) : '',
          (activity?.expectedResults || '').replace(/\n/g, ' '),
          (activity?.sharingMethod || '').replace(/\n/g, ' '),
          (activity?.applicationMethod || '').replace(/\n/g, ' '),
          (activity?.pdfPath ? 'Available' : '—'),
        ];
      }),
      styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
      headStyles: { fillColor: [68, 76, 85], textColor: 255, halign: 'left' },
      bodyStyles: { textColor: 40 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      // Column width suggestions for landscape A4 (0-based indexes)
      columnStyles: {
        0: { cellWidth: 120 },  // Competency
        1: { cellWidth: 120 },  // Area
        2: { cellWidth: 40 },   // Current
        3: { cellWidth: 40 },   // Target
        4: { cellWidth: 60 },   // Type
        5: { cellWidth: 220 },  // Activity
        6: { cellWidth: 70 },   // Target Date
        7: { cellWidth: 70 },   // Actual Date
        8: { cellWidth: 70 },   // Status
        9: { cellWidth: 30 },   // Score
        10: { cellWidth: 160 }, // Expected Results
        11: { cellWidth: 70 },  // Sharing
        12: { cellWidth: 70 },  // Application
        13: { cellWidth: 40 }   // Attachment
      },
    });

    doc.save(`IDP_${h.id || 'unknown'}_${(empName || 'employee').replace(/\s+/g,'_')}_View.pdf`);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <div className="border-b bg-black sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="shrink-0 p-2 bg-white/10 hover:bg-white/15 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30"
                aria-label="Back"
              >
                &larr;
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white leading-tight">Individual Development Plan (IDP) Details</h1>
                  {statusBadge}
                </div>
                <p className="text-xs text-white/70 mt-0.5 truncate">View IDP details</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={handleExportCSV}
                className="bg-white text-black px-3 py-2 rounded-md hover:bg-gray-100 border border-gray-200"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="bg-white text-black px-3 py-2 rounded-md hover:bg-gray-100 border border-gray-200"
              >
                Export PDF
              </button>
              {!viewOnly && currentUser && currentUser.role === 'Supervisor' && Number(supId) === Number(currentUser.id) && (
                <button
                  onClick={async () => {
                    if (!window.confirm('Delete this IDP? This action cannot be undone.')) return;
                    try {
                      await apiRequest(`/api/idp/${id}`, { method: 'DELETE' });
                      alert('IDP deleted');
                      navigate(-1);
                    } catch (err) {
                      console.error('Delete failed', err);
                      alert('Failed to delete IDP.');
                    }
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              )}

              {editable && (
                <button
                  onClick={handleSaveAndResubmit}
                  disabled={saving}
                  className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition"
                >
                  {saving ? 'Saving...' : (header.status === 'DRAFT' ? 'Save & Submit' : 'Save & Resubmit')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Employee Information</h2>
              <p className="text-sm text-gray-500 mt-1">Read-only snapshot of the IDP context.</p>
            </div>
            <div className="text-xs text-gray-500 text-right">
              <div className="hidden sm:block">Cycle ID</div>
              <div className="font-semibold text-gray-800">{header.cycle_id}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <div className="px-3 py-2 bg-white rounded-md text-sm font-medium text-gray-900 border border-gray-200 truncate">
                {empName || empPosition || empDept ? empName : (empId || '')}
              </div>
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Position</label>
              <div className="px-3 py-2 bg-white rounded-md text-sm font-medium text-gray-900 border border-gray-200 truncate">
                {empPositionResolved || '-'}
              </div>
            </div>

            {empDept && (
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-black border border-gray-100 truncate">
                  {empDept}
                </div>
              </div>
            )}

            <div className="min-w-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Supervisor/Manager</label>
              <div className="px-3 py-2 bg-white rounded-md text-sm font-medium text-gray-900 border border-gray-200 truncate">
                {supName || (supId ? `ID ${supId}` : '—')}
              </div>
            </div>

            {supPosition && (
              <div className="min-w-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">Supervisor Position</label>
                <div className="px-3 py-2 bg-white rounded-md text-sm font-medium text-gray-900 border border-gray-200 truncate">
                  {supPosition}
                </div>
              </div>
            )}

            {/* Supervisor Department removed per request */}

            {header.review_period && (
              <div className="sm:col-span-1 lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Review Period</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-black border border-gray-100 truncate">
                  {header.review_period}
                </div>
              </div>
            )}

            {header.next_review_date && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Next Review Date</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-black border border-gray-100 truncate">
                  {header.next_review_date}
                </div>
              </div>
            )}

            {header.status === 'CYCLE_COMPLETED' && (() => {
              const aging = getAgingText();
              if (!aging) return null;
              return (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Aging</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-black border border-gray-100 truncate">
                    {aging}
                  </div>
                </div>
              );
            })()}

            <div className="sm:hidden">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cycle ID</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-black border border-gray-100">
                {header.cycle_id}
              </div>
            </div>
          </div>

      {/* Show Save & Resubmit for DRAFT/RETURNED */}
      {editable && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={handleSaveAndResubmit}
            disabled={saving}
            className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Resubmit'}
          </button>
        </div>
      )}

      {/* Manager approve/return controls (shown when a manager opens a pending IDP) */}
      {!viewOnly && currentUser && currentUser.role === 'Manager' && header.status === 'PENDING_MANAGER' && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={handleApproveAsManager}
            className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700"
          >
            Approve
          </button>

          <button
            onClick={handleReturnAsManager}
            className="px-4 py-2 rounded bg-yellow-600 text-white text-sm hover:bg-yellow-700"
          >
            Return
          </button>
        </div>
      )}

      {/* HR approve/return controls (shown when HR opens a pending HR IDP or FOR_COMPLETION) */}
      {currentUser && currentUser.role === 'HR' && (header.status === 'PENDING_HR' || header.status === 'FOR_COMPLETION') && (() => {
        const anyIncomplete = (idp.items || []).some(it => {
          let activity = it.development_activity;
          if (typeof activity === 'string') {
            try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
          }
          return !isCompletedStatus(activity?.status || activity?.completionStatus || '');
        });
        
        // For FOR_COMPLETION status, only allow approval if all are completed
        const isForCompletion = header.status === 'FOR_COMPLETION';
        const canApprove = !isForCompletion || !anyIncomplete;
        
        return (
          <div className="mb-4 flex gap-2">
            <button
              onClick={handleApproveAsHR}
              disabled={!canApprove}
              className={`px-4 py-2 rounded text-white text-sm ${!canApprove ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isForCompletion ? (anyIncomplete ? 'Need to complete all' : 'Mark Cycle Completed') : (anyIncomplete ? 'Mark For Completion' : 'Mark Cycle Completed')}
            </button>

            {!isForCompletion && (
              <button
                onClick={handleReturnAsHR}
                className="px-4 py-2 rounded bg-yellow-600 text-white text-sm hover:bg-yellow-700"
              >
                Return for Revision
              </button>
            )}
          </div>
        );
      })()}

      {!viewOnly && currentUser && currentUser.role === 'Employee' && header.status === 'PENDING_EMPLOYEE' && Number(empId) === Number(currentUser.id) && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={handleApproveAsEmployee}
            className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700"
          >
            Acknowledge
          </button>

          <button
            onClick={handleReturnAsEmployee}
            className="px-4 py-2 rounded bg-yellow-600 text-white text-sm hover:bg-yellow-700"
          >
            Return to Supervisor
          </button>
        </div>
      )}

        </div>

        <h2 className="text-xl font-semibold mb-2">Development Items</h2>
        {/* Always render full card layout for uniformity */}
        <div className="space-y-4">
          {idp.items.map((item, itemIndex) => {
            let activity = item.development_activity;
            if (typeof activity === 'string') {
              try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
            }
            const areaKey = item.development_area || item.competency_area || 'Other';
            const chip = areaColor(areaKey);

            const displayCurrent = item.current_level ?? item.currentLevel ?? item.assigned_level ?? item.mplr ?? compAssignedMap[item.competency_id] ?? '';
            const displayTarget = item.target_level ?? item.targetLevel ?? (displayCurrent ? Math.min(Number(displayCurrent) + 1, 5) : '');

            return (
              <div key={item.id || item.competency_id} className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="px-5 py-4 bg-white border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-semibold text-gray-900">{item.competency_name}</span>
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${chip.bg} ${chip.text} ${chip.border}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                          {item.development_area || item.competency_area || 'Area'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">Current <span className="font-medium text-gray-900">{displayCurrent}</span> → Target <span className="font-medium text-gray-900">{displayTarget}</span></div>
                    </div>
                    <div className="text-sm font-medium text-gray-500">1 Activity</div>
                  </div>
                </div>

                <div className="p-5 bg-gray-50">
                  <div className="rounded-md bg-white border border-gray-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
                        <select value={activity?.type || DEVELOPMENT_TYPES[0]} disabled className="w-full bg-white rounded-md px-3 py-2 text-sm text-gray-900 border border-gray-200">
                          {DEVELOPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Target Completion Date</label>
                        <input type="date" value={activity?.targetDate || activity?.targetCompletionDate || ''} readOnly className="w-full bg-white rounded-md px-3 py-2 text-sm text-gray-900 border border-gray-200" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Actual Completion Date</label>
                        <input type="date" value={activity?.actualDate || activity?.actualCompletionDate || ''} readOnly className="w-full bg-white rounded-md px-3 py-2 text-sm text-gray-900 border border-gray-200" />
                      </div>

                      {/* Per-item aging (time from IDP creation to this competency's actual completion) */}
                      <div className="">
                        {(() => {
                          const itemAging = getItemAging(activity);
                          if (!itemAging) return null;
                          return (
                            <div className="text-xs text-gray-500 mt-1">Aging: {itemAging}</div>
                          );
                        })()}
                      </div>

                      {/* Show education justification if present (moved above Development Activity) */}
                      {activity?.type === 'Education' && (
                        <>
                          {(activity?.educationJustification || activity?.justification) && (
                            <div className="lg:col-span-3">
                              <label className="block text-sm font-medium text-gray-600 mb-1">Education Justification</label>
                              <div className="px-3 py-2 bg-white rounded-md text-sm text-gray-900 border border-gray-200">
                                {activity.educationJustification || activity.justification}
                              </div>
                            </div>
                          )}

                          {activity?.educationJustificationPdf && (
                            <div className="lg:col-span-3">
                              <label className="block text-sm font-medium text-gray-600 mb-1">Justification Attachment</label>
                              <a
                                href={`${import.meta.env.VITE_API_BASE_URL}/${activity.educationJustificationPdf}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-indigo-600 hover:underline"
                              >
                                View PDF
                              </a>
                            </div>
                          )}
                        </>
                      )}

                      <div className="lg:col-span-3">
                        <label className="block text-sm font-medium text-gray-600 mb-1">Development Activity</label>
                        <input type="text" value={activity?.activity || ''} readOnly className="w-full bg-white rounded-md px-3 py-2 text-sm text-gray-900 border border-gray-200" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Completion Status</label>
                        <select value={activity?.status || COMPLETION_STATUS_OPTIONS[0]} disabled className="w-full bg-white rounded-md px-3 py-2 text-sm text-gray-900 border border-gray-200">
                          {COMPLETION_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Score</label>
                        <select value={activity?.score || 1} disabled className="w-full bg-white rounded-md px-3 py-2 text-sm text-gray-900 border border-gray-200">
                          {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Attachment</label>
                        {activity?.pdfPath ? (
                          <a
                            href={`${import.meta.env.VITE_API_BASE_URL}/${activity.pdfPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>

                      {/* (Education justification rendered above Development Activity) */}

                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Results</label>
                        <textarea value={activity?.expectedResults || ''} readOnly rows={3} className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100" />
                      </div>

                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Knowledge Sharing Method</label>
                        <textarea value={activity?.sharingMethod || ''} readOnly rows={3} className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100" />
                      </div>

                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Application Method</label>
                        <textarea value={activity?.applicationMethod || ''} readOnly rows={3} className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
    </div>
  </div>
  );
}
