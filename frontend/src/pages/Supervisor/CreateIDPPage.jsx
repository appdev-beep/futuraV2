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
        <div className={`w-full ${maxWidth} bg-white rounded-xl border-0 shadow-2xl overflow-hidden`}>
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

  const base = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border';
  const dot = 'h-2 w-2 rounded-full';

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

function Field({ label, children, readOnly = false }) {
  return (
    <div>
      <label className={`block ${readOnly ? 'text-sm font-bold' : 'text-sm font-bold'} text-gray-700 mb-2`}>{label}</label>
      {children}
    </div>
  );
}

function TextBox({ value, readOnly = false }) {
  return (
    <div className={`px-3 py-2 bg-gray-50 rounded-lg ${readOnly ? 'text-base' : 'text-sm'} font-semibold text-black ${readOnly ? 'border-0' : 'border border-gray-100'}`}>
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
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
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
  const searchParams = new URLSearchParams(window.location.search);
  const employeeId = routeEmployeeId ?? params.employeeId;
  const id = routeId ?? params.id; // edit mode
  
  // Force viewOnly for employees - they can only acknowledge, not edit
  const userRole = (() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.role;
      }
    } catch (e) {}
    return null;
  })();
  
  // Initialize viewOnly state - will be updated when IDP data is loaded
  const [viewOnly, setViewOnly] = useState(searchParams.get('viewOnly') === 'true' || userRole === 'Employee');

  const navigate = useNavigate();

  // Determine user role and back navigation
  const getUserRole = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.role;
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  const getBackRoute = () => {
    const role = getUserRole();
    if (viewOnly) {
      if (role === 'Employee') return '/employee';
      if (role === 'Manager') return '/manager';
      if (role === 'AM') return '/am';
      if (role === 'HR') return '/hr';
      return '/supervisor';
    }
    return '/supervisor';
  };

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

  const [validationError, setValidationError] = useState(null);
  const [showValidationErrorModal, setShowValidationErrorModal] = useState(false);

  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);

  // Manager review state
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
      'completed',
      'completed & met expectations',
      'completed & above target expectation',
      'completed & exceeded competency',
    ]);
    return completedSet.has(v);
  }, []);

  // Calculate if all activities across all competencies are 100% complete
  const areAllActivitiesComplete = useMemo(() => {
    if (!idpData.items || idpData.items.length === 0) return false;
    
    return idpData.items.every(item => {
      const activity = (item.developmentActivities || [])[0];
      const mainActivities = (item.developmentActivities || []);
      const extraTables = (item.extraTables || []);
      const activityType = activity?.type?.toLowerCase();
      
      let totalActivities = 0;
      let completedActivities = 0;
      
      if (activityType === 'education') {
        totalActivities = mainActivities.length;
        completedActivities = mainActivities.filter(a => isCompletedStatus(a.completionStatus || a.status)).length;
      } else if (activityType === 'experience' || activityType === 'exposure') {
        totalActivities = extraTables.length;
        completedActivities = extraTables.filter(t => {
          const areas = t.areasOfExposure || [];
          if (areas.length === 0) return false;
          const completedAreas = areas.filter(a => a.status === 'Completed').length;
          return completedAreas === areas.length;
        }).length;
      } else {
        totalActivities = mainActivities.length;
        completedActivities = mainActivities.filter(a => isCompletedStatus(a.completionStatus || a.status)).length;
      }
      
      // This competency is complete if all its activities are complete
      return totalActivities > 0 && completedActivities === totalActivities;
    });
  }, [idpData.items, isCompletedStatus]);

  // Handle cycle completion approval for HR
  const handleApproveCycleCompletion = async () => {
    if (!window.confirm('Are you sure you want to approve this IDP for cycle completion?')) {
      return;
    }
    
    setActionLoading(true);
    try {
      await apiRequest(`/api/idp/${id}/hr/approve-cycle`, {
        method: 'PUT',
        body: JSON.stringify({ remarks: remarks || '' }),
      });
      alert('IDP cycle completion approved successfully!');
      // Refresh the page or navigate back
      window.location.reload();
    } catch (err) {
      console.error('Cycle completion approval failed:', err);
      alert(`Failed to approve cycle completion: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

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
      type: '',
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
          // Load IDP for viewing or editing
          const idpRes = await apiRequest(`/api/idp/${id}`);
          setIdpHeader(idpRes.header);

          // Check if supervisor should be in view-only mode based on IDP status
          const status = idpRes.header?.status;
          const readOnlyStatuses = [
            'PENDING_EMPLOYEE', 'PENDING_MANAGER', 'PENDING_AM', 'PENDING_HR', 
            'CYCLE_COMPLETED', 'ACKNOWLEDGED'
          ];
          
          // Determine final viewOnly state
          let finalViewOnly = viewOnly;
          if (!viewOnly && status && readOnlyStatuses.includes(status) && userRole === 'Supervisor') {
            finalViewOnly = true;
            setViewOnly(true);
          }
          
          // Set edit mode only if not in view-only mode
          if (!finalViewOnly) {
            setEditMode(true);
          }

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

          // Load CL score for the employee
          if (idpRes.header?.employee_id) {
            try {
              const history = await apiRequest(`/api/cl/employee/${idpRes.header.employee_id}/history`);
              const approved = (history || []).find((h) => String(h.status).toUpperCase() === 'APPROVED');
              if (approved?.id) {
                const clFull = await apiRequest(`/api/cl/${approved.id}`);
                setLatestCLScore(clFull?.total_score || approved?.total_score || null);
              }
            } catch (e) {
              console.error('Failed to load CL score in edit mode', e);
            }
          }

          const mappedItems = (idpRes.items || []).map((item) => {
            let rawActivity = item.development_activity;
            if (typeof rawActivity === 'string') {
              try {
                rawActivity = JSON.parse(rawActivity);
              } catch {
                rawActivity = {};
              }
            }

            // Map extra tables with areas of exposure
            const extraTables = (item.extra_tables || []).map(et => ({
              id: et.id,
              quarter: et.quarter,
              targetCompletionDate: et.targetCompletionDate || '',
              actualCompletionDate: et.actualCompletionDate || '',
              developmentActivity: et.developmentActivity || '',
              completionStatus: et.completionStatus || 'Not Started/In Progress (<50%)',
              score: et.score || 1,
              expectedResults: et.expectedResults || '',
              sharingMethod: et.sharingMethod || '',
              applicationMethod: et.applicationMethod || '',
              pdfPath: et.pdfPath || '',
              educationJustificationPdf: et.educationJustificationPdf || '',
              exposureStartDate: et.exposureStartDate || '',
              learning: et.learning || '',
              areasOfExposure: (et.areasOfExposure || []).map(area => ({
                id: area.id,
                area: area.area || '',
                status: area.status || 'Not Started',
                dateTime: area.datetime ? new Date(area.datetime).toISOString().slice(0, 16) : '', // Convert to datetime-local format
                duration: area.durationHours || '', // Map backend 'durationHours' to frontend 'duration'  
                trainerName: area.trainerName || '',
                comments: area.comments || '',
                // Keep backend fields for compatibility
                datetime: area.datetime || '',
                durationHours: area.durationHours || ''
              }))
            }));

            return {
              id: item.id,
              competencyId: item.competency_id,
              competency_id: item.competency_id,
              competencyName: item.competency_name,
              developmentArea: item.competency_area || 'Technical',
              currentLevel: item.current_level,
              targetLevel: item.target_level,
              developmentActivities: [fromBackendActivity(rawActivity || {})],
              extraTables: extraTables,
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

    setIdpData((prev) => {
      const currentItems = prev.items || [];
      
      // Create a map of existing items by competency ID for quick lookup
      const existingMap = new Map(
        currentItems.map((item) => [
          String(item.competencyId || item.competency_id),
          item,
        ])
      );

      // Build new items list from selected competencies
      const selected = selectedCompetencyIds.map((cid) => {
        const cidStr = String(cid);
        
        // If this item already exists, preserve it with all its data
        if (existingMap.has(cidStr)) {
          return existingMap.get(cidStr);
        }

        // Otherwise, create a new item
        const comp = availableCompetencies.find((c) => String(c.competency_id || c.competencyId) === cidStr);
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

      return { ...prev, items: selected };
    });
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

      // Auto-create one extra table for Experience/Exposure if not already created
      if (path.includes('developmentActivities.0.type') && (value === 'Experience' || value === 'Exposure')) {
        const itemIndex = parseInt(pathArray[1]);
        if (newData.items && newData.items[itemIndex]) {
          if (!Array.isArray(newData.items[itemIndex].extraTables) || newData.items[itemIndex].extraTables.length === 0) {
            newData.items[itemIndex].extraTables = [
              {
                targetCompletionDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
                actualCompletionDate: '',
                developmentActivity: '',
                completionStatus: 'Not Started/In Progress (<50%)',
                score: 1,
                pdfPath: '',
                expectedResults: '',
                sharingMethod: '',
                applicationMethod: '',
              }
            ];
          }
        }
      }
      
      // Clear extra tables when switching away from Experience/Exposure
      if (path.includes('developmentActivities.0.type') && value !== 'Experience' && value !== 'Exposure') {
        const itemIndex = parseInt(pathArray[1]);
        if (newData.items && newData.items[itemIndex]) {
          newData.items[itemIndex].extraTables = [];
        }
      }

      return newData;
    });
  };

  const addExtraTable = (itemIndex) => {
    setIdpData((prev) => {
      const items = (prev.items || []).map((it, idx) => {
        if (idx !== itemIndex) return it;
        const extra = Array.isArray(it.extraTables) ? [...it.extraTables] : [];
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
        const quarterLabel = quarters[extra.length % 4];
        extra.push({
          quarter: quarterLabel,
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
          areasOfExposure: [],
          exposureStartDate: '',
          learning: '',
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
    // Validate: Activity name is mandatory
    const missingActivityNames = [];
    (idpData.items || []).forEach((it, idx) => {
      const act = (it.developmentActivities || [])[0] || {};
      const actType = (act.type || '').toLowerCase();
      
      // For Education type, check main activity field
      if (actType === 'education') {
        if (!act.activity || !act.activity.trim()) {
          missingActivityNames.push({ itemIndex: idx, competencyName: it.competencyName || '#' + (it.competencyId || idx) });
        }
      } else if (['exposure', 'experience'].includes(actType)) {
        // For Exposure/Experience type, check extra tables development activity
        const extraTables = it.extraTables || [];
        if (extraTables.length === 0) {
          missingActivityNames.push({ itemIndex: idx, competencyName: it.competencyName || '#' + (it.competencyId || idx) });
        } else {
          extraTables.forEach((et) => {
            if (!et.developmentActivity || !et.developmentActivity.trim()) {
              missingActivityNames.push({ itemIndex: idx, competencyName: it.competencyName || '#' + (it.competencyId || idx) });
            }
          });
        }
      }
    });
    if (missingActivityNames.length) {
      setValidationError(`The "Activity" field (in the development plan table) is required for: ${missingActivityNames.map(m => m.competencyName).join(', ')}. Please fill in the Activity name before submitting.`);
      setShowValidationErrorModal(true);
      return;
    }

    // Validate: Area of exposure names are mandatory (for Exposure/Experience activities)
    const missingAreaNames = [];
    (idpData.items || []).forEach((it, idx) => {
      const act = (it.developmentActivities || [])[0] || {};
      const actType = (act.type || '').toLowerCase();
      if (['exposure', 'experience'].includes(actType)) {
        const extraTables = it.extraTables || [];
        extraTables.forEach((et, ti) => {
          const areas = et.areasOfExposure || [];
          areas.forEach((area, ai) => {
            if (!area.area || !area.area.trim()) {
              missingAreaNames.push({ itemIndex: idx, tableIndex: ti, areaIndex: ai, competencyName: it.competencyName || '#' + (it.competencyId || idx) });
            }
          });
        });
      }
    });
    if (missingAreaNames.length) {
      setValidationError(`Area of exposure names are required. Please fill in all area names before submitting.`);
      setShowValidationErrorModal(true);
      return;
    }

    // Validate: Start Date (exposure start date) is mandatory for Exposure/Experience activities
    const missingStartDates = [];
    (idpData.items || []).forEach((it, idx) => {
      const act = (it.developmentActivities || [])[0] || {};
      const actType = (act.type || '').toLowerCase();
      if (['exposure', 'experience'].includes(actType)) {
        const extraTables = it.extraTables || [];
        extraTables.forEach((et, ti) => {
          if (!et.exposureStartDate) {
            missingStartDates.push({ itemIndex: idx, tableIndex: ti, competencyName: it.competencyName || '#' + (it.competencyId || idx) });
          }
        });
      }
    });
    if (missingStartDates.length) {
      setValidationError(`Start Date is required for: ${missingStartDates.map(m => m.competencyName).join(', ')}`);
      setShowValidationErrorModal(true);
      return;
    }

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

    // Validate: any completed activity MUST have an uploaded PDF attachment
    const missing = [];
    (idpData.items || []).forEach((it, idx) => {
      // Check main activities
      (it.developmentActivities || []).forEach(act => {
        const isCompleted = isCompletedStatus(act.completionStatus);
        if (isCompleted && !act.pdfPath) {
          missing.push({ competencyName: it.competencyName || '#' + (it.competencyId || idx), itemIndex: idx });
        }
      });
      
      // Check extra table activities (for Exposure/Experience)
      (it.extraTables || []).forEach(extraTable => {
        (extraTable.activities || []).forEach(act => {
          const isCompleted = isCompletedStatus(act.completionStatus);
          if (isCompleted && !act.pdfPath) {
            missing.push({ competencyName: it.competencyName || '#' + (it.competencyId || idx), itemIndex: idx });
          }
        });
      });
    });
    if (missing.length) {
      setMissingAttachments(missing);
      setShowMissingModal(true);
      return;
    }

    // Validate: Education activities MUST have justification PDF (separate requirement)
    const missingEducationJustification = [];
    (idpData.items || []).forEach((it, idx) => {
      const act = (it.developmentActivities || [])[0] || {};
      if (act && act.type === 'Education' && !act.educationJustificationPdf) {
        missingEducationJustification.push({ itemIndex: idx, competencyName: it.competencyName || '#' + (it.competencyId || idx) });
      }
    });
    if (missingEducationJustification.length) {
      setValidationError('Education activities require both a completion proof PDF and a justification PDF. Please upload the missing justification PDFs before submitting.');
      setShowValidationErrorModal(true);
      return;
    }

    // All validations passed, show confirmation modal
    setShowSubmitConfirmation(true);
  };

  const confirmAndSubmitIDP = async () => {
    setShowSubmitConfirmation(false);
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
        // Transform areas of exposure data to use correct backend field names
        const transformAreasOfExposure = (areas) => areas.map(area => ({
          id: area.id,
          area: area.area,
          status: area.status,
          datetime: area.dateTime || area.datetime, // Use frontend dateTime, fallback to backend datetime
          durationHours: area.duration || area.durationHours, // Use frontend duration, fallback to backend durationHours  
          trainerName: area.trainerName,
          comments: area.comments
        }));

        const payload = {
          reviewPeriod: idpData.reviewPeriod,
          nextReviewDate: normalizeDate(idpData.nextReviewDate),
          items: (idpData.items || []).map((it) => ({
            id: it.id,
            competency_id: it.competency_id || it.competencyId || it.competency_id,
            development_activity: JSON.stringify(toBackendActivity((it.developmentActivities || [])[0] || {})),
            extraTables: (it.extraTables || []).map(et => ({
              id: et.id,
              quarter: et.quarter,
              targetCompletionDate: et.targetCompletionDate,
              actualCompletionDate: et.actualCompletionDate,
              developmentActivity: et.developmentActivity,
              completionStatus: et.completionStatus,
              score: et.score,
              expectedResults: et.expectedResults,
              sharingMethod: et.sharingMethod,
              applicationMethod: et.applicationMethod,
              pdfPath: et.pdfPath,
              educationJustificationPdf: et.educationJustificationPdf,
              exposureStartDate: et.exposureStartDate,
              learning: et.learning,
              areasOfExposure: transformAreasOfExposure(et.areasOfExposure || [])
            }))
          })),
        };

        await apiRequest(`/api/idp/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        });

        // Determine where to send the resubmission based on current status
        let submitEndpoint = `/api/idp/${id}/submit`;
        const currentStatus = idpHeader?.status;
        
        // Debug: log what fields are available
        console.log('DEBUG idpHeader fields:', Object.keys(idpHeader || {}));
        console.log('DEBUG idpHeader status:', currentStatus);
        console.log('DEBUG full idpHeader:', idpHeader);
        console.log('DEBUG idpHeader values:', JSON.stringify(idpHeader, null, 2));
        
        // Since we can't reliably detect who returned it from the header,
        // but we know from the manager_id field that it went through manager approval,
        // if it's returned and has a manager_id, it likely came from HR
        if (currentStatus === 'RETURNED' && idpHeader?.manager_id) {
          // Try to submit directly to HR since it already went through manager approval
          submitEndpoint = `/api/idp/${id}/hr/resubmit`;
          console.log('DEBUG: Detected manager_id, attempting HR resubmit');
        } else if (currentStatus === 'RETURNED') {
          // No manager_id, probably returned by manager
          submitEndpoint = `/api/idp/${id}/manager/resubmit`;
          console.log('DEBUG: No manager_id, attempting manager resubmit');
        }
        
        console.log('DEBUG submitEndpoint:', submitEndpoint);
        
        try {
          await apiRequest(submitEndpoint, { method: 'PUT' });
        } catch (error) {
          // If specific endpoint doesn't exist, fall back to regular submit
          if (error.status === 404) {
            await apiRequest(`/api/idp/${id}/submit`, { method: 'PUT' });
          } else {
            throw error;
          }
        }

        alert('IDP resubmitted successfully!');
        navigate('/supervisor');
        return;
      }

        // Create mode transform function (no id field needed)
        const transformAreasForCreate = (areas) => areas.map(area => ({
          area: area.area,
          status: area.status,
          datetime: area.dateTime || area.datetime, // Use frontend dateTime, fallback to backend datetime
          durationHours: area.duration || area.durationHours, // Use frontend duration, fallback to backend durationHours  
          trainerName: area.trainerName,
          comments: area.comments
        }));

      // Create mode
      const payload = {
        employeeId: parseInt(employeeId),
        supervisorId: employee?.supervisor_id,
        reviewPeriod: idpData.reviewPeriod,
        nextReviewDate: normalizeDate(idpData.nextReviewDate),
        items: enforcedItems.map((it) => ({
          ...it,
          developmentActivities: (it.developmentActivities || []).map((a) => toBackendActivity(a)),
          extraTables: (it.extraTables || []).map(et => ({
            quarter: et.quarter,
            targetCompletionDate: et.targetCompletionDate,
            actualCompletionDate: et.actualCompletionDate,
            developmentActivity: et.developmentActivity,
            completionStatus: et.completionStatus,
            score: et.score,
            expectedResults: et.expectedResults,
            sharingMethod: et.sharingMethod,
            applicationMethod: et.applicationMethod,
            pdfPath: et.pdfPath,
            educationJustificationPdf: et.educationJustificationPdf,
            exposureStartDate: et.exposureStartDate,
            learning: et.learning,
            areasOfExposure: transformAreasForCreate(et.areasOfExposure || [])
          }))
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

  const saveDraft = async () => {
    try {
      setSaving(true);

      const enforcedItems = enforceOneActivity(idpData.items || []);

      // Validation for create mode: must select at least 1 competency
      if (!editMode) {
        const count = enforcedItems.length;
        if (count < 1) {
          alert('Please select at least one competency to save draft.');
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
        // Editing an existing draft
        const payload = {
          reviewPeriod: idpData.reviewPeriod,
          nextReviewDate: normalizeDate(idpData.nextReviewDate),
          items: (idpData.items || []).map((it) => ({
            id: it.id,
            competency_id: it.competency_id || it.competencyId,
            development_activity: JSON.stringify(toBackendActivity((it.developmentActivities || [])[0] || {})),
            extraTables: (it.extraTables || []).map(et => ({
              id: et.id,
              quarter: et.quarter,
              targetCompletionDate: et.targetCompletionDate,
              actualCompletionDate: et.actualCompletionDate,
              developmentActivity: et.developmentActivity,
              completionStatus: et.completionStatus,
              score: et.score,
              expectedResults: et.expectedResults,
              sharingMethod: et.sharingMethod,
              applicationMethod: et.applicationMethod,
              pdfPath: et.pdfPath,
              educationJustificationPdf: et.educationJustificationPdf,
              exposureStartDate: et.exposureStartDate,
              learning: et.learning,
              areasOfExposure: (et.areasOfExposure || []).map(area => ({
                id: area.id,
                area: area.area,
                status: area.status,
                datetime: area.datetime,
                durationHours: area.durationHours,
                trainerName: area.trainerName,
                comments: area.comments
              }))
            }))
          })),
        };

        await apiRequest(`/api/idp/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
        });

        alert('IDP draft saved successfully!');
        navigate('/supervisor');
        return;
      }

      // Create mode - save as draft
      const payload = {
        employeeId: parseInt(employeeId),
        supervisorId: employee?.supervisor_id,
        reviewPeriod: idpData.reviewPeriod,
        nextReviewDate: normalizeDate(idpData.nextReviewDate),
        items: enforcedItems.map((it) => ({
          ...it,
          developmentActivities: (it.developmentActivities || []).map((a) => toBackendActivity(a)),
          extraTables: (it.extraTables || []).map(et => ({
            quarter: et.quarter,
            targetCompletionDate: et.targetCompletionDate,
            actualCompletionDate: et.actualCompletionDate,
            developmentActivity: et.developmentActivity,
            completionStatus: et.completionStatus,
            score: et.score,
            expectedResults: et.expectedResults,
            sharingMethod: et.sharingMethod,
            applicationMethod: et.applicationMethod,
            pdfPath: et.pdfPath,
            educationJustificationPdf: et.educationJustificationPdf,
            exposureStartDate: et.exposureStartDate,
            learning: et.learning,
            areasOfExposure: (et.areasOfExposure || []).map(area => ({
              area: area.area,
              status: area.status,
              datetime: area.datetime,
              durationHours: area.durationHours,
              trainerName: area.trainerName,
              comments: area.comments
            }))
          }))
        })),
      };

      const createRes = await apiRequest('/api/idp/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const idpId = createRes?.id;
      if (!idpId) throw new Error('Failed to save draft. No ID returned.');

      // Save as draft without submitting
      alert('IDP saved as draft successfully! You can continue editing later.');
      navigate('/supervisor');
    } catch (err) {
      console.error('Failed to save draft:', err);
      alert('Failed to save draft. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Manager/Employee/HR approval/return handlers
  const handleApproveIDP = async () => {
    try {
      setActionLoading(true);
      const role = getUserRole();
      let endpoint = '';
      
      if (role === 'Employee') {
        endpoint = 'employee/approve';
      } else if (role === 'HR') {
        // HR has two different approval endpoints based on completion status
        endpoint = allActivitiesCompleted ? 'hr/approve-cycle' : 'hr/approve-for-completion';
      } else if (role === 'AM') {
        // AM approval goes to Manager next
        endpoint = 'am/approve';
      } else if (role === 'Manager') {
        // For Manager: use cycle completion endpoint if all activities are completed
        endpoint = allActivitiesCompleted ? 'hr/approve-cycle' : 'manager/approve';
      } else {
        // For other roles (like Supervisor): use cycle completion endpoint if all activities are completed  
        endpoint = allActivitiesCompleted ? 'hr/approve-cycle' : 'manager/approve';
      }
      
      await apiRequest(`/api/idp/${id}/${endpoint}`, {
        method: 'PUT',
        body: JSON.stringify({ remarks }),
      });
      alert(`IDP ${allActivitiesCompleted ? 'cycle completed' : 'approved'} successfully`);
      navigate(getBackRoute());
    } catch (err) {
      console.error('Error approving IDP:', err);
      alert('Failed to approve IDP: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnIDP = async () => {
    if (!remarks.trim()) {
      alert('Please provide remarks before returning the IDP');
      return;
    }
    
    try {
      setActionLoading(true);
      const role = getUserRole();
      let endpoint = '';
      
      if (role === 'Employee') {
        endpoint = 'employee/return';
      } else if (role === 'HR') {
        endpoint = 'hr/return';
      } else if (role === 'AM') {
        endpoint = 'am/return';
      } else if (role === 'Manager') {
        endpoint = 'manager/return';
      } else {
        endpoint = 'manager/return'; // default
      }
      
      await apiRequest(`/api/idp/${id}/${endpoint}`, {
        method: 'PUT',
        body: JSON.stringify({ remarks }),
      });
      alert(`IDP returned to supervisor`);
      navigate(getBackRoute());
    } catch (err) {
      console.error('Error returning IDP:', err);
      alert('Failed to return IDP: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const creationDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Check if all activities are completed
  const allActivitiesCompleted = useMemo(() => {
    return (idpData.items || []).every(item => {
      const activity = (item.developmentActivities || [])[0];
      if (!activity) return false;
      
      const activityType = activity.type?.toLowerCase();
      
      // For Education activities, check the main activity completion status
      if (activityType === 'education') {
        const status = String(activity.completionStatus || '').trim().toLowerCase();
        return status === 'completed' || status.startsWith('completed');
      }
      
      // For Experience/Exposure activities, check if all extra table activities are completed
      if (activityType === 'experience' || activityType === 'exposure') {
        const extraTables = item.extraTables || [];
        if (extraTables.length === 0) return false;
        
        return extraTables.every(table => {
          // For Exposure, check if all areas of exposure are completed
          if (activityType === 'exposure') {
            const areas = table.areasOfExposure || [];
            if (areas.length === 0) return false;
            return areas.every(area => area.status === 'Completed');
          } else {
            // For Experience, check the table completion status
            const status = String(table.completionStatus || '').trim().toLowerCase();
            return status === 'completed' || status.startsWith('completed');
          }
        });
      }
      
      // For other activity types, check the main activity completion status
      const status = String(activity.completionStatus || '').trim().toLowerCase();
      return status === 'completed' || status.startsWith('completed');
    });
  }, [idpData.items]);

  // Check if any activity has been set up (at least has a type selected)
  const hasActivitiesSetup = useMemo(() => {
    return (idpData.items || []).some(item => {
      const activity = (item.developmentActivities || [])[0];
      return activity && activity.type && activity.type.trim();
    });
  }, [idpData.items]);

  const canResubmit = editMode && (idpHeader?.status === 'RETURNED' || idpHeader?.status === 'FOR_COMPLETION');
  const submitLabel = (() => {
    if (saving) return canResubmit ? 'Resubmitting...' : 'Submitting...';
    if (idpHeader?.status === 'FOR_COMPLETION' && allActivitiesCompleted && (userRole === 'Supervisor' || !userRole)) return 'Mark Cycle Completed';
    if (canResubmit) return 'Save & Resubmit';
    return 'Submit IDP';
  })();

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
                onClick={() => navigate(getBackRoute())}
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
                  {viewOnly ? `View IDP for ${employee?.name || ''}` : editMode ? `Edit IDP for ${employee?.name || ''}` : `Create IDP for ${employee?.name || ''}`}
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

              {!viewOnly && !editMode && (
                <button
                  onClick={saveDraft}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-400 text-white hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
              )}

              {!viewOnly && (hasActivitiesSetup || editMode) && (submitLabel === 'Mark Cycle Completed' || !editMode || idpHeader?.status === 'DRAFT' || idpHeader?.status === 'RETURNED') && <PrimaryActionButton onClick={submitIDP} disabled={saving} label={submitLabel} />}
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
                    <div key={guide.score} className={`p-4 bg-gray-50 rounded-lg ${viewOnly ? 'border-0' : 'border border-gray-100'}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`font-bold text-lg text-black bg-white rounded-md px-3 py-1 ${viewOnly ? 'border-0' : 'border border-gray-200'}`}>
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
          <ModalShell title="Missing PDF Attachments" onClose={() => setShowMissingModal(false)} maxWidth="max-w-lg">
            <p className="text-sm text-gray-600">
              One or more activities marked as Completed are missing PDF attachments. All completed activities must have proof of completion attached before submitting.
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

        {/* Validation error modal */}
        {showValidationErrorModal && (
          <ModalShell title="Validation Error" onClose={() => setShowValidationErrorModal(false)} maxWidth="max-w-lg">
            <p className="text-sm text-gray-700 mb-4">{validationError}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowValidationErrorModal(false)}
                className="px-4 py-2 rounded-md bg-black text-white hover:bg-black/90 font-semibold"
              >
                Close
              </button>
            </div>
          </ModalShell>
        )}

        {/* Submit confirmation modal */}
        {showSubmitConfirmation && (
          <ModalShell title="Confirm Submission" onClose={() => setShowSubmitConfirmation(false)} maxWidth="max-w-lg">
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to submit this IDP? Once submitted, it will be sent for review and you may not be able to make further changes without manager approval.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSubmitConfirmation(false)}
                className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndSubmitIDP}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-black text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {saving ? 'Submitting...' : 'Confirm & Submit'}
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
          <div className={`lg:col-span-2 bg-white rounded-xl shadow-sm ${viewOnly ? 'border-0' : 'border border-gray-100'} p-5`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-black">Employee Information</h2>
                <p className="text-sm text-gray-600 mt-1">Review details and complete the development activity fields below.</p>
              </div>
              <div className="text-sm text-gray-700 text-right">
                <div className="hidden sm:block">Date of IDP Creation</div>
                <div className="font-semibold text-gray-800">{creationDate}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="min-w-0">
                <label className={`block ${viewOnly ? 'text-sm font-bold' : 'text-sm font-bold'} text-gray-700 mb-2`}>Name</label>
                <TextBox value={employee.name} readOnly={viewOnly} />
              </div>

              <div className="min-w-0">
                <label className={`block ${viewOnly ? 'text-sm font-bold' : 'text-sm font-bold'} text-gray-700 mb-2`}>Position</label>
                <TextBox value={employee.position_title} readOnly={viewOnly} />
              </div>

              <div className="min-w-0">
                <label className={`block ${viewOnly ? 'text-sm font-bold' : 'text-sm font-bold'} text-gray-700 mb-2`}>Department</label>
                <TextBox value={employee.department_name} readOnly={viewOnly} />
              </div>

              <div className="min-w-0">
                <label className={`block ${viewOnly ? 'text-sm font-bold' : 'text-sm font-bold'} text-gray-700 mb-2`}>Supervisor/Manager</label>
                <TextBox value={supervisor?.name || 'N/A'} readOnly={viewOnly} />
              </div>

              <div className="min-w-0">
                <label className={`block ${viewOnly ? 'text-sm font-bold' : 'text-sm font-bold'} text-gray-700 mb-2`}>CL Score</label>
                <TextBox value={latestCLScore ? Number(latestCLScore).toFixed(2) : 'No approved CL'} readOnly={viewOnly} />
              </div>

              <div className="sm:col-span-1 lg:col-span-2">
                <Field label="Review Period" readOnly={viewOnly}>
                  <input
                    type="text"
                    value={idpData.reviewPeriod}
                    onChange={(e) => updateIdpData('reviewPeriod', e.target.value)}
                    disabled={viewOnly}
                    className={`w-full bg-gray-50 rounded-lg px-3 py-2 ${viewOnly ? 'text-base' : 'text-sm'} text-black outline-none focus:ring-2 focus:ring-black/10 ${viewOnly ? 'border-0' : 'border border-gray-100'} disabled:opacity-60 disabled:cursor-not-allowed`}
                  />
                </Field>
              </div>

              <Field label="Next Review Date" readOnly={viewOnly}>
                <input
                  type="date"
                  value={idpData.nextReviewDate}
                  onChange={(e) => updateIdpData('nextReviewDate', e.target.value)}
                  disabled={viewOnly}
                  className={`w-full bg-gray-50 rounded-lg px-3 py-2 ${viewOnly ? 'text-base' : 'text-sm'} text-black outline-none focus:ring-2 focus:ring-black/10 ${viewOnly ? 'border-0' : 'border border-gray-100'} disabled:opacity-60 disabled:cursor-not-allowed`}
                />
              </Field>

              <div className="sm:hidden lg:col-span-2">
                <label className={`block ${viewOnly ? 'text-sm font-bold' : 'text-sm font-bold'} text-gray-700 mb-2`}>Date of IDP Creation</label>
                <div className={`px-3 py-2 bg-gray-50 rounded-lg ${viewOnly ? 'text-base' : 'text-sm'} font-semibold text-black ${viewOnly ? 'border-0' : 'border border-gray-100'}`}>
                  {creationDate}
                </div>
              </div>
            </div>
          </div>

          {/* Manager Remarks Display OR Helpful Notes */}
          {idpHeader?.manager_remarks && !editMode && !['PENDING_MANAGER', 'PENDING_AM', 'PENDING_HR', 'PENDING_EMPLOYEE'].includes(idpHeader?.status) ? (
            <div className={`bg-blue-50 rounded-xl shadow-sm ${viewOnly ? 'border-0' : 'border border-blue-200'} p-5`}>
              <h3 className="text-lg font-semibold text-blue-900 mb-3">Manager Remarks & Feedback</h3>
              <div className={`bg-white rounded-lg p-4 ${viewOnly ? 'border-0' : 'border border-blue-100'} mb-4`}>
                <p className="text-gray-800 text-sm whitespace-pre-wrap">{idpHeader.manager_remarks}</p>
              </div>
              {idpHeader?.updated_at && (
                <div className="text-xs text-blue-600">
                  <span className="font-semibold">Added on:</span> {new Date(idpHeader.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          ) : (() => {
            const role = getUserRole();
            const status = idpHeader?.status;
            
            // Only show approval buttons if user role matches the pending status
            const shouldShowApproval = (
              (status === 'PENDING_MANAGER' && (role === 'Manager' || role === 'AM')) ||
              (status === 'PENDING_AM' && role === 'AM') ||
              (status === 'PENDING_HR' && role === 'HR') ||
              (status === 'PENDING_EMPLOYEE' && role === 'Employee') ||
              (status === 'FOR_COMPLETION' && role === 'HR')
            );
            
            return shouldShowApproval;
          })() ? (
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5`}>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                {(() => {
                  const role = getUserRole();
                  if (role === 'Employee') return 'Employee Acknowledgement';
                  if (role === 'HR') return 'HR Review & Approval';
                  if (role === 'Manager' || role === 'AM') return 'Manager Review & Approval';
                  return 'Remarks & Feedback';
                })()}
              </h3>
              <textarea
                className={`w-full ${viewOnly ? 'border-0' : 'border border-gray-300'} rounded-lg px-4 py-3 text-base text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black resize-none mb-4`}
                rows="4"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={(() => {
                  const role = getUserRole();
                  if (role === 'Employee') return 'Add your acknowledgement or comments...';
                  if (role === 'HR') return 'Enter your HR review comments and approval decision...';
                  if (role === 'Manager' || role === 'AM') return 'Enter your remarks for approval or return to supervisor...';
                  return 'Enter your remarks...';
                })()}
              />
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mb-4">
                <button
                  onClick={handleReturnIDP}
                  className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 whitespace-nowrap"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Return to Supervisor'}
                </button>
                
                <button
                  onClick={idpHeader?.status === 'FOR_COMPLETION' && getUserRole() === 'HR' ? handleApproveCycleCompletion : handleApproveIDP}
                  className={`px-6 py-2 rounded-lg font-semibold focus:outline-none focus:ring-2 disabled:opacity-50 whitespace-nowrap transition ${
                    (idpHeader?.status === 'FOR_COMPLETION' && getUserRole() === 'HR') 
                      ? (areAllActivitiesComplete 
                          ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500/50' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                      : 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500/50'
                  }`}
                  disabled={actionLoading || (idpHeader?.status === 'FOR_COMPLETION' && getUserRole() === 'HR' && !areAllActivitiesComplete)}
                >
                  {actionLoading ? 'Processing...' : (() => {
                    const role = getUserRole();
                    const status = idpHeader?.status;
                    if (status === 'FOR_COMPLETION' && role === 'HR') {
                      return areAllActivitiesComplete ? 'Approve Cycle Completion' : 'Cannot Approve - Incomplete Activities';
                    }
                    if (allActivitiesCompleted) {
                      return 'Cycle Completed';
                    }
                    if (role === 'HR') {
                      return 'For Completion';
                    }
                    if (role === 'Employee') return 'Acknowledge IDP';
                    return 'Approve IDP';
                  })()}
                </button>
              </div>
              
              <button
                onClick={() => setShowScoringGuide(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-black text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <InformationCircleIcon className="h-5 w-5" />
                View Scoring Guide
              </button>
            </div>
          ) : viewOnly && userRole !== 'Supervisor' && idpHeader?.status === 'FOR_COMPLETION' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                {(() => {
                  const role = getUserRole();
                  if (role === 'Employee') return 'IDP Updates in Progress';
                  if (role === 'HR') return 'IDP Completion Review';
                  if (role === 'Manager' || role === 'AM') return 'IDP Completion Review';
                  return 'IDP Review';
                })()}
              </h3>
              
              {getUserRole() === 'HR' ? (
                <div className="space-y-4">
                  <div className="mb-4">
                    <p className="text-gray-700 text-sm mb-4">
                      <strong>Status:</strong> Review the IDP activities completion before approving cycle completion.
                    </p>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        HR Remarks (Optional)
                      </label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-md text-base font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Add any remarks about the cycle completion..."
                      />
                    </div>
                    
                    <button
                      onClick={handleApproveCycleCompletion}
                      disabled={!areAllActivitiesComplete || actionLoading}
                      className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition ${
                        areAllActivitiesComplete 
                          ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {actionLoading ? 'Processing...' : 
                       areAllActivitiesComplete ? 'Approve Cycle Completion' : 
                       'Cannot Approve - Incomplete Activities'}
                    </button>
                    
                    {!areAllActivitiesComplete && (
                      <p className="text-red-600 text-xs mt-2">
                        All activities must be 100% complete before cycle completion can be approved.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800 text-sm">
                    <strong>Status:</strong> The supervisor is currently updating this IDP for completion. 
                    You can review the progress, but approval actions are not available at this time.
                  </p>
                </div>
              )}
              
              <button
                onClick={() => setShowScoringGuide(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-black text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <InformationCircleIcon className="h-5 w-5" />
                View Scoring Guide
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-black">Helpful Notes</h3>
              <div className="mt-3 space-y-3 text-sm text-gray-700">
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="text-sm font-bold text-gray-800">Activities</div>
                <div className="mt-1">One activity per competency is enforced.</div>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="text-sm font-bold text-gray-800">Tip</div>
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
          )}
        </div>

        {/* Competency selector */}
        {!editMode && !viewOnly && availableCompetencies?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-black">Select Competencies (min 1, max 2)</h3>
            <p className="text-sm text-gray-700 mt-2">
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
                      <div className={`text-sm font-medium ${isLevelTooHigh ? 'text-gray-500' : 'text-gray-700'}`}>
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
        <div className={`bg-white rounded-xl shadow-sm ${viewOnly ? 'border-0' : 'border border-gray-100'}`}>
          <div className={`px-5 py-4 ${viewOnly ? 'border-0' : 'border-b border-gray-100'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-black">Development Plan</h2>
                <p className="text-sm text-gray-600 mt-1">{viewOnly ? 'Review the submitted development activities.' : 'Update the fields inside each competency card.'}</p>
              </div>
              <div className="text-sm text-gray-700">
                {idpData.items.length} competency{(idpData.items.length === 1) ? '' : 'ies'}
              </div>
            </div>
          </div>

          <div className={`p-5 ${viewOnly && idpHeader?.status !== 'RETURNED' ? 'pointer-events-none opacity-75' : ''}`}>
            {idpData.items.length === 0 ? (
              <div className={`text-center py-10 bg-gray-50 rounded-xl ${viewOnly ? 'border-0' : 'border border-gray-100'}`}>
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
                  let completedActivities = 0;
                  
                  if (activityType === 'education') {
                    // For Education: only count the main activity
                    totalActivities = mainActivities.length;
                    completedActivities = mainActivities.filter(a => isCompletedStatus(a.completionStatus || a.status)).length;
                  } else if (activityType === 'experience' || activityType === 'exposure') {
                    // For Experience/Exposure: count extra table activities
                    // Each extra table's completion is based on its areas of exposure being 100% complete
                    totalActivities = extraTables.length;
                    completedActivities = extraTables.filter(t => {
                      const areas = t.areasOfExposure || [];
                      if (areas.length === 0) return false;
                      const completedAreas = areas.filter(a => a.status === 'Completed').length;
                      return completedAreas === areas.length;
                    }).length;
                  } else {
                    // For other types: count main activities
                    totalActivities = mainActivities.length;
                    completedActivities = mainActivities.filter(a => isCompletedStatus(a.completionStatus || a.status)).length;
                  }
                  
                  const overallCompletion = totalActivities === 0 ? 0 : Math.round((completedActivities / totalActivities) * 100);

                  return (
                    <div
                      id={`item-${itemIndex}`}
                      key={item.competencyId}
                      className={`rounded-xl ${viewOnly ? 'border-0' : 'border border-gray-100'} bg-gray-50 overflow-hidden`}
                    >
                      {/* Card header */}
                      <div className={`px-4 py-4 bg-white ${viewOnly ? 'border-0' : 'border-b border-gray-100'}`}>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-semibold text-black">{item.competencyName}</span>
                              <span
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border ${chip.bg} ${chip.text} ${chip.border}`}
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
                            <span className="text-sm font-bold text-gray-700 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
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
                                      overallCompletion === 100 ? '#10b981' :
                                      overallCompletion > 0 ? '#3b82f6' : '#9ca3af'
                                    }
                                    strokeWidth="3"
                                    strokeDasharray={`${totalActivities === 0 ? 0 : overallCompletion}, 100`}
                                    className="transition-all duration-300 ease-out"
                                  />
                                </svg>
                                {/* Center percentage text */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className={`text-xs font-bold ${
                                    totalActivities === 0 ? 'text-gray-400' :
                                    overallCompletion === 100 ? 'text-emerald-600' :
                                    overallCompletion > 0 ? 'text-blue-600' : 'text-gray-500'
                                  }`}>
                                    {totalActivities === 0 ? '0%' : `${overallCompletion}%`}
                                  </span>
                                </div>
                              </div>
                              <StatusBadge status={competencyStatus} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        {viewOnly && (
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                            📖 You are viewing this IDP in read-only mode. You cannot make changes.
                          </div>
                        )}
                        {!activity ? (
                          <div className="px-3 py-3 bg-white rounded-lg text-sm text-gray-600 border border-gray-100">
                            No activity initialized.
                          </div>
                        ) : viewOnly ? (
                          <div className="space-y-4 opacity-100">
                            {/* Display activity type in read-only format */}
                            <div className="bg-white rounded-lg p-5 border border-gray-100">
                              <p className="text-base text-gray-800"><strong className="text-gray-900">Type:</strong> {activity.type}</p>
                            </div>

                            {/* Show PDF if available */}
                            {activity.pdfPath && (
                              <div className="bg-white rounded-lg p-5 border border-gray-100">
                                <div className="text-sm font-bold text-gray-700 mb-3">Proof of Completion</div>
                                <a
                                  href={`${apiBase}/${activity.pdfPath}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 font-semibold"
                                >
                                  📄 View PDF
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            {isExpOrExposure && !viewOnly && idpHeader?.status !== 'FOR_COMPLETION' && (
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
                                  className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
                                >
                                  <option value="">-- Select activity type --</option>
                                  {DEVELOPMENT_TYPES.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                  ))}
                                </select>
                              </Field>
                            </div>

                            {!activity.type ? (
                              <div className="px-3 py-3 bg-white rounded-lg text-sm text-gray-600 border border-gray-100">
                                Select an activity type to view available fields.
                              </div>
                            ) : activity.type === 'Education' ? (
                              <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                  <div>
                                    <Field label="Development Activity">
                                      <input
                                        type="text"
                                        value={activity.activity}
                                        onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.activity`, e.target.value)}
                                        placeholder="Describe the development activity..."
                                        className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
                                      />
                                    </Field>
                                  </div>

                                  <Field label="Target Completion Date">
                                  <input
                                    type="date"
                                    value={activity.targetCompletionDate || ''}
                                    onChange={(e) =>
                                      updateIdpData(`items.${itemIndex}.developmentActivities.0.targetCompletionDate`, e.target.value)
                                    }
                                    className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
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
                                    className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
                                  />
                                </Field>

                                <Field label="Completion Status">
                                  <select
                                    value={activity.completionStatus}
                                    onChange={(e) =>
                                      updateIdpData(`items.${itemIndex}.developmentActivities.0.completionStatus`, e.target.value)
                                    }
                                    className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
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
                                    value={activity.score}
                                    onChange={(e) =>
                                      updateIdpData(`items.${itemIndex}.developmentActivities.0.score`, parseInt(e.target.value))
                                    }
                                    className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
                                  >
                                    {[1, 2, 3, 4, 5].map((score) => (
                                      <option key={score} value={score}>
                                        {score}
                                      </option>
                                    ))}
                                  </select>
                                </Field>

                                {((activity.pdfPath) || isCompletedStatus(activity.completionStatus)) && (
                                  <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">Proof of Completion</label>
                                    <div className="flex items-center gap-2 w-full">
                                      <select
                                        value={activity.pdfPath || ''}
                                        onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.pdfPath`, e.target.value)}
                                        className="flex-1 bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium border border-gray-300 truncate"
                                      >
                                        <option value="">-- No file --</option>
                                        {activity.pdfPath && (
                                          <option value={activity.pdfPath}>{activity.pdfPath.split('/').pop()}</option>
                                        )}
                                      </select>

                                      <label
                                        className={`inline-flex items-center px-3 py-2 bg-white border border-gray-200 rounded text-sm shrink-0 cursor-pointer`}
                                      >
                                        <input
                                          type="file"
                                          accept="application/pdf"
                                          style={{ display: 'none' }}
                                          onChange={async (e) => {
                                            console.log('Activity completion status:', activity.completionStatus);
                                            console.log('isCompletedStatus result:', isCompletedStatus(activity.completionStatus));
                                            // Temporarily allowing upload regardless of completion status
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
                                          className="text-sm text-blue-600 hover:underline truncate shrink-0"
                                        >
                                          View
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="lg:col-span-5 mt-6">
                                  <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-sm">
                                      <thead>
                                        <tr className="bg-gray-100 border border-gray-200">
                                          <th className="border border-gray-200 px-3 py-2 text-left font-bold text-gray-800 text-sm">Expected Results</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left font-bold text-gray-800 text-sm">Knowledge Sharing Method</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left font-bold text-gray-800 text-sm">Application Method</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr className="border border-gray-200">
                                          <td className="border border-gray-200 px-3 py-2">
                                            <textarea
                                              value={activity.expectedResults}
                                              onChange={(e) =>
                                                updateIdpData(`items.${itemIndex}.developmentActivities.0.expectedResults`, e.target.value)
                                              }
                                              placeholder="What new or enhanced skill or knowledge will you learn from this IDP?"
                                              rows={2}
                                              className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
                                            />
                                          </td>
                                          <td className="border border-gray-200 px-3 py-2">
                                            <textarea
                                              value={activity.sharingMethod}
                                              onChange={(e) =>
                                                updateIdpData(`items.${itemIndex}.developmentActivities.0.sharingMethod`, e.target.value)
                                              }
                                              placeholder="How will you share these enhanced skills or knowledge with your TLs, peers, or direct reports?"
                                              rows={2}
                                              className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
                                            />
                                          </td>
                                          <td className="border border-gray-200 px-3 py-2">
                                            <textarea
                                              value={activity.applicationMethod}
                                              onChange={(e) =>
                                                updateIdpData(`items.${itemIndex}.developmentActivities.0.applicationMethod`, e.target.value)
                                              }
                                              placeholder="How will you apply the skills or knowledge that you learned to improve your work performance?"
                                              rows={2}
                                              className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
                                            />
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                                </div>
                              </div>
                            ) : isExpOrExposure ? (
                              <div>
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="lg:col-span-3">
                                    <Field label="Development Activity">
                                      <input
                                        type="text"
                                        value={activity.activity}
                                        onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.activity`, e.target.value)}
                                        placeholder="Describe the development activity..."
                                        className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
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
                                        className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
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
                                        className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
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
                                        className="w-full bg-white rounded-lg px-4 py-3 text-base text-gray-800 font-medium outline-none focus:ring-2 focus:ring-black/10 border border-gray-300"
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
                          <div className="mt-6 w-full">
                            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  {item.extraTables.map((t, ti) => (
                                    <tr key={`${ti}-quarter-header`} className="bg-gray-700 text-white">
                                      <td colSpan="7" className="border border-gray-300 px-4 py-3">
                                        <span className="text-base font-bold">{t.quarter || `Q${ti + 1}`}</span>
                                      </td>
                                    </tr>
                                  ))[0] || null}
                                  <tr className="bg-gray-800 text-white">
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Activity</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Target Date</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Completion Date</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Status</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Score</th>
                                    <th className="border border-gray-300 px-4 py-2 text-center text-sm font-bold">Proof</th>
                                    <th className="border border-gray-300 px-4 py-2 text-center text-sm font-bold">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.extraTables.map((t, ti) => (
                                    <>
                                      {ti > 0 && (
                                        <tr key={`${ti}-row0`} className="bg-gray-700 text-white">
                                          <td colSpan="7" className="border border-gray-300 px-4 py-3">
                                            <span className="text-base font-bold">{t.quarter || `Q${ti + 1}`}</span>
                                          </td>
                                        </tr>
                                      )}
                                      <tr key={`${ti}-row1`} className="hover:bg-gray-100 transition-colors">
                                        <td className="border border-gray-300 px-4 py-2">
                                          <input
                                            type="text"
                                            value={t.developmentActivity || ''}
                                            onChange={(e) =>
                                              updateIdpData(`items.${itemIndex}.extraTables.${ti}.developmentActivity`, e.target.value)
                                            }
                                            placeholder="Activity..."
                                            className="w-full bg-white rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300"
                                          />
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2">
                                          <input
                                            type="date"
                                            value={t.targetCompletionDate || ''}
                                            onChange={(e) =>
                                              updateIdpData(`items.${itemIndex}.extraTables.${ti}.targetCompletionDate`, e.target.value)
                                            }
                                            className="w-full bg-white rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300"
                                          />
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2">
                                          <input
                                            type="date"
                                            value={t.actualCompletionDate || ''}
                                            onChange={(e) =>
                                              updateIdpData(`items.${itemIndex}.extraTables.${ti}.actualCompletionDate`, e.target.value)
                                            }
                                            className="w-full bg-white rounded px-2 py-1 text-xs text-black border border-gray-200"
                                          />
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2">
                                          {(() => {
                                            const areas = t.areasOfExposure || [];
                                            const totalAreas = areas.length;
                                            const completedAreas = areas.filter(a => a.status === 'Completed').length;
                                            const percentage = totalAreas > 0 ? Math.round((completedAreas / totalAreas) * 100) : 0;
                                            
                                            return (
                                              <div className="flex flex-col gap-1">
                                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                                  <div 
                                                    className="bg-blue-500 h-full transition-all duration-300" 
                                                    style={{ width: `${percentage}%` }}
                                                  />
                                                </div>
                                                <div className="text-sm font-bold text-gray-800 text-center">
                                                  {percentage}% ({completedAreas}/{totalAreas})
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2">
                                          <select
                                            value={t.score || 1}
                                            onChange={(e) => updateIdpData(`items.${itemIndex}.extraTables.${ti}.score`, parseInt(e.target.value))}
                                            className="w-full bg-white rounded px-2 py-1 text-xs text-black border border-gray-200"
                                          >
                                            {[1, 2, 3, 4, 5].map((s) => (
                                              <option key={s} value={s}>
                                                {s}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2 text-center">
                                          {(() => {
                                            const areas = t.areasOfExposure || [];
                                            const totalAreas = areas.length;
                                            const completedAreas = areas.filter(a => a.status === 'Completed').length;
                                            const allCompleted = totalAreas > 0 && completedAreas === totalAreas;
                                            return (t.pdfPath || isCompletedStatus(t.completionStatus) || allCompleted);
                                          })() && (
                                            <div className="flex items-center justify-center gap-2 pointer-events-auto">
                                              <label className={`inline-flex items-center px-2 py-1 bg-white border border-gray-200 rounded text-xs cursor-pointer`}>
                                                <input
                                                  type="file"
                                                  accept="application/pdf"
                                                  style={{ display: 'none' }}
                                                  onChange={async (e) => {
                                                    // Temporarily allowing all uploads
                                                    console.log('Extra table upload clicked for:', t);
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
                                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold pointer-events-auto"
                                                  style={{ pointerEvents: 'auto' }}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  View
                                                </a>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="border border-gray-300 px-4 py-2 text-center">
                                          {!viewOnly && idpHeader?.status !== 'FOR_COMPLETION' && (
                                            <button
                                              type="button"
                                              onClick={() => removeExtraTable(itemIndex, ti)}
                                              className="text-xs text-red-600 hover:text-red-800 font-semibold"
                                            >
                                              Remove
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                      <tr key={`${ti}-duration`} className="hover:bg-gray-50 transition-colors bg-gray-50">
                                        <td colSpan="7" className="border border-gray-300 px-4 py-2">
                                          <div className="text-sm font-bold text-gray-800 mb-3">Duration of Exposure</div>
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                              <label className="block text-sm font-bold text-gray-800 mb-2">From: [Start Date]</label>
                                              <input
                                                type="date"
                                                value={t.exposureStartDate || ''}
                                                onChange={(e) =>
                                                  updateIdpData(`items.${itemIndex}.extraTables.${ti}.exposureStartDate`, e.target.value)
                                                }
                                                className="w-full bg-white rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-sm font-bold text-gray-800 mb-2">To: [End Date]</label>
                                              {(() => {
                                                const areas = t.areasOfExposure || [];
                                                const completedAreas = areas.filter(a => a.status === 'Completed' && a.dateTime);
                                                let latestDate = '';
                                                
                                                if (completedAreas.length > 0) {
                                                  const dates = completedAreas.map(a => {
                                                    const dateTime = a.dateTime ? new Date(a.dateTime) : null;
                                                    return dateTime;
                                                  }).filter(d => d);
                                                  
                                                  if (dates.length > 0) {
                                                    const maxDate = new Date(Math.max(...dates));
                                                    latestDate = maxDate.toISOString().split('T')[0];
                                                  }
                                                }
                                                
                                                return (
                                                  <div className="w-full bg-gray-100 rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300">
                                                    {latestDate ? latestDate : 'Auto-generated when areas are completed'}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                            <div>
                                              <label className="block text-sm font-bold text-gray-800 mb-2">Total Hours of Exposure</label>
                                              {(() => {
                                                const startDate = t.exposureStartDate ? new Date(t.exposureStartDate) : null;
                                                
                                                // Calculate end date from completed areas
                                                const areas = t.areasOfExposure || [];
                                                const completedAreas = areas.filter(a => a.status === 'Completed' && a.dateTime);
                                                let endDate = null;
                                                
                                                if (completedAreas.length > 0) {
                                                  const dates = completedAreas.map(a => {
                                                    const dateTime = a.dateTime ? new Date(a.dateTime) : null;
                                                    return dateTime;
                                                  }).filter(d => d);
                                                  
                                                  if (dates.length > 0) {
                                                    endDate = new Date(Math.max(...dates));
                                                  }
                                                }
                                                
                                                let totalHours = '';
                                                
                                                if (startDate && endDate) {
                                                  const diffInMs = endDate - startDate;
                                                  const diffInHours = Math.round(diffInMs / (1000 * 60 * 60));
                                                  totalHours = diffInHours >= 0 ? diffInHours : 0;
                                                }
                                                
                                                return (
                                                  <div className="w-full bg-gray-100 rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300">
                                                    {totalHours ? `${totalHours} hours` : 'Select dates to calculate'}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                      <tr key={`${ti}-row2`} className="hover:bg-blue-50 transition-colors">
                                        <td colSpan="7" className="border border-gray-300 px-4 py-2">
                                          <div className="flex items-center justify-between mb-3">
                                            <label className="block text-sm font-bold text-gray-800 mb-2">Areas of Exposure</label>
                                            {!viewOnly && idpHeader?.status !== 'FOR_COMPLETION' && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!t.areasOfExposure) t.areasOfExposure = [];
                                                  t.areasOfExposure.push({
                                                    area: '',
                                                    status: '',
                                                    dateTime: '',
                                                    duration: '',
                                                    trainerName: '',
                                                    comments: '',
                                                  });
                                                  updateIdpData(`items.${itemIndex}.extraTables.${ti}.areasOfExposure`, [...(t.areasOfExposure || [])]);
                                                }}
                                                className="text-xs bg-black text-white px-2 py-1 rounded hover:bg-black/90"
                                              >
                                                + Add Area
                                              </button>
                                            )}
                                          </div>
                                          {Array.isArray(t.areasOfExposure) && t.areasOfExposure.length > 0 && (
                                            <div className="overflow-x-auto">
                                              <table className="w-full border-collapse text-sm">
                                                <thead>
                                                  <tr className="bg-gray-200">
                                                    <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800">Area</th>
                                                    <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800">Status</th>
                                                    <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800">Date & Time</th>
                                                    <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800">Duration</th>
                                                    <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800">Trainer Name</th>
                                                    <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800">Comments</th>
                                                    <th className="border border-gray-300 px-2 py-1 text-center font-semibold">Action</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {t.areasOfExposure.map((area, ai) => (
                                                    <tr key={`${itemIndex}-${ti}-${ai}-${area.dateTime || 'new'}`} className="hover:bg-gray-100">
                                                      <td className="border border-gray-300 px-2 py-1">
                                                        <input
                                                          type="text"
                                                          value={area.area || ''}
                                                          onChange={(e) => {
                                                            if (viewOnly) return;
                                                            const newValue = e.target.value;
                                                            
                                                            setIdpData((prev) => {
                                                              const newData = { ...prev };
                                                              const newItems = [...(newData.items || [])];
                                                              const newExtraTables = [...(newItems[itemIndex]?.extraTables || [])];
                                                              const newAreas = [...(newExtraTables[ti]?.areasOfExposure || [])];
                                                              
                                                              newAreas[ai] = { ...newAreas[ai], area: newValue };
                                                              newExtraTables[ti] = { ...newExtraTables[ti], areasOfExposure: newAreas };
                                                              newItems[itemIndex] = { ...newItems[itemIndex], extraTables: newExtraTables };
                                                              newData.items = newItems;
                                                              return newData;
                                                            });
                                                          }}
                                                          disabled={viewOnly}
                                                          placeholder="Area..."
                                                          className="w-full bg-white rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300"
                                                        />
                                                      </td>
                                                      <td className="border border-gray-300 px-2 py-1">
                                                        <select
                                                          value={area.status || ''}
                                                          onChange={(e) => {
                                                            if (viewOnly) return;
                                                            const newValue = e.target.value;
                                                            
                                                            setIdpData((prev) => {
                                                              const newData = { ...prev };
                                                              const newItems = [...(newData.items || [])];
                                                              const newExtraTables = [...(newItems[itemIndex]?.extraTables || [])];
                                                              const newAreas = [...(newExtraTables[ti]?.areasOfExposure || [])];
                                                              
                                                              newAreas[ai] = { ...newAreas[ai], status: newValue };
                                                              newExtraTables[ti] = { ...newExtraTables[ti], areasOfExposure: newAreas };
                                                              newItems[itemIndex] = { ...newItems[itemIndex], extraTables: newExtraTables };
                                                              newData.items = newItems;
                                                              return newData;
                                                            });
                                                          }}
                                                          disabled={viewOnly}
                                                          className="w-full bg-white rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300"
                                                        >
                                                          <option value="">-- Select Status --</option>
                                                          <option value="Not Started">Not Started</option>
                                                          <option value="On Going">On Going</option>
                                                          <option value="Completed">Completed</option>
                                                        </select>
                                                      </td>
                                                      <td className="border border-gray-300 px-2 py-1">
                                                        <input
                                                          key={`datetime-${itemIndex}-${ti}-${ai}-${area.dateTime || 'empty'}`}
                                                          type="datetime-local"
                                                          value={area.dateTime || ''}
                                                          onChange={(e) => {
                                                            if (viewOnly) return;
                                                            const newValue = e.target.value;
                                                            
                                                            // Force immediate update
                                                            setIdpData((prevData) => {
                                                              const newData = JSON.parse(JSON.stringify(prevData)); // Deep clone
                                                              
                                                              if (!newData.items) newData.items = [];
                                                              if (!newData.items[itemIndex]) newData.items[itemIndex] = { extraTables: [] };
                                                              if (!newData.items[itemIndex].extraTables) newData.items[itemIndex].extraTables = [];
                                                              if (!newData.items[itemIndex].extraTables[ti]) newData.items[itemIndex].extraTables[ti] = { areasOfExposure: [] };
                                                              if (!newData.items[itemIndex].extraTables[ti].areasOfExposure) newData.items[itemIndex].extraTables[ti].areasOfExposure = [];
                                                              
                                                              newData.items[itemIndex].extraTables[ti].areasOfExposure[ai] = {
                                                                ...newData.items[itemIndex].extraTables[ti].areasOfExposure[ai],
                                                                dateTime: newValue
                                                              };
                                                              
                                                              return newData;
                                                            });
                                                          }}
                                                          disabled={viewOnly}
                                                          className="w-full bg-white rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300"
                                                          placeholder="Select date and time"
                                                        />
                                                      </td>
                                                      <td className="border border-gray-300 px-2 py-1">
                                                        <input
                                                          type="text"
                                                          value={area.duration || ''}
                                                          onChange={(e) => {
                                                            if (viewOnly) return;
                                                            const newValue = e.target.value;
                                                            
                                                            setIdpData((prev) => {
                                                              const newData = { ...prev };
                                                              const newItems = [...(newData.items || [])];
                                                              const newExtraTables = [...(newItems[itemIndex]?.extraTables || [])];
                                                              const newAreas = [...(newExtraTables[ti]?.areasOfExposure || [])];
                                                              
                                                              newAreas[ai] = { ...newAreas[ai], duration: newValue };
                                                              newExtraTables[ti] = { ...newExtraTables[ti], areasOfExposure: newAreas };
                                                              newItems[itemIndex] = { ...newItems[itemIndex], extraTables: newExtraTables };
                                                              newData.items = newItems;
                                                              return newData;
                                                            });
                                                          }}
                                                          disabled={viewOnly}
                                                          placeholder="Duration..."
                                                          className="w-full bg-white rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300"
                                                        />
                                                      </td>
                                                      <td className="border border-gray-300 px-2 py-1">
                                                        <input
                                                          type="text"
                                                          value={area.trainerName || ''}
                                                          onChange={(e) => {
                                                            if (viewOnly) return;
                                                            const newValue = e.target.value;
                                                            
                                                            setIdpData((prev) => {
                                                              const newData = { ...prev };
                                                              const newItems = [...(newData.items || [])];
                                                              const newExtraTables = [...(newItems[itemIndex]?.extraTables || [])];
                                                              const newAreas = [...(newExtraTables[ti]?.areasOfExposure || [])];
                                                              
                                                              newAreas[ai] = { ...newAreas[ai], trainerName: newValue };
                                                              newExtraTables[ti] = { ...newExtraTables[ti], areasOfExposure: newAreas };
                                                              newItems[itemIndex] = { ...newItems[itemIndex], extraTables: newExtraTables };
                                                              newData.items = newItems;
                                                              return newData;
                                                            });
                                                          }}
                                                          disabled={viewOnly}
                                                          placeholder="Trainer name..."
                                                          className="w-full bg-white rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300"
                                                        />
                                                      </td>
                                                      <td className="border border-gray-300 px-2 py-1">
                                                        <textarea
                                                          value={area.comments || ''}
                                                          onChange={(e) => {
                                                            if (viewOnly) return;
                                                            const newValue = e.target.value;
                                                            
                                                            setIdpData((prev) => {
                                                              const newData = { ...prev };
                                                              const newItems = [...(newData.items || [])];
                                                              const newExtraTables = [...(newItems[itemIndex]?.extraTables || [])];
                                                              const newAreas = [...(newExtraTables[ti]?.areasOfExposure || [])];
                                                              
                                                              newAreas[ai] = { ...newAreas[ai], comments: newValue };
                                                              newExtraTables[ti] = { ...newExtraTables[ti], areasOfExposure: newAreas };
                                                              newItems[itemIndex] = { ...newItems[itemIndex], extraTables: newExtraTables };
                                                              newData.items = newItems;
                                                              return newData;
                                                            });
                                                          }}
                                                          disabled={viewOnly}
                                                          placeholder="Comments..."
                                                          rows={1}
                                                          className="w-full bg-white rounded px-3 py-2 text-sm text-gray-800 font-medium border border-gray-300"
                                                        />
                                                      </td>
                                                      <td className="border border-gray-300 px-2 py-1 text-center">
                                                        {!viewOnly && idpHeader?.status !== 'FOR_COMPLETION' && (
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const newAreas = [...t.areasOfExposure];
                                                              newAreas.splice(ai, 1);
                                                              updateIdpData(`items.${itemIndex}.extraTables.${ti}.areasOfExposure`, newAreas);
                                                            }}
                                                            className="text-xs text-red-600 hover:text-red-800 font-semibold"
                                                          >
                                                            Remove
                                                          </button>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                          <div className="mt-4">
                                            <label className="block text-sm font-bold text-gray-800 mb-3">Learning</label>
                                            <textarea
                                              value={t.learning || ''}
                                              onChange={(e) =>
                                                updateIdpData(`items.${itemIndex}.extraTables.${ti}.learning`, e.target.value)
                                              }
                                              placeholder="What did you learn from this activity?"
                                              rows={2}
                                              className="w-full bg-white rounded px-2 py-1 text-xs text-black border border-gray-200"
                                            />
                                          </div>
                                        </td>
                                      </tr>
                                    </>
                                  ))}
                                </tbody>
                              </table>
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


      </div>
    </div>
  );
}

export default CreateIDPPage;
