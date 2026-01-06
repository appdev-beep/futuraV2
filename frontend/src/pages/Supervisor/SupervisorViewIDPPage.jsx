import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { COMPLETION_STATUS_OPTIONS } from './idpConstants';


export default function SupervisorViewIDPPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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

  const editable = idp && idp.header && (idp.header.status === 'DRAFT' || idp.header.status === 'RETURNED');

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

  // status badge similar to CreateIDPPage
  const statusBadge = (() => {
    const status = header.status;
    if (!status) return null;
    const base = "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border";
    if (status === 'RETURNED') return (<span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{status}</span>);
    if (status === 'PENDING_MANAGER' || status === 'PENDING_AM') return (<span className={`${base} bg-blue-50 text-blue-800 border-blue-200`}><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{status}</span>);
    if (status === 'APPROVED') return (<span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{status}</span>);
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
              {currentUser && currentUser.role === 'Supervisor' && (header.status === 'DRAFT') && (
                <button
                  onClick={async () => {
                    if (!window.confirm('Delete this DRAFT IDP? This action cannot be undone.')) return;
                    try {
                      await apiRequest(`/api/idp/${id}`, { method: 'DELETE' });
                      alert('IDP deleted');
                      navigate('/supervisor');
                    } catch {
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
      {currentUser && currentUser.role === 'Manager' && header.status === 'PENDING_MANAGER' && (
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

        </div>

        <h2 className="text-xl font-semibold mb-2">Development Items</h2>
      {/* Table only contains valid table elements */}
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
                  <td className="px-4 py-2 align-top">
                    <input
                      className="border rounded px-2 py-1 text-xs"
                      value={item.activity.type || ''}
                      onChange={e => {
                        const v = e.target.value;
                        setEditData(ed => {
                          const items = [...ed.items];
                          items[idx] = { ...items[idx], activity: { ...items[idx].activity, type: v } };
                          return { ...ed, items };
                        });
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <input
                      className="border rounded px-2 py-1 text-xs"
                      value={item.activity.activity || ''}
                      onChange={e => {
                        const v = e.target.value;
                        setEditData(ed => {
                          const items = [...ed.items];
                          items[idx] = { ...items[idx], activity: { ...items[idx].activity, activity: v } };
                          return { ...ed, items };
                        });
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <input
                      type="date"
                      className="border rounded px-2 py-1 text-xs"
                      value={item.activity.targetDate || ''}
                      onChange={e => {
                        const v = e.target.value;
                        setEditData(ed => {
                          const items = [...ed.items];
                          items[idx] = { ...items[idx], activity: { ...items[idx].activity, targetDate: v } };
                          return { ...ed, items };
                        });
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <select
                      className="border rounded px-2 py-1 text-xs"
                      value={item.activity.status || COMPLETION_STATUS_OPTIONS[0]}
                      onChange={e => {
                        const v = e.target.value;
                        setEditData(ed => {
                          const items = [...ed.items];
                          items[idx] = { ...items[idx], activity: { ...items[idx].activity, status: v } };
                          return { ...ed, items };
                        });
                      }}
                    >
                      {COMPLETION_STATUS_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
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
                    <td className="px-4 py-2 align-top">{activity?.activity || ''}</td>
                    <td className="px-4 py-2 align-top">{activity?.targetDate || ''}</td>
                    <td className="px-4 py-2 align-top">
                      {header.status === 'RETURNED' && currentUser && currentUser.role === 'Supervisor' ? (
                        <select
                          value={activity?.status || COMPLETION_STATUS_OPTIONS[0]}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            try {
                              await apiRequest(`/api/idp/${id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ items: [{ id: item.id, development_activity: JSON.stringify({ ...(activity || {}), status: newStatus }) }] }),
                                headers: { 'Content-Type': 'application/json' }
                              });
                              // reload idp
                              const refreshed = await apiRequest(`/api/idp/${id}`);
                              setIdp(refreshed);
                            } catch (err) {
                              console.error('Failed to update activity status', err);
                              alert('Failed to update status.');
                            }
                          }}
                          className="border rounded px-2 py-1 text-xs"
                        >
                          {COMPLETION_STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        activity?.status || ''
                      )}
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  </div>
  );
}
