import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../api/client';


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
      } catch (e) {
        // ignore
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
    // eslint-disable-next-line no-console
    console.log('IDP (debug):', idp, 'employeeInfo:', employeeInfo, 'supervisorInfo:', supervisorInfo);
  }, [idp, employeeInfo, supervisorInfo]);

  const editable = idp && idp.header && (idp.header.status === 'DRAFT' || idp.header.status === 'RETURNED');

  useEffect(() => {
    if (idp && editable) {
      setEditData({
        items: idp.items.map(item => {
          let activity = item.development_activity;
          if (typeof activity === 'string') {
            try { activity = JSON.parse(activity); } catch (e) {}
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
            development_activity: item.activity
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

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow">
      <button onClick={() => navigate(-1)} className="mb-4 text-blue-600 hover:underline">&larr; Back</button>
      <h1 className="text-2xl font-bold mb-4">Individual Development Plan (IDP) Details</h1>
      <div className="mb-4">
        <strong>Status:</strong> {header.status}
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
                    <input
                      className="border rounded px-2 py-1 text-xs"
                      value={item.activity.status || ''}
                      onChange={e => {
                        const v = e.target.value;
                        setEditData(ed => {
                          const items = [...ed.items];
                          items[idx] = { ...items[idx], activity: { ...items[idx].activity, status: v } };
                          return { ...ed, items };
                        });
                      }}
                    />
                  </td>
                </tr>
              ))
            : idp.items.map(item => {
                let activity = item.development_activity;
                if (typeof activity === 'string') {
                  try { activity = JSON.parse(activity); } catch (e) {}
                }
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-2 align-top">{item.competency_name}</td>
                    <td className="px-4 py-2 align-top">{(item.current_level ?? item.currentLevel ?? item.assigned_level ?? item.mplr ?? item.mplr_level ?? compAssignedMap[item.competency_id]) || ''}</td>
                    <td className="px-4 py-2 align-top">{(item.target_level ?? item.targetLevel ?? ( (item.current_level ?? item.currentLevel ?? item.assigned_level ?? compAssignedMap[item.competency_id]) ? Math.min(Number(item.current_level ?? item.currentLevel ?? item.assigned_level ?? compAssignedMap[item.competency_id]) + 1, 5) : ''))}</td>
                    <td className="px-4 py-2 align-top">{activity?.type || ''}</td>
                    <td className="px-4 py-2 align-top">{activity?.activity || ''}</td>
                    <td className="px-4 py-2 align-top">{activity?.targetDate || ''}</td>
                    <td className="px-4 py-2 align-top">{activity?.status || ''}</td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
