import React from 'react';

function Th({ children }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">{children}</th>
  );
}

function Td({ children }) {
  return <td className="px-4 py-2 text-gray-700">{children}</td>;
}

function CLTable({ data, goTo, onDelete }) {
  return (
    <div className="bg-white shadow rounded overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <Th>CL ID</Th>
            <Th>Employee</Th>
            <Th>Employee ID</Th>
            <Th>Department</Th>
            <Th>Position</Th>
            <Th>Final Score</Th>
            <Th>Status</Th>
            <Th>Submitted At</Th>
            <Th>Actions</Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
          {data.map((item, idx) => (
            <tr key={`${item.id}-${idx}`} className="hover:bg-gray-50">
              <Td>{item.id}</Td>
              <Td>{item.employee_name}</Td>
              <Td>{item.employee_code || item.employee_id}</Td>
              <Td>{item.department_name}</Td>
              <Td>{item.position_title}</Td>
              <Td>{(() => {
                // Calculate the final score exactly like in the detailed view
                // Sum up (score * weight) for all competencies
                let totalScore = 0;
                let totalWeight = 0;
                
                // Check if we have competency items in various possible formats
                const competencyItems = item.items || item.competencies || item.competency_items || [];
                
                if (Array.isArray(competencyItems) && competencyItems.length > 0) {
                  competencyItems.forEach(comp => {
                    const score = parseFloat(comp.score || comp.assigned_level || comp.level || 0);
                    const weight = parseFloat(comp.weight || 0);
                    
                    if (weight > 0) {
                      totalScore += (score * weight) / 100;
                      totalWeight += weight;
                    }
                  });
                  
                  if (totalWeight > 0) {
                    return totalScore.toFixed(2);
                  }
                }
                
                // Fallback to any pre-calculated score
                if (item.total_final_score) return Number(item.total_final_score).toFixed(2);
                if (item.final_score) return Number(item.final_score).toFixed(2);
                if (item.calculated_final_score) return Number(item.calculated_final_score).toFixed(2);
                
                return '0.00';
              })()}</Td>
              <Td>
                {item.status === 'PENDING_AM' ? 'For Assistant Manager Review' :
                 item.status === 'PENDING_MANAGER' ? 'For Manager Approval' :
                 item.status === 'PENDING_HR' ? 'For HR Approval' :
                 item.status === 'PENDING_EMPLOYEE' ? 'For Employee Approval' :
                 item.status === 'PENDING_SUPERVISOR' ? 'For Supervisor Approval' :
                 item.status === 'APPROVED' ? 'Approved' :
                 item.status === 'CYCLE_COMPLETED' ? 'Cycle Completed' :
                 item.status === 'RETURNED' ? 'Returned for Review' :
                 item.status === 'REJECTED' ? 'Rejected' :
                 item.status === 'FOR_COMPLETION' ? 'For Completion' :
                 item.status === 'DRAFT' ? (item.awaiting_approval_from ? `Returned from ${item.awaiting_approval_from.replace('PENDING_', '').replace(/_/g, ' ')}` : 'Draft - Not Submitted') :
                 item.status}
              </Td>
              <Td>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '-'}</Td>

              <Td>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => goTo(`/cl/supervisor/review/${item.id}`)}
                    className="px-3 py-1 rounded text-white text-xs
                             bg-gradient-to-r from-blue-500 to-blue-700
                             hover:from-blue-600 hover:to-blue-800"
                  >
                    Review
                  </button>

                  <button
                    onClick={() => onDelete(item.id)}
                    className="px-3 py-1 rounded text-white text-xs
                             bg-gradient-to-r from-red-500 to-red-700
                             hover:from-red-600 hover:to-red-800"
                  >
                    Delete
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ label, value, gradientClass }) {
  return (
    <div className={`p-4 rounded shadow-md bg-gradient-to-r ${gradientClass}`}>
      <h3 className="text-sm text-white/80">{label}</h3>
      <p className="text-3xl font-semibold text-white mt-1">{value}</p>
    </div>
  );
}

export default function SupervisorCL({
  loading,
  summary,
  activeLabel,
  activeSection,
  CL_STATUS_SECTIONS,
  clByStatus,
  handleDeleteCL,
  goTo,
}) {
  return (
    <>
      {loading && <p>Loading...</p>}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          label="Competencies Levelling For Approval"
          value={summary.clPending}
          gradientClass="from-yellow-400 to-orange-500"
        />
        <SummaryCard
          label="Returned Competency Levelling"
          value={summary.clReturned}
          gradientClass="from-red-400 to-red-600"
        />
        <SummaryCard
          label="Approved Competency Levelling"
          value={summary.clApproved}
          gradientClass="from-emerald-400 to-emerald-700"
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{activeLabel}</h2>

        {activeSection === 'ALL' ? (
          CL_STATUS_SECTIONS.map(({ key, label }) => {
            const items = clByStatus[key] || [];
            return (
              <div key={key} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">{label}</h3>
                {items.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">No employees in this status.</p>
                ) : (
                  <CLTable data={items} goTo={goTo} onDelete={handleDeleteCL} />
                )}
              </div>
            );
          })
        ) : (
          (() => {
            const items = clByStatus[activeSection] || [];
            if (items.length === 0) {
              return <p className="text-gray-400 text-sm italic">No employees in this status.</p>;
            }
            return <CLTable data={items} goTo={goTo} onDelete={handleDeleteCL} />;
          })()
        )}
      </section>
    </>
  );
}
