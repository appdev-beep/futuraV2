// src/pages/Supervisor/CreateIDPPage.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

import {
  COMPLETION_STATUS_OPTIONS,
  DEVELOPMENT_TYPES,
  CRAYON_COLORS,
  SCORING_GUIDE
} from './idpConstants';

function CreateIDPPage({ routeId, routeEmployeeId } = {}) {
  const params = useParams();
  const employeeId = routeEmployeeId ?? params.employeeId;
  const id = routeId ?? params.id; // id is for edit mode
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [supervisor, setSupervisor] = useState(null);
  const [availableCompetencies, setAvailableCompetencies] = useState([]);
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState([]);
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [idpHeader, setIdpHeader] = useState(null); // for edit mode
  const [missingAttachments, setMissingAttachments] = useState([]);
  const [showMissingModal, setShowMissingModal] = useState(false);

  const [idpData, setIdpData] = useState({
    reviewPeriod: '1st Cycle Performance Review',
    nextReviewDate: new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0],
    items: []
  });
  
  const fromBackendActivity = useCallback((a = {}) => ({
    type: a.type || a.activityType || 'Education',
    activity: a.activity || a.developmentActivity || '',
    targetCompletionDate: normalizeDate(a.targetDate || a.targetCompletionDate || a.target || ''),
    actualCompletionDate: normalizeDate(a.actualDate || a.actualCompletionDate || ''),
    completionStatus: a.status || a.completionStatus || '',
    pdfPath: a.pdf_path || a.pdfPath || a.pdf || '',
    expectedResults: a.expectedResults || a.expected_results || '',
    sharingMethod: a.sharingMethod || a.sharing_method || '',
    applicationMethod: a.applicationMethod || a.application_method || '',
    score: a.score || 1
  }), []);

  // Load for create or edit
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        if (id) {
          // Edit mode: load IDP by id
          setEditMode(true);
          const idpRes = await apiRequest(`/api/idp/${id}`);
          setIdpHeader(idpRes.header);
          // Header may only contain ids; fetch full user objects if not provided
          if (idpRes.header.employee) {
            setEmployee(idpRes.header.employee);
          } else if (idpRes.header.employee_id) {
            try {
              const emp = await apiRequest(`/api/users/${idpRes.header.employee_id}`);
              setEmployee(emp || {});
            } catch {
              setEmployee({});
            }
          } else {
            setEmployee({});
          }

          if (idpRes.header.supervisor) {
            setSupervisor(idpRes.header.supervisor);
          } else if (idpRes.header.supervisor_id) {
            try {
              const sup = await apiRequest(`/api/users/${idpRes.header.supervisor_id}`);
              setSupervisor(sup || {});
            } catch {
              setSupervisor({});
            }
          } else {
            setSupervisor({});
          }
          setIdpData({
            reviewPeriod: idpRes.header.review_period,
            nextReviewDate: normalizeDate(idpRes.header.next_review_date || idpRes.header.nextReviewDate),
            items: (idpRes.items || []).map(item => {
              let rawActivity = item.development_activity;
              if (typeof rawActivity === 'string') {
                try { rawActivity = JSON.parse(rawActivity); } catch { rawActivity = {}; }
              }
              return ({
                id: item.id,
                competencyId: item.competency_id,
                competency_id: item.competency_id,
                competencyName: item.competency_name,
                developmentArea: item.competency_area || 'Technical',
                currentLevel: item.current_level,
                targetLevel: item.target_level,
                developmentActivities: [fromBackendActivity(rawActivity || {})]
              });
            })
          });
          // If this header has no items (older rows or missing data), pre-fill items from employee competencies
          if ((!idpRes.items || idpRes.items.length === 0) && idpRes.header && idpRes.header.employee_id) {
            try {
              const comps = await apiRequest(`/api/cl/employee/${idpRes.header.employee_id}/competencies`);
              const fallbackItems = (comps?.competencies || []).map(comp => ({
                competencyId: comp.competency_id,
                competency_id: comp.competency_id,
                competencyName: comp.name || comp.competency_name,
                developmentArea: comp.competency_area || 'Technical',
                currentLevel: comp.assigned_level || 1,
                targetLevel: Math.min((comp.assigned_level || 1) + 1, 5),
                developmentActivities: [{
                  type: 'Education',
                  activity: '',
                  targetCompletionDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
                  actualCompletionDate: '',
                  completionStatus: 'Not Started/In Progress (<50%)',
                  expectedResults: '',
                  sharingMethod: '',
                  applicationMethod: '',
                  score: 1
                }]
              }));
              setIdpData(prev => ({ ...prev, items: fallbackItems }));
            } catch {
              // ignore fallback failure
            }
          }
        } else if (employeeId) {
          // Create mode: load employee and try to get assigned levels from latest APPROVED CL
          const employeeData = await apiRequest(`/api/users/${employeeId}`);
          if (employeeData.supervisor_id) {
            const supervisorData = await apiRequest(`/api/users/${employeeData.supervisor_id}`);
            setSupervisor(supervisorData);
          }

          // Default merged employee info
          const mergedEmployee = {
            ...employeeData,
            department_name: employeeData.department_name || ''
          };
          setEmployee(mergedEmployee);

          // Try to fetch employee CL history and use the most recent APPROVED CL's assigned levels
          let comps = [];
          try {
            const history = await apiRequest(`/api/cl/employee/${employeeId}/history`);
            const approved = (history || []).find(h => String(h.status).toUpperCase() === 'APPROVED');
            if (approved && approved.id) {
              const clFull = await apiRequest(`/api/cl/${approved.id}`);
              if (clFull && Array.isArray(clFull.items) && clFull.items.length > 0) {
                comps = clFull.items.map(it => ({
                  competency_id: it.competency_id,
                  competencyId: it.competency_id,
                  competencyName: it.competency_name,
                  competency_area: it.competency_area,
                  // assigned_level comes from CL item
                  assigned_level: it.assigned_level ?? it.self_rating ?? null
                }));
              }
            }
          } catch (e) {
            console.error('Failed to load approved CL for assigned levels', e);
          }

          // If no approved CL found or no items, fall back to position competencies
          if (!comps || comps.length === 0) {
            try {
              const competenciesData = await apiRequest(`/api/cl/employee/${employeeId}/competencies`);
              comps = (competenciesData?.competencies || []).map(comp => ({
                competency_id: comp.competency_id,
                competencyId: comp.competency_id,
                competencyName: comp.name,
                competency_area: comp.competency_area,
                assigned_level: comp.assigned_level ?? comp.assignedLevel ?? comp.assigned ?? null
              }));
            } catch (e) {
              console.error('Failed to load position competencies', e);
              comps = [];
            }
          }

          setAvailableCompetencies(comps);
          // Start with no selected items; supervisor must pick between 1 and 3
          setSelectedCompetencyIds([]);
          setIdpData(prev => ({ ...prev, items: [] }));
        }
      } catch (err) {
        console.error('Failed to load IDP data:', err);
        alert('Failed to load employee data. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    if (id || employeeId) {
      loadData();
    }
  }, [id, employeeId, fromBackendActivity]);

  // Update idpData.items when selected competencies change (create mode only)
  useEffect(() => {
    if (editMode) return; // keep existing behavior in edit mode
    if (!availableCompetencies || availableCompetencies.length === 0) return;
    // Map selected IDs to items with default development activity
    const selected = selectedCompetencyIds.map(cid => {
      const comp = availableCompetencies.find(c => String(c.competency_id || c.competencyId) === String(cid));
      const assigned = (comp && (comp.assigned_level ?? comp.assignedLevel ?? comp.assigned)) ?? 1;
      return {
        competencyId: comp?.competencyId || comp?.competency_id,
        competency_id: comp?.competencyId || comp?.competency_id,
        competencyName: comp?.competencyName || comp?.name || '',
        developmentArea: comp?.competency_area || 'Technical',
        currentLevel: assigned,
        targetLevel: Math.min(Number(assigned) + 1, 5),
        developmentActivities: [{
          type: 'Education',
          activity: '',
          targetCompletionDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
          actualCompletionDate: '',
          completionStatus: 'Not Started/In Progress (<50%)',
          expectedResults: '',
          sharingMethod: '',
          applicationMethod: '',
          score: 1
        }]
      };
    });
    setIdpData(prev => ({ ...prev, items: selected }));
  }, [selectedCompetencyIds, availableCompetencies, editMode]);

  const updateIdpData = (path, value) => {
    setIdpData(prev => {
      const newData = { ...prev };
      const pathArray = path.split('.');
      let current = newData;

      for (let i = 0; i < pathArray.length - 1; i++) {
        if (!current[pathArray[i]]) {
          current[pathArray[i]] = {};
        }
        current = current[pathArray[i]];
      }

      current[pathArray[pathArray.length - 1]] = value;

      // Safety: keep ONLY one activity per competency
      if (Array.isArray(newData.items)) {
        newData.items = newData.items.map(item => ({
          ...item,
          developmentActivities: Array.isArray(item.developmentActivities)
            ? item.developmentActivities.slice(0, 1)
            : []
        }));
      }

      return newData;
    });
  };

  const toBackendActivity = (a = {}) => ({
    type: a.type || a.activityType || 'Education',
    activity: a.activity || a.developmentActivity || '',
    targetDate: normalizeDate(a.targetCompletionDate || a.targetDate || a.target || ''),
    actualDate: normalizeDate(a.actualCompletionDate || a.actualDate || ''),
    status: a.completionStatus || a.status || a.completion_status || '',
    pdf_path: a.pdfPath || a.pdf_path || a.pdf || '',
    expectedResults: a.expectedResults || a.expected_results || '',
    sharingMethod: a.sharingMethod || a.sharing_method || '',
    applicationMethod: a.applicationMethod || a.application_method || '',
    score: Number(a.score || a.points || 1)
  });
  
  function normalizeDate(value) {
    if (!value) return '';
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // US format mm/dd/yyyy
    const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const mm = m[1].padStart(2, '0');
      const dd = m[2].padStart(2, '0');
      return `${m[3]}-${mm}-${dd}`;
    }
    // Try Date parse
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    return '';
  }

  // Return true only for explicit completed statuses (avoid matching "In Progress (...) Completed")
  const isCompletedStatus = (s) => {
    if (!s) return false;
    const v = String(s).trim().toLowerCase();
    const completedSet = new Set([
      'completed & met expectations',
      'completed & above target expectation',
      'completed & exceeded competency'
    ]);
    return completedSet.has(v);
  };

  // For create: submit new, for edit: update and resubmit
  const submitIDP = async () => {
    // Validate: any Education activity marked Completed must have a pdfPath
    const missing = [];
    (idpData.items || []).forEach((it, idx) => {
      const act = (it.developmentActivities || [])[0] || {};
      if (act && (act.type === 'Education') && isCompletedStatus(act.completionStatus) && !act.pdfPath) {
        missing.push({ itemIndex: idx, competencyName: it.competencyName || ('#' + (it.competencyId || idx)) });
      }
    });
    if (missing.length > 0) {
      setMissingAttachments(missing);
      setShowMissingModal(true);
      return;
    }

    try {
      setSaving(true);
      const enforcedItems = (idpData.items || []).map(item => ({
        ...item,
        developmentActivities: Array.isArray(item.developmentActivities)
          ? item.developmentActivities.slice(0, 1)
          : []
      }));
      // Validation for create mode: must select between 1 and 3 competencies
      if (!editMode) {
        const count = (enforcedItems || []).length;
        if (count < 1) {
          alert('Please select at least one competency (minimum 1).');
          setSaving(false);
          return;
        }
        if (count > 3) {
          alert('You may select a maximum of 3 competencies.');
          setSaving(false);
          return;
        }
      }
      if (editMode && id) {
        // Edit mode: prepare backend-friendly payload (id + development_activity)
        const payload = {
          reviewPeriod: idpData.reviewPeriod,
          nextReviewDate: normalizeDate(idpData.nextReviewDate),
          items: (idpData.items || []).map(it => ({
            id: it.id,
            competency_id: it.competency_id || it.competencyId || it.competency_id,
            development_activity: JSON.stringify(toBackendActivity((it.developmentActivities || [])[0] || {}))
          }))
        };
        // 1. Update the IDP (backend will update existing items by id)
        await apiRequest(`/api/idp/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        });
        // 2. Resubmit the IDP
        await apiRequest(`/api/idp/${id}/submit`, {
          method: 'PUT'
        });
        alert('IDP resubmitted successfully!');
        navigate('/supervisor');
      } else {
        // Create mode: create and submit
        const payload = {
          employeeId: parseInt(employeeId),
          supervisorId: employee?.supervisor_id,
          reviewPeriod: idpData.reviewPeriod,
          nextReviewDate: normalizeDate(idpData.nextReviewDate),
          // normalize activities for backend create
          items: enforcedItems.map(it => ({
            ...it,
            developmentActivities: (it.developmentActivities || []).map(a => toBackendActivity(a))
          }))
        };
        const createRes = await apiRequest('/api/idp/create', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const idpId = createRes?.id;
        if (!idpId) throw new Error('Failed to create IDP. No ID returned.');
        await apiRequest(`/api/idp/${idpId}/submit`, {
          method: 'PUT'
        });
        alert('IDP submitted successfully!');
        navigate('/supervisor');
      }
    } catch (err) {
      console.error('Failed to submit IDP:', err);
      alert('Failed to submit IDP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const creationDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const statusBadge = useMemo(() => {
    const status = idpHeader?.status;
    if (!status) return null;

    const base = "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border";
    if (status === 'RETURNED') {
      return (
        <span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {status}
        </span>
      );
    }
    if (status === 'SUBMITTED') {
      return (
        <span className={`${base} bg-blue-50 text-blue-800 border-blue-200`}>
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          {status}
        </span>
      );
    }
    if (status === 'APPROVED') {
      return (
        <span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {status}
        </span>
      );
    }
    return (
      <span className={`${base} bg-gray-50 text-gray-800 border-gray-200`}>
        <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
        {status}
      </span>
    );
  }, [idpHeader?.status]);

  const isForCompletion = editMode && idpHeader?.status === 'FOR_COMPLETION';

  const areaColor = (area) => {
    const safe = (CRAYON_COLORS && typeof CRAYON_COLORS === 'object') ? CRAYON_COLORS : {};
    // UI-only: pick deterministic chip colors without affecting logic.
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-black"></div>
            <div>
              <p className="text-gray-900 font-semibold">Loading</p>
              <p className="text-sm text-gray-600">Fetching IDP data…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-red-600 font-semibold">Employee not found</p>
          <button
            onClick={() => navigate('/supervisor')}
            className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-md bg-black text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      {/* Header */}
      <div className="border-b bg-black sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <button
                onClick={() => navigate('/supervisor')}
                className="shrink-0 p-2 bg-white/10 hover:bg-white/15 rounded-md focus:outline-none focus:ring-2 focus:ring-white/30"
                aria-label="Back"
              >
                <ArrowLeftIcon className="h-5 w-5 text-white" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white leading-tight">
                    Individual Development Plan (IDP)
                  </h1>
                  {statusBadge}
                </div>
                <p className="text-xs text-white/70 mt-0.5 truncate">
                  {editMode ? `Edit IDP for ${employee?.name || ''}` : `Create IDP for ${employee?.name || ''}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => setShowScoringGuide(!showScoringGuide)}
                className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-3 py-2 rounded-md hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <InformationCircleIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Scoring Guide</span>
                <span className="sm:hidden">Guide</span>
              </button>

              {editMode && (idpHeader?.status === 'RETURNED' || idpHeader?.status === 'FOR_COMPLETION') ? (
                <button
                  onClick={submitIDP}
                  disabled={saving}
                  className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  {saving ? 'Resubmitting...' : 'Save & Resubmit'}
                </button>
              ) : (
                <button
                  onClick={submitIDP}
                  disabled={saving}
                  className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  {saving ? 'Submitting...' : 'Submit IDP'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Scoring Guide Modal */}
        {showScoringGuide && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowScoringGuide(false)}
              aria-hidden="true"
            />
            <div className="relative h-full w-full flex items-center justify-center p-4">
              <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl bg-white rounded-xl border border-gray-100">
                <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-bold text-black">
                    Scoring Guide for IDP Completion and Competency Mastery
                  </h2>
                  <button
                    onClick={() => setShowScoringGuide(false)}
                    className="text-black text-2xl font-bold bg-gray-100 hover:bg-gray-200 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-black/10"
                    aria-label="Close scoring guide"
                  >
                    ×
                  </button>
                </div>
                <div className="p-5 space-y-3 overflow-y-auto max-h-[calc(85vh-64px)]">
                  {SCORING_GUIDE.map((guide) => (
                    <div key={guide.score} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg text-black bg-white rounded-md px-3 py-1 border border-gray-200">
                          {guide.score}
                        </span>
                        <span className="font-semibold text-black">{guide.status}</span>
                      </div>
                      <p className="text-black text-sm leading-relaxed">{guide.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showMissingModal && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowMissingModal(false)} />
            <div className="relative h-full w-full flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white rounded-xl border border-gray-100 shadow-2xl p-6">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-black">Missing Attachment(s)</h3>
                  <button onClick={() => setShowMissingModal(false)} className="text-black/60">✕</button>
                </div>
                <p className="text-sm text-gray-600 mt-2">One or more activities marked Completed have no attached PDF. Please attach proof before submitting.</p>
                <ul className="mt-3 max-h-40 overflow-auto list-disc list-inside text-sm text-gray-800">
                  {missingAttachments.map((m, i) => (
                    <li key={i}>{m.competencyName}</li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setShowMissingModal(false)} className="px-4 py-2 rounded-md bg-white border border-gray-200">Close</button>
                  <button
                    onClick={() => {
                      setShowMissingModal(false);
                      // Scroll to first missing item
                      const first = missingAttachments[0];
                      const el = document.getElementById(`item-${first.itemIndex}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="px-4 py-2 rounded-md bg-black text-white"
                  >
                    Go to first missing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Top summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee card */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-black">Employee Information</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Review details and complete the development activity fields below.
                </p>
              </div>
              <div className="text-xs text-gray-500 text-right">
                <div className="hidden sm:block">Date of IDP Creation</div>
                <div className="font-semibold text-gray-800">{creationDate}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-black border border-gray-100 truncate">
                  {employee.name}
                </div>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Position</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-black border border-gray-100 truncate">
                  {employee.position_title}
                </div>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-black border border-gray-100 truncate">
                  {employee.department_name}
                </div>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Supervisor/Manager</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-black border border-gray-100 truncate">
                  {supervisor?.name || 'N/A'}
                </div>
              </div>

              <div className="sm:col-span-1 lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Review Period</label>
                <input
                  type="text"
                  value={idpData.reviewPeriod}
                  onChange={(e) => updateIdpData('reviewPeriod', e.target.value)}
                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Next Review Date</label>
                <input
                  type="date"
                  value={idpData.nextReviewDate}
                  onChange={(e) => updateIdpData('nextReviewDate', e.target.value)}
                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                />
              </div>

              <div className="sm:hidden">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date of IDP Creation</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-black border border-gray-100">
                  {creationDate}
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions / hints */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-black">Helpful Notes</h3>
            <div className="mt-3 space-y-3 text-sm text-gray-700">
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="text-xs font-semibold text-gray-600">Activities</div>
                <div className="mt-1">
                  One activity per competency is enforced.
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="text-xs font-semibold text-gray-600">Tip</div>
                <div className="mt-1">
                  Fill out “Expected Results”, “Knowledge Sharing”, and “Application Method” for a complete submission.
                </div>
              </div>
              <button
                onClick={() => setShowScoringGuide(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-black text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <InformationCircleIcon className="h-5 w-5" />
                View Scoring Guide
              </button>
            </div>
          </div>
        </div>

        {/* Competency selector for supervisors creating an IDP */}
        {!editMode && availableCompetencies && availableCompetencies.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-black">Select Competencies (min 1, max 3)</h3>
            <p className="text-xs text-gray-500 mt-1">Choose up to three competencies from the employee's competency list to include in this IDP.</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {availableCompetencies.map(comp => {
                const cid = comp.competencyId || comp.competency_id;
                const checked = selectedCompetencyIds.includes(String(cid));
                const disabled = !checked && selectedCompetencyIds.length >= 3;
                return (
                  <label key={cid} className={`flex items-center gap-3 p-2 rounded border ${checked ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => {
                        const v = String(cid);
                        if (e.target.checked) {
                          if (selectedCompetencyIds.length >= 3) return; // guard
                          setSelectedCompetencyIds(prev => [...prev, v]);
                        } else {
                          setSelectedCompetencyIds(prev => prev.filter(x => x !== v));
                        }
                      }}
                    />
                    <div className="text-sm">
                      <div className="font-semibold text-gray-800">{comp.competencyName || comp.name}</div>
                      <div className="text-xs text-gray-500">Current level: {comp.assigned_level || 1}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            {selectedCompetencyIds.length === 0 && (
              <p className="text-xs text-red-600 mt-2">Select at least one competency to proceed.</p>
            )}
          </div>
        )}

        {/* Development Plan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-black">Development Plan</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Update the fields inside each competency card.
                </p>
              </div>
              <div className="text-xs text-gray-500">
                {idpData.items.length} competency{(idpData.items.length === 1) ? '' : 'ies'}
              </div>
            </div>
          </div>

          <div className="p-5">
            {idpData.items.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-gray-800 font-semibold">No approved competencies found for this employee.</p>
                <p className="text-sm text-gray-600 mt-1">
                  Employee must have approved CL competencies before creating IDP.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {idpData.items.map((item, itemIndex) => {
                  const activity = (item.developmentActivities || [])[0];
                  const chip = areaColor(item.developmentArea);

                  return (
                    <div
                      id={`item-${itemIndex}`}
                      key={item.competencyId}
                      className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden"
                    >
                      {/* Card header */}
                      <div className="px-4 py-4 bg-white border-b border-gray-100">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-semibold text-black">
                                {item.competencyName}
                              </span>
                              <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${chip.bg} ${chip.text} ${chip.border}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                                {item.developmentArea}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              Current level <span className="font-semibold text-gray-900">{item.currentLevel}</span> → Target level{' '}
                              <span className="font-semibold text-gray-900">{item.targetLevel}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100">
                              1 Activity
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-4">
                        {!activity ? (
                          <div className="px-3 py-3 bg-white rounded-lg text-sm text-gray-600 border border-gray-100">
                            No activity initialized.
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                                <select
                                  value={activity.type}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.type`, e.target.value)}
                                  disabled={isForCompletion}
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                >
                                  {DEVELOPMENT_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Target Completion Date</label>
                                <input
                                  type="date"
                                  value={activity.targetCompletionDate || ''}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.targetCompletionDate`, e.target.value)}
                                  disabled={isForCompletion}
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Completion Date</label>
                                <input
                                  type="date"
                                  value={activity.actualCompletionDate}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.actualCompletionDate`, e.target.value)}
                                  disabled={isForCompletion}
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                />
                              </div>

                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Development Activity</label>
                                <input
                                  type="text"
                                  value={activity.activity}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.activity`, e.target.value)}
                                  placeholder="Describe the development activity..."
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                />
                              </div>

                              <div className="flex flex-col">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Completion Status</label>
                                <select
                                  value={activity.completionStatus}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.completionStatus`, e.target.value)}
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                >
                                  {COMPLETION_STATUS_OPTIONS.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>

                                {/* Attachment appears below the Completion Status dropdown when applicable */}
                                  {activity.type === 'Education' && ((activity.pdfPath) || isCompletedStatus(activity.completionStatus)) && (
                                  <div className="mt-2 flex items-center gap-2 w-full">
                                    <select
                                      value={activity.pdfPath || ''}
                                      onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.pdfPath`, e.target.value)}
                                      className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100 truncate"
                                    >
                                      <option value="">-- No file --</option>
                                      {activity.pdfPath && (
                                        <option value={activity.pdfPath}>{activity.pdfPath.split('/').pop()}</option>
                                      )}
                                    </select>
                                      <label className={`inline-flex items-center px-3 py-2 bg-white border border-gray-200 rounded text-sm ${!isCompletedStatus(activity.completionStatus) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={async (e) => {
                                            if (!isCompletedStatus(activity.completionStatus)) {
                                              alert('Please mark activity as Completed to upload proof.');
                                              return;
                                            }
                                          const f = e.target.files && e.target.files[0];
                                          if (!f) return;
                                          const form = new FormData();
                                          form.append('pdf', f);
                                          try {
                                            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/idp/upload`, {
                                              method: 'POST',
                                              headers: {
                                                Authorization: `Bearer ${localStorage.getItem('token')}`
                                              },
                                              body: form
                                            });
                                            const data = await res.json();
                                            if (!res.ok) throw new Error(data.message || 'Upload failed');
                                            updateIdpData(`items.${itemIndex}.developmentActivities.0.pdfPath`, data.pdf_path);
                                            // If we're editing an existing IDP (editMode) and the item exists in DB, persist immediately
                                            try {
                                              if (editMode && id) {
                                                const item = idpData.items[itemIndex] || {};
                                                const itemId = item.id || null;
                                                const competencyId = item.competency_id || item.competencyId || null;
                                                const activityObj = (item.developmentActivities || [])[0] || {};
                                                const uploadedPath = data.pdf_path || data.pdfPath || '';
                                                const mergedActivity = { ...activityObj, pdfPath: uploadedPath, pdf_path: uploadedPath };

                                                const payloadItem = {
                                                  development_activity: JSON.stringify(toBackendActivity(mergedActivity))
                                                };
                                                if (itemId) payloadItem.id = itemId;
                                                if (competencyId && !itemId) payloadItem.competency_id = competencyId;

                                                const payload = { items: [ payloadItem ] };
                                                await apiRequest(`/api/idp/${id}`, {
                                                  method: 'PUT',
                                                  body: JSON.stringify(payload),
                                                });

                                                // Refresh local data from server so UI reflects any DB-normalized fields
                                                try {
                                                  const fresh = await apiRequest(`/api/idp/${id}`, { method: 'GET' });
                                                  // map to idpData shape used in this component
                                                  const mapped = (fresh.items || []).map(it => {
                                                    let rawAct = it.development_activity;
                                                    if (typeof rawAct === 'string') {
                                                      try { rawAct = JSON.parse(rawAct); } catch { rawAct = {}; }
                                                    }
                                                    return {
                                                      id: it.id,
                                                      competencyId: it.competency_id,
                                                      competency_id: it.competency_id,
                                                      competencyName: it.competency_name,
                                                      developmentArea: it.competency_area || 'Technical',
                                                      currentLevel: it.current_level,
                                                      targetLevel: it.target_level,
                                                      developmentActivities: [ fromBackendActivity(rawAct || {}) ]
                                                    };
                                                  });
                                                  setIdpData(prev => ({ ...prev, items: mapped }));
                                                } catch (refreshErr) {
                                                  console.error('Failed to refresh IDP after persisting upload:', refreshErr);
                                                }
                                              }
                                            } catch (persistErr) {
                                              console.error('Failed to persist uploaded pdf_path immediately:', persistErr);
                                            }
                                            alert('PDF uploaded');
                                          } catch (err) {
                                            console.error('Upload failed', err);
                                            alert('Upload failed: ' + (err.message || ''));
                                          }
                                        }}
                                        style={{ display: 'none' }}
                                      />
                                      Upload
                                    </label>
                                    {activity.pdfPath && (
                                      <a
                                        href={`${import.meta.env.VITE_API_BASE_URL}/${activity.pdfPath}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline truncate"
                                      >
                                        View
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Score</label>
                                <select
                                  value={activity.score}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.score`, parseInt(e.target.value))}
                                  disabled={isForCompletion}
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                >
                                  {[1, 2, 3, 4, 5].map(score => (
                                    <option key={score} value={score}>{score}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Results</label>
                                <textarea
                                  value={activity.expectedResults}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.expectedResults`, e.target.value)}
                                  placeholder="What new or enhanced skill or knowledge will you learn from this IDP?"
                                  rows={3}
                                  disabled={isForCompletion}
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                />
                              </div>

                              <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Knowledge Sharing Method</label>
                                <textarea
                                  value={activity.sharingMethod}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.sharingMethod`, e.target.value)}
                                  placeholder="How will you share these enhanced skills or knowledge with your TLs, peers, or direct reports?"
                                  rows={3}
                                  disabled={isForCompletion}
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                />
                              </div>

                              <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Application Method</label>
                                <textarea
                                  value={activity.applicationMethod}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.applicationMethod`, e.target.value)}
                                  placeholder="How will you apply the skills or knowledge that you learned to improve your work performance?"
                                  rows={3}
                                  disabled={isForCompletion}
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom action bar (UI only) */}
        <div className="sticky bottom-0 z-30 pb-4">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white/90 backdrop-blur border border-gray-200 shadow-sm rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">
                  {editMode ? 'Editing IDP' : 'Creating IDP'}
                </span>
                <span className="text-gray-500"> • </span>
                <span className="text-gray-600">{employee?.name || ''}</span>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => navigate('/supervisor')}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  Cancel
                </button>

                {editMode && (idpHeader?.status === 'RETURNED' || idpHeader?.status === 'FOR_COMPLETION') ? (
                  <button
                    onClick={submitIDP}
                    disabled={saving}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    {saving ? 'Resubmitting...' : 'Save & Resubmit'}
                  </button>
                ) : (
                  <button
                    onClick={submitIDP}
                    disabled={saving}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    {saving ? 'Submitting...' : 'Submit IDP'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default CreateIDPPage;
