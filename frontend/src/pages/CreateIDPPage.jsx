// src/pages/CreateIDPPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

const COMPLETION_STATUS_OPTIONS = [
  'Not Started/In Progress (<50%)',
  'In Progress (50-79% Completed)', 
  'Completed & Met Expectations',
  'Completed & Above Target Expectation',
  'Completed & Exceeded Competency'
];

const DEVELOPMENT_TYPES = ['Education', 'Experience', 'Exposure'];

// 208 Crayon Colors Palette
const CRAYON_COLORS = [
  '#FF6B35', '#F7931E', '#FFD23F', '#FFF200', '#8BC34A', '#4CAF50', '#009688', '#00BCD4', 
  '#2196F3', '#3F51B5', '#9C27B0', '#E91E63', '#F44336', '#FF5722', '#795548', '#9E9E9E',
  '#607D8B', '#FFE0B2', '#FFCCBC', '#D7CCC8', '#F1F8E9', '#E8F5E8', '#E0F2F1', '#E0F7FA',
  '#E1F5FE', '#E3F2FD', '#E8EAF6', '#F3E5F5', '#FCE4EC', '#FFEBEE', '#FFF3E0', '#F9FBE7',
  '#FF80AB', '#FF4081', '#AD1457', '#880E4F', '#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA',
  '#9C27B0', '#AB47BC', '#BA68C8', '#CE93D8', '#DA80CB', '#F8BBD9', '#F48FB1', '#F06292',
  '#EC407A', '#E91E63', '#C2185B', '#AD1457', '#880E4F', '#FF1744', '#F44336', '#E53935',
  '#D32F2F', '#C62828', '#B71C1C', '#FF5722', '#F4511E', '#E64A19', '#D84315', '#BF360C',
  '#FF9800', '#F57C00', '#EF6C00', '#E65100', '#FF6F00', '#FF8F00', '#FFA000', '#FFB300',
  '#FFC107', '#FFD54F', '#FFEB3B', '#F9A825', '#F57F17', '#827717', '#9E9D24', '#AFB42B',
  '#CDDC39', '#D4E157', '#DCEDC8', '#C5E1A5', '#AED581', '#9CCC65', '#8BC34A', '#7CB342',
  '#689F38', '#558B2F', '#33691E', '#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#4CAF50',
  '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9', '#E8F5E8', '#00C853', '#00E676', '#69F0AE',
  '#B9F6CA', '#00695C', '#00796B', '#00897B', '#009688', '#26A69A', '#4DB6AC', '#80CBC4',
  '#B2DFDB', '#E0F2F1', '#A7FFEB', '#64FFDA', '#1DE9B6', '#00BFA5', '#006064', '#00838F',
  '#0097A7', '#00ACC1', '#00BCD4', '#26C6DA', '#4DD0E1', '#80DEEA', '#B2EBF2', '#E0F7FA',
  '#84FFFF', '#18FFFF', '#00E5FF', '#00B8D4', '#01579B', '#0277BD', '#0288D1', '#039BE5',
  '#03A9F4', '#29B6F6', '#4FC3F7', '#81D4FA', '#B3E5FC', '#E1F5FE', '#80D8FF', '#40C4FF',
  '#00B0FF', '#0091EA', '#1A237E', '#283593', '#303F9F', '#3949AB', '#3F51B5', '#5C6BC0',
  '#7986CB', '#9FA8DA', '#C5CAE9', '#E8EAF6', '#8C9EFF', '#536DFE', '#3D5AFE', '#304FFE',
  '#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA', '#9C27B0', '#AB47BC', '#BA68C8', '#CE93D8',
  '#E1BEE7', '#F3E5F5', '#EA80FC', '#E040FB', '#D500F9', '#AA00FF', '#3E2723', '#5D4037',
  '#6D4C41', '#795548', '#8D6E63', '#A1887F', '#BCAAA4', '#D7CCC8', '#EFEBE9', '#8D6E63',
  '#A1887F', '#BCAAA4', '#263238', '#37474F', '#455A64', '#546E7A', '#607D8B', '#78909C',
  '#90A4AE', '#B0BEC5', '#CFD8DC', '#ECEFF1', '#90A4AE', '#B0BEC5', '#CFD8DC', '#000000',
  '#212121', '#424242', '#616161', '#757575', '#9E9E9E', '#BDBDBD', '#E0E0E0', '#EEEEEE',
  '#F5F5F5', '#FAFAFA', '#FFFFFF'
];

const SCORING_GUIDE = [
  { score: 5, description: 'Exceptional & Completed: Exceeded expectations, demonstrated mastery beyond the target level. Project/activity is completed, and impact is notable.', status: 'Completed & Exceeded Competency' },
  { score: 4, description: 'Advanced & Completed: Fully met expectations with proficiency at or slightly above the target level. The project/activity is fully completed.', status: 'Completed & Above Target Expectation' },
  { score: 3, description: 'Proficient & Completed: Met most expectations, demonstrated proficiency at the target level. The project/activity is fully completed.', status: 'Completed & Met Expectations' },
  { score: 2, description: 'Developing & Incomplete: Some progress made, but competency is below the target level. The project/activity is incomplete or partially completed.', status: 'In Progress (50-79% Completed)' },
  { score: 1, description: 'Basic & Not Started: Little to no progress in competency development. The project/activity is not started or significantly behind schedule.', status: 'Not Started/In Progress (<50%)' }
];

function CreateIDPPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [supervisor, setSupervisor] = useState(null);
  const [competencies, setCompetencies] = useState([]);
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
        setEmployee(employeeData);
        
        // Get supervisor details
        if (employeeData.supervisor_id) {
          const supervisorData = await apiRequest(`/api/users/${employeeData.supervisor_id}`);
          setSupervisor(supervisorData);
        }
        
        // Get approved competencies for this employee
        const competenciesData = await apiRequest(`/api/cl/employee/${employeeId}/competencies`);
        setCompetencies(competenciesData?.competencies || []);
        
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
    <div className="min-h-screen" style={{background: `linear-gradient(45deg, ${CRAYON_COLORS.slice(0,8).join(', ')})`}}>
      {/* Header */}
      <div className="shadow-sm border-b" style={{background: `linear-gradient(90deg, ${CRAYON_COLORS.slice(8,16).join(', ')})`}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/supervisor')}
                className="mr-4 p-2 hover:bg-white hover:bg-opacity-30 rounded-full"
                style={{backgroundColor: CRAYON_COLORS[20]}}
              >
                <ArrowLeftIcon className="h-5 w-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                🎨 Individual Development Plan (IDP) 🎨
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowScoringGuide(!showScoringGuide)}
                className="flex items-center gap-2 text-white hover:text-opacity-80 font-bold drop-shadow"
                style={{backgroundColor: CRAYON_COLORS[30], padding: '8px 16px', borderRadius: '20px'}}
              >
                <InformationCircleIcon className="h-5 w-5" />
                🌈 Scoring Guide 🌈
              </button>
              <button
                onClick={saveIDP}
                disabled={saving}
                className="text-white px-6 py-2 rounded-full hover:opacity-80 disabled:opacity-50 font-bold drop-shadow-lg transform hover:scale-105 transition-all"
                style={{background: `linear-gradient(45deg, ${CRAYON_COLORS.slice(40,44).join(', ')})`}}
              >
                {saving ? '🎨 Saving...' : '✨ Save IDP ✨'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scoring Guide Modal */}
        {showScoringGuide && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{background: `radial-gradient(circle, ${CRAYON_COLORS.slice(60,68).join(', ')})`}}>
            <div className="p-6 rounded-3xl max-w-4xl max-h-[80vh] overflow-y-auto shadow-2xl border-8" style={{background: `linear-gradient(135deg, ${CRAYON_COLORS.slice(100,108).join(', ')})`}}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white drop-shadow-lg">🎯 Scoring Guide for IDP Completion and Competency Mastery 🎯</h2>
                <button
                  onClick={() => setShowScoringGuide(false)}
                  className="text-white hover:text-opacity-70 text-3xl font-bold"
                  style={{backgroundColor: CRAYON_COLORS[150], padding: '8px 12px', borderRadius: '50%'}}
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                {SCORING_GUIDE.map((guide, index) => (
                  <div key={guide.score} className="p-4 rounded-2xl shadow-lg border-4" style={{backgroundColor: CRAYON_COLORS[120 + index * 5]}}>
                    <div className="flex items-center gap-4 mb-2">
                      <span className="font-bold text-2xl text-white drop-shadow" style={{backgroundColor: CRAYON_COLORS[160 + index * 3], padding: '8px 16px', borderRadius: '50%'}}>
                        {guide.score}
                      </span>
                      <span className="font-semibold text-white text-lg drop-shadow">🌟 {guide.status}</span>
                    </div>
                    <p className="text-white font-medium drop-shadow">{guide.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Employee Information */}
        <div className="rounded-3xl shadow-2xl p-6 mb-8 border-8 transform hover:scale-105 transition-all" style={{background: `linear-gradient(45deg, ${CRAYON_COLORS.slice(50,58).join(', ')})`}}>
          <h2 className="text-xl font-semibold mb-4 text-white drop-shadow-lg">👤 Employee Information 👤</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-white mb-1 drop-shadow">🏷️ Name</label>
              <input
                type="text"
                value={employee.name}
                readOnly
                className="w-full border-4 rounded-2xl px-3 py-2 font-bold text-white shadow-lg"
                style={{backgroundColor: CRAYON_COLORS[70], borderColor: CRAYON_COLORS[80]}}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1 drop-shadow">💼 Position</label>
              <input
                type="text"
                value={employee.position_title}
                readOnly
                className="w-full border-4 rounded-2xl px-3 py-2 font-bold text-white shadow-lg"
                style={{backgroundColor: CRAYON_COLORS[75], borderColor: CRAYON_COLORS[85]}}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1 drop-shadow">🏢 Department</label>
              <input
                type="text"
                value={employee.department_name}
                readOnly
                className="w-full border-4 rounded-2xl px-3 py-2 font-bold text-white shadow-lg"
                style={{backgroundColor: CRAYON_COLORS[90], borderColor: CRAYON_COLORS[95]}}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1 drop-shadow">👨‍💼 Supervisor/Manager</label>
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
          <h2 className="text-xl font-semibold mb-4">Development Plan</h2>
          
          {idpData.items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No approved competencies found for this employee.</p>
              <p className="text-sm text-gray-400 mt-2">Employee must have approved CL competencies before creating IDP.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {idpData.items.map((item, itemIndex) => (
                <div key={item.competencyId} className="border rounded-lg p-6">
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
                      <h4 className="font-medium">Development Activities</h4>
                      <button
                        onClick={() => addDevelopmentActivity(itemIndex)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Activity
                      </button>
                    </div>

                    {item.developmentActivities.map((activity, activityIndex) => (
                      <div key={activityIndex} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-end mb-4">
                          {item.developmentActivities.length > 1 && (
                            <button
                              onClick={() => removeDevelopmentActivity(itemIndex, activityIndex)}
                              className="text-red-600 hover:text-red-800"
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