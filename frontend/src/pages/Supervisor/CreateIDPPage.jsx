// src/pages/Supervisor/CreateIDPPage.jsx
// @ts-nocheck
/* eslint-disable */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { ArrowLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

import {
  COMPLETION_STATUS_OPTIONS,
  DEVELOPMENT_TYPES,
  CRAYON_COLORS,
  SCORING_GUIDE,
} from './idpConstants';

/* ----------------------------- Small UI helpers ---------------------------- */

function ModalShell({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative h-full w-full flex items-center justify-center p-4">
        <div className={`w-full ${maxWidth} bg-white rounded-xl border border-gray-100 shadow-2xl overflow-hidden`}>
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-black">{title}</h3>
            <button onClick={onClose} className="text-black/60" aria-label="Close">
              ✕
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return null;

  const base = 'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border';
  const dot = 'h-1.5 w-1.5 rounded-full';

  const variants = {
    RETURNED: { cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
    SUBMITTED: { cls: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
    CYCLE_COMPLETED: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
    DEFAULT: { cls: 'bg-gray-50 text-gray-800 border-gray-200', dot: 'bg-gray-500' },
  };

  const v = variants[status] || variants.DEFAULT;

  return (
    <span className={`${base} ${v.cls}`}>
      <span className={`${dot} ${v.dot}`} />
      {status}
    </span>
  );
}

function PrimaryActionButton({ onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/30"
    >
      {label}
    </button>
  );
}

function BlackButton({ onClick, disabled, label, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold focus:outline-none focus:ring-2 focus:ring-black/10 ${className}`}
    >
      {label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function TextBox({ value }) {
  return (
    <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-black border border-gray-100 truncate">
      {value}
    </div>
  );
}

function PdfUpload({
  label,
  currentPath,
  accept = 'application/pdf',
  uploadUrl,
  token,
  onUploaded,
  viewHref,
  disabled = false,
  disabledHint,
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <label
          className={`inline-flex items-center px-3 py-2 bg-white border border-gray-200 rounded text-sm ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title={disabled ? disabledHint : ''}
        >
          <input
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={async (e) => {
              if (disabled) return;
              const f = e.target.files && e.target.files[0];
              if (!f) return;

              const form = new FormData();
              form.append('pdf', f);

              try {
                const res = await fetch(uploadUrl, {
                  method: 'POST',
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  body: form,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Upload failed');

                onUploaded?.(data.pdf_path || data.pdfPath || data.pdf_path);
                alert('PDF uploaded');
              } catch (err) {
                console.error('Upload failed', err);
                alert('Upload failed: ' + (err.message || ''));
              }
            }}
          />
          Upload PDF
        </label>

        {!!currentPath && !!viewHref && (
          <a
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline truncate"
          >
            View
          </a>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Main Page ---------------------------------- */

function CreateIDPPage({ routeId, routeEmployeeId } = {}) {
  const params = useParams();
  const employeeId = routeEmployeeId ?? params.employeeId;
  const id = routeId ?? params.id; // edit mode
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employee, setEmployee] = useState(null);
  const [supervisor, setSupervisor] = useState(null);
  const [latestCLScore, setLatestCLScore] = useState(null);

  const [availableCompetencies, setAvailableCompetencies] = useState([]);
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState([]);

  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [idpHeader, setIdpHeader] = useState(null);

  const [missingAttachments, setMissingAttachments] = useState([]);
  const [showMissingModal, setShowMissingModal] = useState(false);

  const [missingActualDates, setMissingActualDates] = useState([]);
  const [showMissingDateModal, setShowMissingDateModal] = useState(false);

  const [idpData, setIdpData] = useState({
    reviewPeriod: '1st Cycle Performance Review',
    nextReviewDate: new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0],
    items: [],
  });

  function normalizeDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const mm = m[1].padStart(2, '0');
      const dd = m[2].padStart(2, '0');
      return `${m[3]}-${mm}-${dd}`;
    }
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
  const isCompletedStatus = useCallback((s) => {
    if (!s) return false;
    const v = String(s).trim().toLowerCase();
    const completedSet = new Set([
      'completed & met expectations',
      'completed & above target expectation',
      'completed & exceeded competency',
    ]);
    return completedSet.has(v);
  }, []);

  // Calculate competency completion status based on activity type
  const getCompetencyCompletionStatus = useCallback((competencyItem) => {
    const mainActivities = competencyItem.developmentActivities || [];
    const extraTables = competencyItem.extraTables || [];
    
    // Check the activity type to determine which activities to count
    const mainActivity = mainActivities[0];
    const activityType = mainActivity?.type?.toLowerCase();
    
    let activitiesToCount = [];
    
    if (activityType === 'education') {
      // For Education: only count the main activity
      activitiesToCount = mainActivities;
    } else if (activityType === 'experience' || activityType === 'exposure') {
      // For Experience/Exposure: only count extra table activities
      activitiesToCount = extraTables;
    } else {
      // For other types: count main activities
      activitiesToCount = mainActivities;
    }
    
    if (activitiesToCount.length === 0) return 'Not Started';
    
    const completedActivities = activitiesToCount.filter(activity => {
      const status = activity.completionStatus || activity.status;
      return isCompletedStatus(status);
    });
    
    if (completedActivities.length === activitiesToCount.length) {
      return 'Completed';
    } else if (completedActivities.length > 0) {
      return `In Progress (${completedActivities.length}/${activitiesToCount.length})`;
    } else {
      return 'Not Started';
    }
  }, [isCompletedStatus]);

  const fromBackendActivity = useCallback(
    (a = {}) => ({
      type: a.type || a.activityType || 'Education',
      activity: a.activity || a.developmentActivity || '',
      targetCompletionDate: normalizeDate(a.targetDate || a.targetCompletionDate || a.target || ''),
      actualCompletionDate: normalizeDate(a.actualDate || a.actualCompletionDate || ''),
      completionStatus: a.status || a.completionStatus || '',
      pdfPath: a.pdf_path || a.pdfPath || a.pdf || '',
      educationJustification: a.educationJustification || a.justification || a.education_justification || '',
      educationJustificationPdf:
        a.educationJustificationPdf || a.education_justification_pdf || a.educationPdf || '',
      expectedResults: a.expectedResults || a.expected_results || '',
      sharingMethod: a.sharingMethod || a.sharing_method || '',
      applicationMethod: a.applicationMethod || a.application_method || '',
      score: a.score || 1,
    }),
    []
  );

  const toBackendActivity = (a = {}) => ({
    type: a.type || a.activityType || 'Education',
    activity: a.activity || a.developmentActivity || '',
    targetDate: normalizeDate(a.targetCompletionDate || a.targetDate || a.target || ''),
    actualDate: normalizeDate(a.actualCompletionDate || a.actualDate || ''),
    status: a.completionStatus || a.status || a.completion_status || '',
    pdf_path: a.pdfPath || a.pdf_path || a.pdf || '',
    educationJustification: a.educationJustification || a.justification || a.education_justification || '',
    educationJustificationPdf: a.educationJustificationPdf || a.education_justification_pdf || a.educationPdf || '',
    expectedResults: a.expectedResults || a.expected_results || '',
    sharingMethod: a.sharingMethod || a.sharing_method || '',
    applicationMethod: a.applicationMethod || a.application_method || '',
    score: Number(a.score || a.points || 1),
  });

  const defaultActivity = useCallback(
    () => ({
      type: 'Education',
      activity: '',
      targetCompletionDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
      actualCompletionDate: '',
      completionStatus: 'Not Started/In Progress (<50%)',
      expectedResults: '',
      sharingMethod: '',
      applicationMethod: '',
      score: 1,
    }),
    []
  );

  const enforceOneActivity = (items = []) =>
    items.map((item) => ({
      ...item,
      developmentActivities: Array.isArray(item.developmentActivities) ? item.developmentActivities.slice(0, 1) : [],
    }));

  // Load for create or edit
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        if (id) {
          setEditMode(true);
          const idpRes = await apiRequest(`/api/idp/${id}`);
          setIdpHeader(idpRes.header);

          // Employee
          if (idpRes.header.employee) setEmployee(idpRes.header.employee);
          else if (idpRes.header.employee_id) {
            try {
              const emp = await apiRequest(`/api/users/${idpRes.header.employee_id}`);
              setEmployee(emp || {});
            } catch {
              setEmployee({});
            }
          } else setEmployee({});

          // Supervisor
          if (idpRes.header.supervisor) setSupervisor(idpRes.header.supervisor);
          else if (idpRes.header.supervisor_id) {
            try {
              const sup = await apiRequest(`/api/users/${idpRes.header.supervisor_id}`);
              setSupervisor(sup || {});
            } catch {
              setSupervisor({});
            }
          } else setSupervisor({});

          const mappedItems = (idpRes.items || []).map((item) => {
            let rawActivity = item.development_activity;
            if (typeof rawActivity === 'string') {
              try {
                rawActivity = JSON.parse(rawActivity);
              } catch {
                rawActivity = {};
              }
            }
            return {
              id: item.id,
              competencyId: item.competency_id,
              competency_id: item.competency_id,
              competencyName: item.competency_name,
              developmentArea: item.competency_area || 'Technical',
              currentLevel: item.current_level,
              targetLevel: item.target_level,
              developmentActivities: [fromBackendActivity(rawActivity || {})],
              extraTables: [],
            };
          });

          setIdpData({
            reviewPeriod: idpRes.header.review_period,
            nextReviewDate: normalizeDate(idpRes.header.next_review_date || idpRes.header.nextReviewDate),
            items: mappedItems,
          });

          // Fallback if older header has no items
          if ((!idpRes.items || idpRes.items.length === 0) && idpRes.header?.employee_id) {
            try {
              const comps = await apiRequest(`/api/cl/employee/${idpRes.header.employee_id}/competencies`);
              const fallbackItems = (comps?.competencies || []).map((comp) => ({
                competencyId: comp.competency_id,
                competency_id: comp.competency_id,
                competencyName: comp.name || comp.competency_name,
                developmentArea: comp.competency_area || 'Technical',
                currentLevel: comp.assigned_level || 1,
                targetLevel: Math.min((comp.assigned_level || 1) + 1, 5),
                developmentActivities: [defaultActivity()],
                extraTables: [],
              }));
              setIdpData((prev) => ({ ...prev, items: fallbackItems }));
            } catch {
              // ignore fallback failure
            }
          }
        } else if (employeeId) {
          const employeeData = await apiRequest(`/api/users/${employeeId}`);

          if (employeeData.supervisor_id) {
            const supervisorData = await apiRequest(`/api/users/${employeeData.supervisor_id}`);
            setSupervisor(supervisorData);
          }

          setEmployee({
            ...employeeData,
            department_name: employeeData.department_name || '',
          });

          // Load competencies from latest APPROVED CL if possible
          let comps = [];
          try {
            const history = await apiRequest(`/api/cl/employee/${employeeId}/history`);
            const approved = (history || []).find((h) => String(h.status).toUpperCase() === 'APPROVED');
            if (approved?.id) {
              const clFull = await apiRequest(`/api/cl/${approved.id}`);
              if (clFull?.items?.length) {
                comps = clFull.items.map((it) => ({
                  competency_id: it.competency_id,
                  competencyId: it.competency_id,
                  competencyName: it.competency_name,
                  competency_area: it.competency_area,
                  assigned_level: it.assigned_level ?? it.self_rating ?? null,
                }));
              }
              // Store the latest approved CL score
              setLatestCLScore(clFull?.total_score || approved?.total_score || null);
            }
          } catch (e) {
            console.error('Failed to load approved CL for assigned levels', e);
          }

          // Fallback to position competencies
          if (!comps?.length) {
            try {
              const competenciesData = await apiRequest(`/api/cl/employee/${employeeId}/competencies`);
              comps = (competenciesData?.competencies || []).map((comp) => ({
                competency_id: comp.competency_id,
                competencyId: comp.competency_id,
                competencyName: comp.name,
                competency_area: comp.competency_area,
                assigned_level: comp.assigned_level ?? comp.assignedLevel ?? comp.assigned ?? null,
              }));
            } catch (e) {
              console.error('Failed to load position competencies', e);
              comps = [];
            }
          }

          setAvailableCompetencies(comps);
          setSelectedCompetencyIds([]);
          setIdpData((prev) => ({ ...prev, items: [] }));
        }
      } catch (err) {
        console.error('Failed to load IDP data:', err);
        alert('Failed to load employee data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (id || employeeId) loadData();
  }, [id, employeeId, fromBackendActivity, defaultActivity]);

  // Update idpData.items when selected competencies change (create mode only)
  useEffect(() => {
    if (editMode) return;
    if (!availableCompetencies?.length) return;

    const selected = selectedCompetencyIds.map((cid) => {
      const comp = availableCompetencies.find((c) => String(c.competency_id || c.competencyId) === String(cid));
      const assigned = (comp && (comp.assigned_level ?? comp.assignedLevel ?? comp.assigned)) ?? 1;

      return {
        competencyId: comp?.competencyId || comp?.competency_id,
        competency_id: comp?.competencyId || comp?.competency_id,
        competencyName: comp?.competencyName || comp?.name || '',
        developmentArea: comp?.competency_area || 'Technical',
        currentLevel: assigned,
        targetLevel: Math.min(Number(assigned) + 1, 5),
        developmentActivities: [defaultActivity()],
        extraTables: [],
      };
    });

    setIdpData((prev) => ({ ...prev, items: selected }));
  }, [selectedCompetencyIds, availableCompetencies, editMode, defaultActivity]);

  const updateIdpData = (path, value) => {
    setIdpData((prev) => {
      const newData = { ...prev };
      const pathArray = path.split('.');
      let current = newData;

      for (let i = 0; i < pathArray.length - 1; i++) {
        if (!current[pathArray[i]]) current[pathArray[i]] = {};
        current = current[pathArray[i]];
      }
      current[pathArray[pathArray.length - 1]] = value;

      // Safety: keep ONLY one activity per competency
      if (Array.isArray(newData.items)) newData.items = enforceOneActivity(newData.items);

      return newData;
    });
  };

  const addExtraTable = (itemIndex) => {
    setIdpData((prev) => {
      const items = (prev.items || []).map((it, idx) => {
        if (idx !== itemIndex) return it;
        const extra = Array.isArray(it.extraTables) ? [...it.extraTables] : [];
        extra.push({
          targetCompletionDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
          actualCompletionDate: '',
          developmentActivity: '',
          completionStatus: 'Not Started/In Progress (<50%)',
          score: 1,
          expectedResults: '',
          sharingMethod: '',
          applicationMethod: '',
          pdfPath: '',
          educationJustificationPdf: '',
        });
        return { ...it, extraTables: extra };
      });
      return { ...prev, items };
    });
  };

  const removeExtraTable = (itemIndex, tableIndex) => {
    setIdpData((prev) => {
      const items = (prev.items || []).map((it, idx) => {
        if (idx !== itemIndex) return it;
        const extra = Array.isArray(it.extraTables) ? it.extraTables.filter((_, i) => i !== tableIndex) : [];
        return { ...it, extraTables: extra };
      });
      return { ...prev, items };
    });
  };

  const submitIDP = async () => {
    // Validate: any activity marked Completed MUST have an Actual Completion Date
    const missingDates = [];
    (idpData.items || []).forEach((it, idx) => {
      const act = (it.developmentActivities || [])[0] || {};
      if (act && isCompletedStatus(act.completionStatus) && !act.actualCompletionDate) {
        missingDates.push({ itemIndex: idx, competencyName: it.competencyName || '#' + (it.competencyId || idx) });
      }
    });
    if (missingDates.length) {
      setMissingActualDates(missingDates);
      setShowMissingDateModal(true);
      return;
    }

    // Validate: any Education activity MUST have an uploaded justification PDF
    const missing = [];
    (idpData.items || []).forEach((it, idx) => {
      const act = (it.developmentActivities || [])[0] || {};
      if (act && act.type === 'Education' && !act.educationJustificationPdf) {
        missing.push({ itemIndex: idx, competencyName: it.competencyName || '#' + (it.competencyId || idx) });
      }
    });
    if (missing.length) {
      setMissingAttachments(missing);
      setShowMissingModal(true);
      return;
    }

    try {
      setSaving(true);

      const enforcedItems = enforceOneActivity(idpData.items || []);

      // Validation for create mode: must select between 1 and 3 competencies
      if (!editMode) {
        const count = enforcedItems.length;
        if (count < 1) {
          alert('Please select at least one competency (minimum 1).');
          setSaving(false);
          return;
        }
        if (count > 2) {
          alert('You may select a maximum of 2 competencies.');
          setSaving(false);
          return;
        }
      }

      if (editMode && id) {
        const payload = {
          reviewPeriod: idpData.reviewPeriod,
          nextReviewDate: normalizeDate(idpData.nextReviewDate),
          items: (idpData.items || []).map((it) => ({
            id: it.id,
            competency_id: it.competency_id || it.competencyId || it.competency_id,
            development_activity: JSON.stringify(toBackendActivity((it.developmentActivities || [])[0] || {})),
          })),
        };

        await apiRequest(`/api/idp/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        });

        await apiRequest(`/api/idp/${id}/submit`, { method: 'PUT' });

        alert('IDP resubmitted successfully!');
        navigate('/supervisor');
        return;
      }

      // Create mode
      const payload = {
        employeeId: parseInt(employeeId),
        supervisorId: employee?.supervisor_id,
        reviewPeriod: idpData.reviewPeriod,
        nextReviewDate: normalizeDate(idpData.nextReviewDate),
        items: enforcedItems.map((it) => ({
          ...it,
          developmentActivities: (it.developmentActivities || []).map((a) => toBackendActivity(a)),
        })),
      };

      const createRes = await apiRequest('/api/idp/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const idpId = createRes?.id;
      if (!idpId) throw new Error('Failed to create IDP. No ID returned.');

      await apiRequest(`/api/idp/${idpId}/submit`, { method: 'PUT' });

      alert('IDP submitted successfully!');
      navigate('/supervisor');
    } catch (err) {
      console.error('Failed to submit IDP:', err);
      alert('Failed to submit IDP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const creationDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const canResubmit = editMode && (idpHeader?.status === 'RETURNED' || idpHeader?.status === 'FOR_COMPLETION');
  const submitLabel = saving ? (canResubmit ? 'Resubmitting...' : 'Submitting...') : canResubmit ? 'Save & Resubmit' : 'Submit IDP';

  const areaColor = (area) => {
    const safe = CRAYON_COLORS && typeof CRAYON_COLORS === 'object' ? CRAYON_COLORS : {};
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

  const apiBase = import.meta.env.VITE_API_BASE_URL;
  const token = localStorage.getItem('token');

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
                  <h1 className="text-xl font-bold text-white leading-tight">Individual Development Plan (IDP)</h1>
                  <StatusBadge status={idpHeader?.status} />
                </div>
                <p className="text-xs text-white/70 mt-0.5 truncate">
                  {editMode ? `Edit IDP for ${employee?.name || ''}` : `Create IDP for ${employee?.name || ''}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => setShowScoringGuide((v) => !v)}
                className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-3 py-2 rounded-md hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <InformationCircleIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Scoring Guide</span>
                <span className="sm:hidden">Guide</span>
              </button>

              <PrimaryActionButton onClick={submitIDP} disabled={saving} label={submitLabel} />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Scoring Guide Modal */}
        {showScoringGuide && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowScoringGuide(false)} aria-hidden="true" />
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

        {/* Missing PDF modal */}
        {showMissingModal && (
          <ModalShell title="Missing Attachment(s)" onClose={() => setShowMissingModal(false)} maxWidth="max-w-lg">
            <p className="text-sm text-gray-600">
              One or more activities marked Completed have no attached PDF. Please attach proof before submitting.
            </p>
            <ul className="mt-3 max-h-40 overflow-auto list-disc list-inside text-sm text-gray-800">
              {missingAttachments.map((m, i) => (
                <li key={i}>{m.competencyName}</li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowMissingModal(false)}
                className="px-4 py-2 rounded-md bg-white border border-gray-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowMissingModal(false);
                  const first = missingAttachments[0];
                  const el = document.getElementById(`item-${first.itemIndex}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="px-4 py-2 rounded-md bg-black text-white"
              >
                Go to first missing
              </button>
            </div>
          </ModalShell>
        )}

        {/* Missing date modal */}
        {showMissingDateModal && (
          <ModalShell title="Missing Actual Completion Date(s)" onClose={() => setShowMissingDateModal(false)} maxWidth="max-w-lg">
            <p className="text-sm text-gray-600">
              One or more activities marked Completed are missing the Actual Completion Date. Please provide the date before submitting.
            </p>
            <ul className="mt-3 max-h-40 overflow-auto list-disc list-inside text-sm text-gray-800">
              {missingActualDates.map((m, i) => (
                <li key={i}>{m.competencyName}</li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowMissingDateModal(false)}
                className="px-4 py-2 rounded-md bg-white border border-gray-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowMissingDateModal(false);
                  const first = missingActualDates[0];
                  const el = document.getElementById(`item-${first.itemIndex}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="px-4 py-2 rounded-md bg-black text-white"
              >
                Go to first missing
              </button>
            </div>
          </ModalShell>
        )}

        {/* Top summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee card */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-black">Employee Information</h2>
                <p className="text-sm text-gray-600 mt-1">Review details and complete the development activity fields below.</p>
              </div>
              <div className="text-xs text-gray-500 text-right">
                <div className="hidden sm:block">Date of IDP Creation</div>
                <div className="font-semibold text-gray-800">{creationDate}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                <TextBox value={employee.name} />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Position</label>
                <TextBox value={employee.position_title} />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                <TextBox value={employee.department_name} />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Supervisor/Manager</label>
                <TextBox value={supervisor?.name || 'N/A'} />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-gray-600 mb-1">CL Score</label>
                <TextBox value={latestCLScore ? Number(latestCLScore).toFixed(2) : 'No approved CL'} />
              </div>

              <div className="sm:col-span-1 lg:col-span-2">
                <Field label="Review Period">
                  <input
                    type="text"
                    value={idpData.reviewPeriod}
                    onChange={(e) => updateIdpData('reviewPeriod', e.target.value)}
                    className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                  />
                </Field>
              </div>

              <Field label="Next Review Date">
                <input
                  type="date"
                  value={idpData.nextReviewDate}
                  onChange={(e) => updateIdpData('nextReviewDate', e.target.value)}
                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                />
              </Field>

              <div className="sm:hidden lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date of IDP Creation</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-semibold text-black border border-gray-100">
                  {creationDate}
                </div>
              </div>
            </div>
          </div>

          {/* Helpful Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-black">Helpful Notes</h3>
            <div className="mt-3 space-y-3 text-sm text-gray-700">
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="text-xs font-semibold text-gray-600">Activities</div>
                <div className="mt-1">One activity per competency is enforced.</div>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="text-xs font-semibold text-gray-600">Tip</div>
                <div className="mt-1">Fill out “Expected Results”, “Knowledge Sharing”, and “Application Method” for a complete submission.</div>
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

        {/* Competency selector */}
        {!editMode && availableCompetencies?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-black">Select Competencies (min 1, max 2)</h3>
            <p className="text-xs text-gray-500 mt-1">
              Choose up to two competencies from the employee&apos;s competency list to include in this IDP. Only level 1-2 competencies are eligible.
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {availableCompetencies.map((comp) => {
                const cid = comp.competencyId || comp.competency_id;
                const currentLevel = comp.assigned_level ?? comp.assignedLevel ?? comp.assigned ?? 1;
                const checked = selectedCompetencyIds.includes(String(cid));
                const isLevelTooHigh = currentLevel >= 3;
                const disabled = !checked && (selectedCompetencyIds.length >= 2 || isLevelTooHigh);
                const tooltipText = isLevelTooHigh ? 'Level 3+ competencies are not eligible for IDP' : '';

                return (
                  <label
                    key={cid}
                    className={`flex items-center gap-3 p-2 rounded border ${
                      checked ? 'border-blue-300 bg-blue-50' : isLevelTooHigh ? 'border-gray-200 bg-gray-100' : 'border-gray-100 bg-white'
                    } ${disabled && !checked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    title={tooltipText}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => {
                        if (isLevelTooHigh) return;
                        const v = String(cid);
                        if (e.target.checked) {
                          if (selectedCompetencyIds.length >= 2) return;
                          setSelectedCompetencyIds((prev) => [...prev, v]);
                        } else {
                          setSelectedCompetencyIds((prev) => prev.filter((x) => x !== v));
                        }
                      }}
                    />
                    <div className="text-sm">
                      <div className={`font-semibold ${isLevelTooHigh ? 'text-gray-500' : 'text-gray-800'}`}>{comp.competencyName || comp.name}</div>
                      <div className={`text-xs ${isLevelTooHigh ? 'text-gray-400' : 'text-gray-500'}`}>
                        Current level: {currentLevel}{isLevelTooHigh ? ' (Not eligible)' : ''}
                      </div>
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
                <p className="text-sm text-gray-600 mt-1">Update the fields inside each competency card.</p>
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
                <p className="text-sm text-gray-600 mt-1">Employee must have approved CL competencies before creating IDP.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {idpData.items.map((item, itemIndex) => {
                  const activity = (item.developmentActivities || [])[0];
                  const chip = areaColor(item.developmentArea);
                  const isExpOrExposure = !!activity && ['experience', 'exposure'].includes(String(activity.type || '').toLowerCase());
                  const competencyStatus = getCompetencyCompletionStatus(item);
                  
                  // Calculate activities count based on activity type (same logic as completion status)
                  const mainActivities = (item.developmentActivities || []);
                  const extraTables = (item.extraTables || []);
                  const activityType = activity?.type?.toLowerCase();
                  
                  let totalActivities = 0;
                  if (activityType === 'education') {
                    // For Education: only count the main activity
                    totalActivities = mainActivities.length;
                  } else if (activityType === 'experience' || activityType === 'exposure') {
                    // For Experience/Exposure: only count extra table activities
                    totalActivities = extraTables.length;
                  } else {
                    // For other types: count main activities
                    totalActivities = mainActivities.length;
                  }

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
                              <span className="text-base font-semibold text-black">{item.competencyName}</span>
                              <span
                                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${chip.bg} ${chip.text} ${chip.border}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                                {item.developmentArea}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              Current level <span className="font-semibold text-gray-900">{item.currentLevel}</span> → Target level{' '}
                              <span className="font-semibold text-gray-900">{item.targetLevel}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-gray-500 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100">
                              {totalActivities} {totalActivities === 1 ? 'Activity' : 'Activities'}
                            </span>
                            
                            {/* Circular Progress Chart */}
                            <div className="flex items-center gap-2">
                              <div className="relative w-12 h-12">
                                <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                                  {/* Background circle */}
                                  <path
                                    d="M18 2.0845
                                      a 15.9155 15.9155 0 0 1 0 31.831
                                      a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="#e5e7eb"
                                    strokeWidth="3"
                                  />
                                  {/* Progress circle */}
                                  <path
                                    d="M18 2.0845
                                      a 15.9155 15.9155 0 0 1 0 31.831
                                      a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke={
                                      totalActivities === 0 ? '#d1d5db' :
                                      (activityType === 'experience' || activityType === 'exposure' 
                                        ? (item.extraTables || []).filter(t => isCompletedStatus(t.completionStatus || t.status)).length === totalActivities && totalActivities > 0
                                        : (item.developmentActivities || []).filter(a => isCompletedStatus(a.completionStatus || a.status)).length === totalActivities && totalActivities > 0)
                                        ? '#10b981' 
                                        : (activityType === 'experience' || activityType === 'exposure' 
                                          ? (item.extraTables || []).filter(t => isCompletedStatus(t.completionStatus || t.status)).length > 0
                                          : (item.developmentActivities || []).filter(a => isCompletedStatus(a.completionStatus || a.status)).length > 0)
                                          ? '#3b82f6' 
                                          : '#9ca3af'
                                    }
                                    strokeWidth="3"
                                    strokeDasharray={`${totalActivities === 0 ? 0 : Math.round(((
                                      activityType === 'experience' || activityType === 'exposure' 
                                        ? (item.extraTables || []).filter(t => isCompletedStatus(t.completionStatus || t.status)).length
                                        : (item.developmentActivities || []).filter(a => isCompletedStatus(a.completionStatus || a.status)).length
                                    ) / totalActivities) * 100)}, 100`}
                                    className="transition-all duration-300 ease-out"
                                  />
                                </svg>
                                {/* Center percentage text */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className={`text-xs font-bold ${
                                    totalActivities === 0 ? 'text-gray-400' :
                                    (activityType === 'experience' || activityType === 'exposure' 
                                      ? (item.extraTables || []).filter(t => isCompletedStatus(t.completionStatus || t.status)).length === totalActivities && totalActivities > 0
                                      : (item.developmentActivities || []).filter(a => isCompletedStatus(a.completionStatus || a.status)).length === totalActivities && totalActivities > 0)
                                      ? 'text-emerald-600' 
                                      : (activityType === 'experience' || activityType === 'exposure' 
                                        ? (item.extraTables || []).filter(t => isCompletedStatus(t.completionStatus || t.status)).length > 0
                                        : (item.developmentActivities || []).filter(a => isCompletedStatus(a.completionStatus || a.status)).length > 0)
                                        ? 'text-blue-600' 
                                        : 'text-gray-500'
                                  }`}>
                                    {totalActivities === 0 ? '0%' : Math.round(((
                                      activityType === 'experience' || activityType === 'exposure' 
                                        ? (item.extraTables || []).filter(t => isCompletedStatus(t.completionStatus || t.status)).length
                                        : (item.developmentActivities || []).filter(a => isCompletedStatus(a.completionStatus || a.status)).length
                                    ) / totalActivities) * 100)}%
                                  </span>
                                </div>
                              </div>
                              <StatusBadge status={competencyStatus} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        {!activity ? (
                          <div className="px-3 py-3 bg-white rounded-lg text-sm text-gray-600 border border-gray-100">
                            No activity initialized.
                          </div>
                        ) : (
                          <div>
                            {isExpOrExposure && (
                              <div className="p-4 mb-4 bg-white rounded-xl border border-gray-100">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm text-gray-700">This activity type uses additional table entries.</div>
                                  <BlackButton
                                    onClick={() => addExtraTable(itemIndex)}
                                    label="+ Add Table"
                                    className="text-sm px-3 py-2 rounded-md"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="mb-4">
                              <Field label="Type">
                                <select
                                  value={activity.type}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.type`, e.target.value)}
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                >
                                  {DEVELOPMENT_TYPES.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                  ))}
                                </select>
                              </Field>
                            </div>

                            {activity.type === 'Education' ? (
                              <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <Field label="Target Completion Date">
                                  <input
                                    type="date"
                                    value={activity.targetCompletionDate || ''}
                                    onChange={(e) =>
                                      updateIdpData(`items.${itemIndex}.developmentActivities.0.targetCompletionDate`, e.target.value)
                                    }
                                    className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                  />
                                </Field>

                                <Field label="Actual Completion Date">
                                  <input
                                    type="date"
                                    value={activity.actualCompletionDate}
                                    onChange={(e) =>
                                      updateIdpData(`items.${itemIndex}.developmentActivities.0.actualCompletionDate`, e.target.value)
                                    }
                                    disabled={!isCompletedStatus(activity.completionStatus)}
                                    required={isCompletedStatus(activity.completionStatus)}
                                    className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                  />
                                </Field>

                                {activity.type === 'Education' && (
                                  <PdfUpload
                                    label="Education Justification (PDF)"
                                    currentPath={activity.educationJustificationPdf}
                                    uploadUrl={`${apiBase}/api/idp/upload`}
                                    token={token}
                                    onUploaded={(path) =>
                                      updateIdpData(`items.${itemIndex}.developmentActivities.0.educationJustificationPdf`, path)
                                    }
                                    viewHref={activity.educationJustificationPdf ? `${apiBase}/${activity.educationJustificationPdf}` : ''}
                                  />
                                )}

                                <div className="flex flex-col">
                                  <Field label="Completion Status">
                                    <select
                                      value={activity.completionStatus}
                                      onChange={(e) =>
                                        updateIdpData(`items.${itemIndex}.developmentActivities.0.completionStatus`, e.target.value)
                                      }
                                      className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                    >
                                      {COMPLETION_STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>
                                          {status}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>

                                  {((activity.pdfPath) || isCompletedStatus(activity.completionStatus)) && (
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

                                      <label
                                        className={`inline-flex items-center px-3 py-2 bg-white border border-gray-200 rounded text-sm ${
                                          !isCompletedStatus(activity.completionStatus) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                      >
                                        <input
                                          type="file"
                                          accept="application/pdf"
                                          style={{ display: 'none' }}
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
                                              const res = await fetch(`${apiBase}/api/idp/upload`, {
                                                method: 'POST',
                                                headers: { Authorization: `Bearer ${token}` },
                                                body: form,
                                              });
                                              const data = await res.json();
                                              if (!res.ok) throw new Error(data.message || 'Upload failed');
                                              updateIdpData(`items.${itemIndex}.developmentActivities.0.pdfPath`, data.pdf_path);
                                              alert('PDF uploaded');
                                            } catch (err) {
                                              console.error('Upload failed', err);
                                              alert('Upload failed: ' + (err.message || ''));
                                            }
                                          }}
                                        />
                                        Upload
                                      </label>

                                      {activity.pdfPath && (
                                        <a
                                          href={`${apiBase}/${activity.pdfPath}`}
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

                                  <Field label="Score">
                                    <select
                                      value={activity.score}
                                      onChange={(e) =>
                                        updateIdpData(`items.${itemIndex}.developmentActivities.0.score`, parseInt(e.target.value))
                                      }
                                      className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                    >
                                      {[1, 2, 3, 4, 5].map((score) => (
                                        <option key={score} value={score}>
                                          {score}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>
                                </div>
                              </div>
                            ) : isExpOrExposure ? null : (
                              <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="lg:col-span-3">
                                    <Field label="Development Activity">
                                      <input
                                        type="text"
                                        value={activity.activity}
                                        onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.activity`, e.target.value)}
                                        placeholder="Describe the development activity..."
                                        className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                      />
                                    </Field>
                                  </div>

                                  <div className="lg:col-span-3">
                                    <Field label="Expected Results">
                                      <textarea
                                        value={activity.expectedResults}
                                        onChange={(e) =>
                                          updateIdpData(`items.${itemIndex}.developmentActivities.0.expectedResults`, e.target.value)
                                        }
                                        placeholder="What new or enhanced skill or knowledge will you learn from this IDP?"
                                        rows={3}
                                        className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                      />
                                    </Field>
                                  </div>

                                  <div className="lg:col-span-3">
                                    <Field label="Knowledge Sharing Method">
                                      <textarea
                                        value={activity.sharingMethod}
                                        onChange={(e) =>
                                          updateIdpData(`items.${itemIndex}.developmentActivities.0.sharingMethod`, e.target.value)
                                        }
                                        placeholder="How will you share these enhanced skills or knowledge with your TLs, peers, or direct reports?"
                                        rows={3}
                                        className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                      />
                                    </Field>
                                  </div>

                                  <div className="lg:col-span-3">
                                    <Field label="Application Method">
                                      <textarea
                                        value={activity.applicationMethod}
                                        onChange={(e) =>
                                          updateIdpData(`items.${itemIndex}.developmentActivities.0.applicationMethod`, e.target.value)
                                        }
                                        placeholder="How will you apply the skills or knowledge that you learned to improve your work performance?"
                                        rows={3}
                                        className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 border border-gray-100"
                                      />
                                    </Field>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Extra tables for Exposure/Experience */}
                        {Array.isArray(item.extraTables) && item.extraTables.length > 0 && (
                          <div className="lg:col-span-3 mt-4 w-full">
                            {item.extraTables.map((t, ti) => (
                              <div key={ti} className="mb-4 border rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between bg-gray-100 px-3 py-2 border-b">
                                  <div className="text-sm font-semibold">Q{ti + 1}</div>
                                  <button
                                    type="button"
                                    onClick={() => removeExtraTable(itemIndex, ti)}
                                    className="text-sm text-red-600 hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="p-3 bg-white">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <Field label="Target Completion Date">
                                      <input
                                        type="date"
                                        value={t.targetCompletionDate || ''}
                                        onChange={(e) =>
                                          updateIdpData(`items.${itemIndex}.extraTables.${ti}.targetCompletionDate`, e.target.value)
                                        }
                                        className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100"
                                      />
                                    </Field>

                                    <Field label="Actual Completion Date">
                                      <input
                                        type="date"
                                        value={t.actualCompletionDate || ''}
                                        onChange={(e) =>
                                          updateIdpData(`items.${itemIndex}.extraTables.${ti}.actualCompletionDate`, e.target.value)
                                        }
                                        className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100"
                                      />
                                    </Field>

                                    <Field label="Development Activity">
                                      <input
                                        type="text"
                                        value={t.developmentActivity || ''}
                                        onChange={(e) =>
                                          updateIdpData(`items.${itemIndex}.extraTables.${ti}.developmentActivity`, e.target.value)
                                        }
                                        placeholder="Describe the development activity..."
                                        className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100"
                                      />
                                    </Field>

                                    <Field label="Completion Status">
                                      <select
                                        value={t.completionStatus || ''}
                                        onChange={(e) =>
                                          updateIdpData(`items.${itemIndex}.extraTables.${ti}.completionStatus`, e.target.value)
                                        }
                                        className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100"
                                      >
                                        {COMPLETION_STATUS_OPTIONS.map((status) => (
                                          <option key={status} value={status}>
                                            {status}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>

                                    <Field label="Score">
                                      <select
                                        value={t.score || 1}
                                        onChange={(e) => updateIdpData(`items.${itemIndex}.extraTables.${ti}.score`, parseInt(e.target.value))}
                                        className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100"
                                      >
                                        {[1, 2, 3, 4, 5].map((s) => (
                                          <option key={s} value={s}>
                                            {s}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>

                                    {((t.pdfPath) || isCompletedStatus(t.completionStatus)) && (
                                      <div className="lg:col-span-3 flex items-center gap-2 w-full">
                                        <select
                                          value={t.pdfPath || ''}
                                          onChange={(e) => updateIdpData(`items.${itemIndex}.extraTables.${ti}.pdfPath`, e.target.value)}
                                          className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100 truncate"
                                        >
                                          <option value="">-- No file --</option>
                                          {t.pdfPath && (
                                            <option value={t.pdfPath}>{t.pdfPath.split('/').pop()}</option>
                                          )}
                                        </select>

                                        <label
                                          className={`inline-flex items-center px-3 py-2 bg-white border border-gray-200 rounded text-sm ${
                                            !isCompletedStatus(t.completionStatus) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                          }`}
                                        >
                                          <input
                                            type="file"
                                            accept="application/pdf"
                                            style={{ display: 'none' }}
                                            onChange={async (e) => {
                                              if (!isCompletedStatus(t.completionStatus)) {
                                                alert('Please mark activity as Completed to upload proof.');
                                                return;
                                              }
                                              const f = e.target.files && e.target.files[0];
                                              if (!f) return;

                                              const form = new FormData();
                                              form.append('pdf', f);

                                              try {
                                                const res = await fetch(`${apiBase}/api/idp/upload`, {
                                                  method: 'POST',
                                                  headers: { Authorization: `Bearer ${token}` },
                                                  body: form,
                                                });
                                                const data = await res.json();
                                                if (!res.ok) throw new Error(data.message || 'Upload failed');
                                                updateIdpData(`items.${itemIndex}.extraTables.${ti}.pdfPath`, data.pdf_path);
                                                alert('PDF uploaded');
                                              } catch (err) {
                                                console.error('Upload failed', err);
                                                alert('Upload failed: ' + (err.message || ''));
                                              }
                                            }}
                                          />
                                          Upload
                                        </label>

                                        {t.pdfPath && (
                                          <a
                                            href={`${apiBase}/${t.pdfPath}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline truncate"
                                          >
                                            View
                                          </a>
                                        )}
                                      </div>
                                    )}

                                    <div className="md:col-span-2 lg:col-span-3">
                                      <Field label="Expected Results">
                                        <textarea
                                          value={t.expectedResults || ''}
                                          onChange={(e) =>
                                            updateIdpData(`items.${itemIndex}.extraTables.${ti}.expectedResults`, e.target.value)
                                          }
                                          rows={3}
                                          className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100"
                                        />
                                      </Field>
                                    </div>

                                    <div className="md:col-span-2 lg:col-span-3">
                                      <Field label="Knowledge Sharing Method">
                                        <textarea
                                          value={t.sharingMethod || ''}
                                          onChange={(e) =>
                                            updateIdpData(`items.${itemIndex}.extraTables.${ti}.sharingMethod`, e.target.value)
                                          }
                                          rows={3}
                                          className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100"
                                        />
                                      </Field>
                                    </div>

                                    <div className="md:col-span-2 lg:col-span-3">
                                      <Field label="Application Method">
                                        <textarea
                                          value={t.applicationMethod || ''}
                                          onChange={(e) =>
                                            updateIdpData(`items.${itemIndex}.extraTables.${ti}.applicationMethod`, e.target.value)
                                          }
                                          rows={3}
                                          className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black border border-gray-100"
                                        />
                                      </Field>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
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

        {/* Bottom action bar */}
        <div className="sticky bottom-0 z-30 pb-4">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white/90 backdrop-blur border border-gray-200 shadow-sm rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{editMode ? 'Editing IDP' : 'Creating IDP'}</span>
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

                <BlackButton onClick={submitIDP} disabled={saving} label={submitLabel} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateIDPPage;
