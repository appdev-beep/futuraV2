import React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';

// Format timestamps consistently for HR display (local time): YYYY-MM-DD HH:mm:ss
function formatTimestamp(value) {
  if (!value) return 'N/A';
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (isNaN(date.getTime())) return 'N/A';

  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function SummaryCard({ label, value, gradientClass }) {
  return (
    <div className={`p-4 rounded shadow-md bg-gradient-to-r ${gradientClass}`}>
      <h3 className="text-sm text-white/80">{label}</h3>
      <p className="text-3xl font-semibold text-white mt-1">{value}</p>
    </div>
  );
}

export default function SupervisorIDP({ idpSummary, idpByStatus, activeIDPSection, IDP_STATUS_SECTIONS, refreshIDPs }) {
  const navigate = useNavigate();

  // Delete handler (supervisor owner may delete even if in approval)
  async function handleDeleteIDP(idpId) {
    if (!window.confirm('Are you sure you want to delete this IDP? This action cannot be undone.')) return;
    try {
      // Use apiRequest to ensure correct base URL and headers
        await apiRequest(`/api/idp/${idpId}`, { method: 'DELETE' });
        alert('IDP deleted successfully.');
        if (typeof refreshIDPs === 'function') refreshIDPs();
    } catch (err) {
      alert('Failed to delete IDP.');
      console.error(err);
    }
  }

  // Filtered IDP list for the selected section
  let filteredIDPs = [];
  if (activeIDPSection === 'ALL') {
    filteredIDPs = Object.values(idpByStatus || {}).flat();
  } else {
    filteredIDPs = idpByStatus?.[activeIDPSection] || [];
  }

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <SummaryCard label="IDP DRAFTS" value={idpSummary.idpDrafts} gradientClass="from-purple-400 to-purple-600" />
        <SummaryCard label="FOR IDP CREATION" value={idpSummary.idpCreation} gradientClass="from-blue-400 to-blue-600" />
        <SummaryCard label="IDP For Approval" value={idpSummary.idpPending} gradientClass="from-yellow-400 to-orange-500" />
        <SummaryCard label="IDP Returns" value={idpSummary.idpReturned} gradientClass="from-red-400 to-red-600" />
        <SummaryCard label="Cycle Completed" value={idpSummary.idpCycleCompleted} gradientClass="from-emerald-400 to-emerald-700" />
      </section>

      {/* IDP By Status Table (filtered) */}
      <section className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          {activeIDPSection === 'ALL'
            ? 'All IDPs'
            : (IDP_STATUS_SECTIONS.find(s => s.key === activeIDPSection)?.label || activeIDPSection.replace(/_/g, ' '))}
        </h2>
        {filteredIDPs.length === 0 ? (
          <p className="text-gray-400 text-sm italic">No IDPs in this section.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IDP ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIDPs.map((idp) => (
                  <tr key={idp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{idp.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{idp.employee_id || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{idp.employee_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idp.department_name || idp.department || (idp.department_id ? `Dept #${idp.department_id}` : 'N/A')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idp.position_title || idp.position || (idp.position_id ? `Position #${idp.position_id}` : 'N/A')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatTimestamp(idp.submitted_at || idp.created_at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idp.status || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => navigate(`/supervisor/idp/${idp.id}`)}
                        className="text-blue-600 hover:text-blue-900 font-medium mr-2"
                      >
                        View
                      </button>
                      {(idp.status === 'DRAFT' || Number(idp.supervisor_id) === Number(localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).id : -1)) && (
                        <button
                          onClick={() => handleDeleteIDP(idp.id)}
                          className="text-red-600 hover:text-red-900 font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
