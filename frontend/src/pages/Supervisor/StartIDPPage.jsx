import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';

function StartIDPPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [idpEmployees, setIdpEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const navigate = useNavigate();

  useEffect(() => {
    const supervisorRoles = ['Supervisor', 'AM', 'Manager', 'HR'];
    const stored = localStorage.getItem('user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(stored);
    if (!supervisorRoles.includes(parsed.role)) {
      window.location.href = '/';
      return;
    }

    setCurrentUser(parsed);

    async function fetchEmployees() {
      setLoading(true);
      try {
        const employees = await apiRequest('/api/idp/supervisor/for-creation');
        setIdpEmployees(Array.isArray(employees) ? employees : (employees?.data || []));
      } catch (err) {
        console.error(err);
        setError('Failed to load employees requiring IDP creation.');
      } finally {
        setLoading(false);
      }
    }

    fetchEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return idpEmployees;
    const q = searchQuery.toLowerCase();
    return (idpEmployees || []).filter((e) => {
      return (
        String(e.name || '').toLowerCase().includes(q) ||
        String(e.employee_id || '').toLowerCase().includes(q) ||
        String(e.position || e.position_title || '').toLowerCase().includes(q)
      );
    });
  }, [idpEmployees, searchQuery]);

  const handleCreateIDP = (employeeId) => {
    navigate(`/supervisor/idp/create/${employeeId}`);
  };

  const handleBack = () => {
    navigate('/supervisor');
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex justify-between mb-6 items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Start IDP</h1>
            <p className="text-xs text-slate-500 mt-1">
              Select an employee to start an Individual Development Plan.
            </p>
          </div>
          <button
            onClick={handleBack}
            className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
          >
            ← Back
          </button>
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 mb-4 rounded-md">{error}</p>
        )}

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Select an Employee to Start IDP</h2>

            {/* View Toggle Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition ${viewMode === 'grid' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                title="Grid View"
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                title="List View"
              >
                <ListBulletIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="mb-4 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, employee ID, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading employees...</p>
          ) : filteredEmployees.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No employees require IDP creation.</p>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredEmployees.map((emp) => {
                const approvedDate = emp.cl_approved_date ? new Date(emp.cl_approved_date).toLocaleDateString() : null;
                return (
                  <button
                    key={emp.employee_id || emp.id}
                    type="button"
                    onClick={() => handleCreateIDP(emp.employee_id || emp.id)}
                    className="relative border border-slate-200 border-l-4 border-l-blue-500 rounded-sm pl-3 pr-4 py-4 text-left shadow-sm transition flex gap-3 items-start bg-white hover:shadow-md hover:-translate-y-0.5"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 20.5a7 7 0 0113 0M12 12a4 4 0 100-8 4 4 0 000 8z" />
                        </svg>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-sm truncate text-slate-800">{emp.name}</div>
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{emp.employee_id}</span>
                      </div>

                      {(emp.position || emp.position_title) && (
                        <div className="text-xs text-slate-700 mt-1">{emp.position || emp.position_title}</div>
                      )}
                      {emp.department && (
                        <div className="text-[11px] text-slate-500">{emp.department}</div>
                      )}

                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Requires IDP</span>
                        {approvedDate ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">CL Approved: {approvedDate}</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">CL Approved: N/A</span>
                        )}
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500">Click to create IDP</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEmployees.map((emp) => {
                const approvedDate = emp.cl_approved_date ? new Date(emp.cl_approved_date).toLocaleDateString() : null;
                return (
                  <button
                    key={emp.employee_id || emp.id}
                    type="button"
                    onClick={() => handleCreateIDP(emp.employee_id || emp.id)}
                    className="w-full border border-slate-200 border-l-4 border-l-blue-500 rounded-sm pl-3 pr-4 py-3 text-left shadow-sm transition flex gap-3 items-center bg-white hover:shadow-md hover:bg-slate-50"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 20.5a7 7 0 0113 0M12 12a4 4 0 100-8 4 4 0 000 8z" />
                        </svg>
                      </div>
                    </div>

                    {/* Horizontal content */}
                    <div className="flex-1 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-sm text-slate-800">{emp.name}</div>
                            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{emp.employee_id}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {(emp.position || emp.position_title) && (
                              <span className="text-xs text-slate-700">{emp.position || emp.position_title}</span>
                            )}
                            {emp.department && (
                              <>
                                <span className="text-slate-400">•</span>
                                <span className="text-xs text-slate-500">{emp.department}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Tags */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">Requires IDP</span>
                        {approvedDate ? (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 whitespace-nowrap">CL Approved: {approvedDate}</span>
                        ) : (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">CL Approved: N/A</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StartIDPPage;
