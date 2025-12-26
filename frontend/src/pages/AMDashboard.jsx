// src/pages/AMDashboard.jsx

import React from 'react';
import ManagerDashboard from './ManagerDashboard';


function AMDashboard() {
  // Just render ManagerDashboard, let it handle role-based access
  return <ManagerDashboard isAMDashboard={true} />;
}

function Th({ children }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  );
}

function Td({ children }) {
  return (
    <td className="px-4 py-2 align-top text-sm text-gray-700">
      {children}
    </td>
  );
}

export default AMDashboard;
