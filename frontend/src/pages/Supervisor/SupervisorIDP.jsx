import React from 'react';

export default function SupervisorIDP({ idpSummary, idpEmployees, openIDPModal }) {
  function SummaryCard({ label, value, gradientClass }) {
    return (
      <div className={`p-4 rounded shadow-md bg-gradient-to-r ${gradientClass}`}>
        <h3 className="text-sm text-white/80">{label}</h3>
        <p className="text-3xl font-semibold text-white mt-1">{value}</p>
      </div>
    );
  }

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="FOR IDP CREATION"
          value={idpSummary.idpCreation}
          gradientClass="from-blue-400 to-blue-600"
        />
        <SummaryCard
          label="IDP For Approval"
          value={idpSummary.idpPending}
          gradientClass="from-yellow-400 to-orange-500"
        />
        <SummaryCard
          label="IDP Returns"
          value={idpSummary.idpReturned}
          gradientClass="from-red-400 to-red-600"
        />
        <SummaryCard
          label="IDP Approved"
          value={idpSummary.idpApproved}
          gradientClass="from-emerald-400 to-emerald-700"
        />
      </section>

      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Employees Requiring IDP Creation</h2>
        {idpEmployees.length === 0 ? (
          <p className="text-gray-400 text-sm italic">No employees require IDP creation at this time.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CL Approved Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {idpEmployees.map((emp) => (
                  <tr key={emp.employee_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.employee_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.position || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {emp.cl_approved_date ? new Date(emp.cl_approved_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => openIDPModal(emp)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Create IDP
                      </button>
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
