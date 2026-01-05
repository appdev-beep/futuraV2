// src/pages/Supervisor/CreateIDPPage.jsx
import { useEffect, useMemo, useState } from 'react';
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

function CreateIDPPage() {
  const { employeeId, id } = useParams(); // id is for edit mode
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [supervisor, setSupervisor] = useState(null);
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [idpHeader, setIdpHeader] = useState(null); // for edit mode

  const [idpData, setIdpData] = useState({
    reviewPeriod: '1st Cycle Performance Review',
    nextReviewDate: new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0],
    items: []
  });

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
          setEmployee(idpRes.header.employee || {});
          setSupervisor(idpRes.header.supervisor || {});
          setIdpData({
            reviewPeriod: idpRes.header.review_period,
            nextReviewDate: idpRes.header.next_review_date,
            items: (idpRes.items || []).map(item => ({
              competencyId: item.competency_id,
              competencyName: item.competency_name,
              developmentArea: item.competency_area || 'Technical',
              currentLevel: item.current_level,
              targetLevel: item.target_level,
              developmentActivities: [typeof item.development_activity === 'string' ? JSON.parse(item.development_activity) : item.development_activity]
            }))
          });
        } else if (employeeId) {
          // Create mode: load employee and competencies
          const employeeData = await apiRequest(`/api/users/${employeeId}`);
          if (employeeData.supervisor_id) {
            const supervisorData = await apiRequest(`/api/users/${employeeData.supervisor_id}`);
            setSupervisor(supervisorData);
          }
          // Try to use latest CL (created by supervisor) to get assigned levels
          const clHistory = await apiRequest(`/api/cl/employee/${employeeId}/history`);
          let items = [];
          if (Array.isArray(clHistory) && clHistory.length > 0) {
            const latestClId = clHistory[0].id;
            try {
              const clFull = await apiRequest(`/api/cl/${latestClId}`);
              const clItems = clFull.items || [];
              items = clItems.map(ci => ({
                competencyId: ci.competency_id,
                competencyName: ci.competency_name,
                developmentArea: ci.competency_area || 'Technical',
                currentLevel: Number(ci.assigned_level || ci.self_rating || 1),
                targetLevel: Math.min(Number(ci.assigned_level || ci.self_rating || 1) + 1, 5),
                developmentActivities: [{
                  type: 'Education', activity: '', targetCompletionDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0], actualCompletionDate: '', completionStatus: 'Not Started/In Progress (<50%)', expectedResults: '', sharingMethod: '', applicationMethod: '', score: 1
                }]
              }));
            } catch (err) {
              console.warn('Failed to load latest CL full details, falling back to position competencies', err);
            }
          }

          // Fallback: use position competencies (mplr) if no CL found or failed
          if (!items.length) {
            const competenciesData = await apiRequest(`/api/cl/employee/${employeeId}/competencies`);
            const deptNameFromCompetencies = competenciesData?.employee?.department_name;
            const mergedEmployee = {
              ...employeeData,
              department_name: employeeData.department_name || deptNameFromCompetencies || '',
            };
            setEmployee(mergedEmployee);
            items = (competenciesData?.competencies || []).map(comp => {
              const assignedNum = 1; // default when no assigned level
              return {
                competencyId: comp.competency_id,
                competencyName: comp.name,
                developmentArea: comp.competency_area || 'Technical',
                currentLevel: assignedNum,
                targetLevel: Math.min(assignedNum + 1, 5),
                developmentActivities: [{
                  type: 'Education', activity: '', targetCompletionDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0], actualCompletionDate: '', completionStatus: 'Not Started/In Progress (<50%)', expectedResults: '', sharingMethod: '', applicationMethod: '', score: 1
                }]
              };
            });
            console.log('CreateIDP: competenciesData (fallback)', competenciesData, 'itemsSummary', items.map(i => ({ competencyId: i.competencyId, currentLevel: i.currentLevel, targetLevel: i.targetLevel })));
            setIdpData(prev => ({ ...prev, items }));
            return;
          }

          // If items came from CL, set employee then idp data
          const deptNameFromCl = employeeData.department_name || '';
          const mergedEmployee = { ...employeeData, department_name: deptNameFromCl };
          setEmployee(mergedEmployee);
          console.log('CreateIDP: used latest CL items', items.map(i => ({ competencyId: i.competencyId, currentLevel: i.currentLevel })));
          setIdpData(prev => ({ ...prev, items }));
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
  }, [id, employeeId]);

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

  // For create: submit new, for edit: update and resubmit
  const submitIDP = async () => {
    try {
      setSaving(true);
      const enforcedItems = (idpData.items || []).map(item => ({
        ...item,
        developmentActivities: Array.isArray(item.developmentActivities)
          ? item.developmentActivities.slice(0, 1)
          : []
      }));
      if (editMode && id) {
        // Edit mode: update and resubmit
        const payload = {
          reviewPeriod: idpData.reviewPeriod,
          nextReviewDate: idpData.nextReviewDate,
          items: enforcedItems
        };
        // 1. Update the IDP
        await apiRequest(`/api/idp/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
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
          nextReviewDate: idpData.nextReviewDate,
          items: enforcedItems
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

              {editMode && idpHeader?.status === 'RETURNED' ? (
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
                                  value={activity.targetCompletionDate}
                                  readOnly
                                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm text-black opacity-90 border border-gray-100"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Completion Date</label>
                                <input
                                  type="date"
                                  value={activity.actualCompletionDate}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.actualCompletionDate`, e.target.value)}
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

                              <div>
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
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Score</label>
                                <select
                                  value={activity.score}
                                  onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.0.score`, parseInt(e.target.value))}
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

                {editMode && idpHeader?.status === 'RETURNED' ? (
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
