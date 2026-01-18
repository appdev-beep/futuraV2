// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Shared pages
import LoginPage from './pages/Shared/LoginPage';

// Admin pages
import AdminPage from './pages/Admin/AdminPage';

// Supervisor pages
import SupervisorDashboard from './pages/Supervisor/SupervisorDashboard';
import SupervisorReviewCLPage from './pages/Supervisor/SupervisorReviewCLPage';
import StartCLPage from './pages/Supervisor/StartCLPage';
import StartIDPPage from './pages/Supervisor/StartIDPPage';
import CreateIDPPage from './pages/Supervisor/CreateIDPPage';

// Manager pages
import ManagerDashboard from './pages/Manager/ManagerDashboard';
import ManagerReviewCLPage from './pages/Manager/ManagerReviewCLPage';

// Assistant Manager pages
import AMDashboard from './pages/AssistantManager/AMDashboard';
import AMReviewCLPage from './pages/AssistantManager/AMReviewCLPage';

// HR pages
import HRDashboard from './pages/HR/HRDashboard';
import HRReviewCLPage from './pages/HR/HRReviewCLPage';
import HREmployeeManagement from './pages/HR/HREmployeeManagement';

// Employee pages
import EmployeeDashboard from './pages/Employee/EmployeeDashboard';
import EmployeeReviewCLPage from './pages/Employee/EmployeeReviewCLPage';

import './index.css';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* default → login */}
            <Route path="/" element={<Navigate to="/login" />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />

            {/* Admin pages */}
            <Route path="/admin/users/create" element={<AdminPage />} />

            {/* Supervisor pages */}
            <Route path="/supervisor" element={<SupervisorDashboard />} />
            <Route path="/cl/supervisor/review/:id" element={<SupervisorReviewCLPage />} />
            <Route path="/cl/start" element={<StartCLPage />} />
            <Route path="/idp/start" element={<StartIDPPage />} />
            <Route path="/supervisor/idp/create/:employeeId" element={<CreateIDPPage />} />
            <Route path="/supervisor/idp/:id" element={<CreateIDPPage />} />

            {/* Manager pages */}
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/idp/:id" element={<CreateIDPPage />} />
            <Route path="/cl/submissions/:id" element={<ManagerReviewCLPage />} />

            {/* Employee pages */}
            <Route path="/employee" element={<EmployeeDashboard />} />
            <Route path="/cl/employee/review/:id" element={<EmployeeReviewCLPage />} />
            <Route path="/employee/idp/:id" element={<CreateIDPPage />} />

            {/* Assistant Manager pages */}
            <Route path="/am" element={<AMDashboard />} />
            <Route path="/am/idp/:id" element={<CreateIDPPage />} />
            <Route path="/cl/am/review/:id" element={<AMReviewCLPage />} />

            {/* HR pages */}
            <Route path="/hr" element={<HRDashboard />} />
            <Route path="/hr/employees" element={<HREmployeeManagement />} />
            <Route path="/hr/idp/:id" element={<CreateIDPPage />} />
            <Route path="/cl/hr/review/:id" element={<HRReviewCLPage />} />

            {/* catch-all → login */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
