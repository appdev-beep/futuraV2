// src/pages/Supervisor/CreateIDPPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

import {
  COMPLETION_STATUS_OPTIONS,
  DEVELOPMENT_TYPES,
  CRAYON_COLORS,
  SCORING_GUIDE
} from './idpConstants';

function CreateIDPPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [supervisor, setSupervisor] = useState(null);
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  
  const [idpData, setIdpData] = useState({
    reviewPeriod: '1st Cycle Performance Review',
    nextReviewDate: new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0], // End of next year
    items: []
  });

  // Load employee data and competencies
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // Get employee details
        const employeeData = await apiRequest(`/api/users/${employeeId}`);

        // Get supervisor details
        if (employeeData.supervisor_id) {
          const supervisorData = await apiRequest(`/api/users/${employeeData.supervisor_id}`);
          setSupervisor(supervisorData);
        }

        // Get approved competencies for this employee (may include richer employee info)
        const competenciesData = await apiRequest(`/api/cl/employee/${employeeId}/competencies`);

        // If the employee record is missing the department name, try to fill it from the competencies endpoint
        const deptNameFromCompetencies = competenciesData?.employee?.department_name;
        const mergedEmployee = {
          ...employeeData,
          department_name: employeeData.department_name || deptNameFromCompetencies || '',
        };

        setEmployee(mergedEmployee);
        
        // Initialize IDP items from approved competencies
        const items = (competenciesData?.competencies || []).map(comp => ({
          competencyId: comp.competency_id,
          competencyName: comp.competency_name,
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
        
        setIdpData(prev => ({ ...prev, items }));
        
      } catch (err) {
        console.error('Failed to load IDP data:', err);
        alert('Failed to load employee data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (employeeId) {
      loadData();
    }
  }, [employeeId]);

  const addDevelopmentActivity = (itemIndex) => {
    setIdpData(prev => {
      const newItems = [...prev.items];
      newItems[itemIndex].developmentActivities.push({
        type: 'Education',
        activity: '',
        targetCompletionDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
        actualCompletionDate: '',
        completionStatus: 'Not Started/In Progress (<50%)',
        expectedResults: '',
        sharingMethod: '',
        applicationMethod: '',
        score: 1
      });
      return { ...prev, items: newItems };
    });
  };

  const removeDevelopmentActivity = (itemIndex, activityIndex) => {
    setIdpData(prev => {
      const newItems = [...prev.items];
      newItems[itemIndex].developmentActivities.splice(activityIndex, 1);
      return { ...prev, items: newItems };
    });
  };

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
      return newData;
    });
  };

  const saveIDP = async () => {
    try {
      setSaving(true);
      
      const payload = {
        employeeId: parseInt(employeeId),
        supervisorId: employee?.supervisor_id,
        reviewPeriod: idpData.reviewPeriod,
        nextReviewDate: idpData.nextReviewDate,
        items: idpData.items
      };

      await apiRequest('/api/idp/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      alert('IDP created successfully!');
      navigate('/supervisor');
      
    } catch (err) {
      console.error('Failed to save IDP:', err);
      alert('Failed to save IDP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading IDP data...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Employee not found</p>
          <button
            onClick={() => navigate('/supervisor')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <div className="shadow-sm border-b bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/supervisor')}
                className="mr-4 p-2 rounded-full bg-gray-200 hover:bg-gray-300"
              >
                <ArrowLeftIcon className="h-5 w-5 text-black" />
              </button>
              <h1 className="text-2xl font-bold text-white">
                Individual Development Plan (IDP)
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowScoringGuide(!showScoringGuide)}
                className="flex items-center gap-2 bg-gray-800 text-white font-bold px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                <InformationCircleIcon className="h-5 w-5" />
                Scoring Guide
              </button>
              <button
                onClick={saveIDP}
                disabled={saving}
                className="bg-black text-white px-6 py-2 rounded-full hover:bg-gray-800 disabled:opacity-50 font-bold transition-all"
              >
                {saving ? 'Saving...' : 'Save IDP'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scoring Guide Modal */}
        {showScoringGuide && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60">
            <div className="p-6 rounded-3xl max-w-4xl max-h-[80vh] overflow-y-auto shadow-2xl border-2 bg-white">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-black">Scoring Guide for IDP Completion and Competency Mastery</h2>
                <button
                  onClick={() => setShowScoringGuide(false)}
                  className="text-black text-3xl font-bold bg-gray-200 hover:bg-gray-300 rounded-full px-3 py-1"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                {SCORING_GUIDE.map((guide) => (
                  <div key={guide.score} className="p-4 rounded-2xl shadow border bg-gray-100">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="font-bold text-2xl text-black bg-gray-300 rounded-full px-4 py-2">
                        {guide.score}
                      </span>
                      <span className="font-semibold text-black text-lg">{guide.status}</span>
                    </div>
                    <p className="text-black font-medium">{guide.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Employee Information */}
        <div className="rounded-3xl shadow-2xl p-6 mb-8 border bg-white">
          <h2 className="text-xl font-semibold mb-4 text-black">Employee Information</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Name</label>
              <input
                type="text"
                value={employee.name}
                readOnly
                className="w-full border rounded-2xl px-3 py-2 font-bold text-black bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Position</label>
              <input
                type="text"
                value={employee.position_title}
                readOnly
                className="w-full border rounded-2xl px-3 py-2 font-bold text-black bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Department</label>
              <input
                type="text"
                value={employee.department_name}
                readOnly
                className="w-full border rounded-2xl px-3 py-2 font-bold text-black bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Supervisor/Manager</label>
              <input
                type="text"
                value={supervisor?.name || 'N/A'}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of IDP Creation</label>
              <input
                type="date"
                value={new Date().toISOString().split('T')[0]}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Review Period</label>
              <input
                type="text"
                value={idpData.reviewPeriod}
                onChange={(e) => updateIdpData('reviewPeriod', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Review Date</label>
              <input
                type="date"
                value={idpData.nextReviewDate}
                onChange={(e) => updateIdpData('nextReviewDate', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Development Plan Table */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 text-black">Development Plan</h2>
          
          {idpData.items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No approved competencies found for this employee.</p>
              <p className="text-sm text-gray-400 mt-2">Employee must have approved CL competencies before creating IDP.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {idpData.items.map((item, itemIndex) => (
                <div key={item.competencyId} className="border rounded-lg p-6 bg-white">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Development Area</label>
                      <input
                        type="text"
                        value={item.developmentArea}
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Competency</label>
                      <input
                        type="text"
                        value={item.competencyName}
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Level</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={item.currentLevel}
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Level</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={item.targetLevel}
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* Development Activities */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-black">Development Activities</h4>
                      <button
                        onClick={() => addDevelopmentActivity(itemIndex)}
                        className="flex items-center gap-2 text-black hover:text-gray-700"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Activity
                      </button>
                    </div>

                    {item.developmentActivities.map((activity, activityIndex) => (
                      <div key={activityIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-end mb-4">
                          {item.developmentActivities.length > 1 && (
                            <button
                              onClick={() => removeDevelopmentActivity(itemIndex, activityIndex)}
                              className="text-white bg-red-600 hover:bg-red-800 rounded px-2 py-1"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                              value={activity.type}
                              onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.type`, e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                              {DEVELOPMENT_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Development Activity</label>
                            <input
                              type="text"
                              value={activity.activity}
                              onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.activity`, e.target.value)}
                              placeholder="Describe the development activity..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Target Completion Date</label>
                            <input
                              type="date"
                              value={activity.targetCompletionDate}
                              readOnly
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Actual Completion Date</label>
                            <input
                              type="date"
                              value={activity.actualCompletionDate}
                              onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.actualCompletionDate`, e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Completion Status</label>
                            <select
                              value={activity.completionStatus}
                              onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.completionStatus`, e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                              {COMPLETION_STATUS_OPTIONS.map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Results</label>
                            <textarea
                              value={activity.expectedResults}
                              onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.expectedResults`, e.target.value)}
                              placeholder="What new or enhanced skill or knowledge will you learn from this IDP?"
                              rows={3}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Knowledge Sharing Method</label>
                            <textarea
                              value={activity.sharingMethod}
                              onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.sharingMethod`, e.target.value)}
                              placeholder="How will you share these enhanced skills or knowledge with your TLs, peers, or direct reports?"
                              rows={3}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Application Method</label>
                            <textarea
                              value={activity.applicationMethod}
                              onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.applicationMethod`, e.target.value)}
                              placeholder="How will you apply the skills or knowledge that you learned to improve your work performance?"
                              rows={3}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                            <select
                              value={activity.score}
                              onChange={(e) => updateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.score`, parseInt(e.target.value))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                              {[1,2,3,4,5].map(score => (
                                <option key={score} value={score}>{score}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateIDPPage;
