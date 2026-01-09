import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import CreateIDPPage from './CreateIDPPage';
import { COMPLETION_STATUS_OPTIONS, DEVELOPMENT_TYPES, CRAYON_COLORS } from './idpConstants';


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
    if (!h.employee_name && !employeeInfo) {
      if (passed.employee) setEmployeeInfo(passed.employee);
      else if (h.employee_id) {
        apiRequest(`/api/users/${h.employee_id}`).then(setEmployeeInfo).catch(() => {});
      }
    }
    if (!h.supervisor_name && !supervisorInfo) {
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

  const editable = !viewOnly && idp && idp.header && (idp.header.status === 'DRAFT' || idp.header.status === 'RETURNED' || idp.header.status === 'FOR_COMPLETION');

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
    return u.name || u.full_name || (u.first_name && u.last_name && `${u.first_name} ${u.last_name}`) || u.display_name || u.email || '';
  }

  const empName = header.employee_name || (header.employee && getDisplayName(header.employee)) || getDisplayName(employeeInfo) || empId || '';
  const empPosition = header.position_title || (header.employee && header.employee.position) || employeeInfo?.position || employeeInfo?.title || '';
  const empDept = header.department_name || employeeInfo?.department_name || employeeInfo?.department || '';
  const empEmail = header.employee_email || employeeInfo?.email || '';
  // Prefer a real name; ignore numeric supervisor_name fields that appear to be IDs
  const rawSupName = header.supervisor_name;
  const hasNonNumericSupName = rawSupName && String(rawSupName).trim() !== '' && isNaN(Number(String(rawSupName).trim()));
  const supName = (hasNonNumericSupName ? rawSupName : null) || (header.supervisor && getDisplayName(header.supervisor)) || getDisplayName(supervisorInfo) || '';
  const supPosition = header.supervisor_title || supervisorInfo?.position || supervisorInfo?.title || '';

  // If the IDP is RETURNED or FOR_COMPLETION and the current user is the supervisor owner, show full Create/Edit form so supervisor can modify and resubmit.
  // Do not render the editable Create form when viewing in view-only mode.
  if (!viewOnly && currentUser && currentUser.role === 'Supervisor' && (header.status === 'RETURNED' || header.status === 'FOR_COMPLETION') && Number(supId) === Number(currentUser.id)) {
    return <CreateIDPPage routeId={id} />;
  }

  // Manager/AM actions
  async function handleApproveAsManager() {
    if (!window.confirm('Approve this IDP?')) return;
    try {
      await apiRequest(`/api/idp/${id}/manager/approve`, { method: 'PUT' });
      alert('IDP approved successfully.');
      navigate(-1);
    } catch (err) {
      alert('Failed to approve IDP.');
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
    // Determine whether any competency is incomplete and call the appropriate HR endpoint
    const anyIncomplete = (idp.items || []).some(it => {
      let activity = it.development_activity;
      if (typeof activity === 'string') {
        try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
      }
      return !isCompletedStatus(activity?.status || activity?.completionStatus || '');
    });

    if (!window.confirm(anyIncomplete ? 'Approve this IDP for completion (notify supervisor)?' : 'Approve this IDP and mark cycle completed?')) return;
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
    if (status === 'APPROVED' || status === 'CYCLE_COMPLETED') return (<span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{status}</span>);
    return (<span className={`${base} bg-gray-50 text-gray-800 border-gray-200`}><span className="h-1.5 w-1.5 rounded-full bg-gray-500" />{status}</span>);
  })();

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-black">Employee Information</h2>
            </div>
            <div className="text-xs text-gray-500 text-right">
              <div className="font-semibold text-gray-800">Cycle ID: {header.cycle_id}</div>
            </div>
          </div>
      <div className="mb-4">
        <div><strong>Employee:</strong> {empName}{empId ? ` (${empId})` : ''}</div>
        {empPosition && <div><strong>Position:</strong> {empPosition}</div>}
        {empDept && <div><strong>Department:</strong> {empDept}</div>}
        {empEmail && <div><strong>Email:</strong> {empEmail}</div>}
        <div style={{height:8}} />
        {header.review_period && <div><strong>Review Period:</strong> {header.review_period}</div>}
        {header.next_review_date && <div><strong>Next Review Date:</strong> {header.next_review_date}</div>}
        <div style={{height:8}} />
        <div><strong>Supervisor:</strong> {supName || (supId ? `ID ${supId}` : '-')}</div>
        {supPosition && <div><strong>Supervisor Title:</strong> {supPosition}</div>}
        <div><strong>Cycle ID:</strong> {header.cycle_id}</div>
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

      {/* HR approve/return controls (shown when HR opens a pending HR IDP) */}
      {currentUser && currentUser.role === 'HR' && header.status === 'PENDING_HR' && (() => {
        const anyIncomplete = (idp.items || []).some(it => {
          let activity = it.development_activity;
          if (typeof activity === 'string') {
            try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
          }
          return !isCompletedStatus(activity?.status || activity?.completionStatus || '');
        });
        return (
          <div className="mb-4 flex gap-2">
            <button
              onClick={handleApproveAsHR}
              className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700"
            >
              {anyIncomplete ? 'Approve For Completion' : 'Approve Cycle Completed'}
            </button>

            <button
              onClick={handleReturnAsHR}
              className="px-4 py-2 rounded bg-yellow-600 text-white text-sm hover:bg-yellow-700"
            >
              Return for Revision
            </button>
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
      {/* Render full development plan for managers reviewing pending IDPs */}
      {(viewOnly || (currentUser && ((currentUser.role === 'Manager' && (header.status === 'PENDING_MANAGER' || header.status === 'PENDING_AM')) || (currentUser.role === 'Employee' && header.status === 'PENDING_EMPLOYEE' && Number(empId) === Number(currentUser.id))))) ? (
        <div className="space-y-4">
          {idp.items.map((item, itemIndex) => {
            let activity = item.development_activity;
            if (typeof activity === 'string') {
              try { activity = JSON.parse(activity); } catch { activity = activity || {}; }
            }

            // area color selection (simple deterministic)
            const areaKey = item.development_area || item.competency_area || 'Other';
            let hash = 0;
            for (let i = 0; i < areaKey.length; i++) hash = (hash * 31 + areaKey.charCodeAt(i)) % CRAYON_COLORS.length;
            const chipColor = CRAYON_COLORS[hash] || '#E5E7EB';

            const displayCurrent = item.current_level ?? item.currentLevel ?? item.assigned_level ?? item.mplr ?? compAssignedMap[item.competency_id] ?? '';
            const displayTarget = item.target_level ?? item.targetLevel ?? (displayCurrent ? Math.min(Number(displayCurrent) + 1, 5) : '');

            return (
              <div key={item.id || item.competency_id} className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                <div className="px-4 py-4 bg-white border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-black">{item.competency_name}</span>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full border" style={{ background: chipColor }}>{item.development_area || item.competency_area || 'Area'}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">Current level <span className="font-semibold text-gray-900">{displayCurrent}</span> → Target level <span className="font-semibold text-gray-900">{displayTarget}</span></div>
                    </div>
                    <div className="text-xs font-semibold text-gray-500">1 Activity</div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                        <select value={activity?.type || DEVELOPMENT_TYPES[0]} disabled className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100">
                          {DEVELOPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Target Completion Date</label>
                        <input type="date" value={activity?.targetDate || activity?.targetCompletionDate || ''} readOnly className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black opacity-90 border border-gray-100" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Completion Date</label>
                        <input type="date" value={activity?.actualDate || activity?.actualCompletionDate || ''} readOnly className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100" />
                      </div>

                      <div className="lg:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Development Activity</label>
                        <input type="text" value={activity?.activity || ''} readOnly className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Completion Status</label>
                        <select value={activity?.status || COMPLETION_STATUS_OPTIONS[0]} disabled className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100">
                          {COMPLETION_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Score</label>
                        <select value={activity?.score || 1} disabled className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100">
                          {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Attachment</label>
                        {activity?.pdfPath ? (
                          <a
                            href={`${import.meta.env.VITE_API_BASE_URL}/${activity.pdfPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>

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
      ) : (
        /* existing compact table view for non-manager or non-pending */
        <table className="min-w-full divide-y divide-gray-200 mb-4">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Competency</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Level</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target Level</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Activity Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {editable && editData
              ? editData.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 align-top">{item.competency_name}</td>
                    <td className="px-4 py-2 align-top">{item.current_level}</td>
                    <td className="px-4 py-2 align-top">{item.target_level}</td>
                    <td className="px-4 py-2 align-top">{item.activity.type || ''}</td>
                    <td className="px-4 py-2 align-top">{item.activity.activity || ''}</td>
                    <td className="px-4 py-2 align-top">{item.activity.targetDate || ''}</td>
                    <td className="px-4 py-2 align-top">{item.activity.status || ''}</td>
                  </tr>
                ))
              : idp.items.map(item => {
                  let activity = item.development_activity;
                  if (typeof activity === 'string') {
                    try { activity = JSON.parse(activity); } catch { void 0; }
                  }

                  // Compute a robust current level with fallbacks.
                  const rawCurrent = (item.current_level ?? item.currentLevel ?? item.assigned_level ?? item.assignedLevel ?? item.mplr ?? item.mplr_level ?? compAssignedMap[item.competency_id] ?? null);
                  const rawTarget = (item.target_level ?? item.targetLevel ?? null);

                  // If current is missing but target exists, derive a reasonable current (target - 1, min 1)
                  let displayCurrent = rawCurrent;
                  let displayTarget = rawTarget;

                  if ((displayCurrent === null || displayCurrent === undefined || displayCurrent === '') && displayTarget != null) {
                    const tnum = Number(displayTarget);
                    if (!Number.isNaN(tnum)) {
                      displayCurrent = Math.max(tnum - 1, 1);
                    }
                  }

                  // If target missing but current exists, derive target as current + 1 (max 5)
                  if ((displayTarget === null || displayTarget === undefined || displayTarget === '') && displayCurrent != null) {
                    const cnum = Number(displayCurrent);
                    if (!Number.isNaN(cnum)) {
                      displayTarget = Math.min(cnum + 1, 5);
                    }
                  }

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-2 align-top">{item.competency_name}</td>
                      <td className="px-4 py-2 align-top">{(displayCurrent != null ? String(displayCurrent) : '')}</td>
                      <td className="px-4 py-2 align-top">{(displayTarget != null ? String(displayTarget) : '')}</td>
                      <td className="px-4 py-2 align-top">{activity?.type || ''}</td>
                      <td className="px-4 py-2 align-top">
                        <div className="truncate">{activity?.activity || ''}</div>
                        {activity?.pdfPath && (
                          <div className="text-xs mt-1">
                            <a href={`${import.meta.env.VITE_API_BASE_URL}/${activity.pdfPath}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View attachment</a>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top">{activity?.targetDate || ''}</td>
                      <td className="px-4 py-2 align-top">{activity?.status || ''}</td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      )}
    </div>
  </div>
  );
}
