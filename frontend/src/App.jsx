// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPageSeparate from './pages/LoginPage';
import AdminCreateUserPage from './pages/AdminPage';
import SupervisorDashboard from './pages/SupervisorDashboard';
import SupervisorReviewCLPage from './pages/SupervisorReviewCLPage';
import StartCLPage from './pages/StartCLPage';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerReviewCLPage from './pages/ManagerReviewCLPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeReviewCLPage from './pages/EmployeeReviewCLPage';
import AMDashboard from './pages/AMDashboard';
import AMReviewCLPage from './pages/AMReviewCLPage';
import HRDashboard from './pages/HRDashboard';
import HRReviewCLPage from './pages/HRReviewCLPage';
import './index.css';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* default → login */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Auth */}
        <Route path="/login" element={<LoginPageSeparate />} />

        {/* Admin pages */}
        <Route path="/admin/users/create" element={<AdminCreateUserPage />} />

        {/* Supervisor pages */}
        <Route path="/supervisor" element={<SupervisorDashboard />} />
        <Route path="/cl/supervisor/review/:id" element={<SupervisorReviewCLPage />} />
        <Route path="/cl/start" element={<StartCLPage />} />

        {/* Manager pages */}
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/cl/submissions/:id" element={<ManagerReviewCLPage />} />

        {/* Employee pages */}
        <Route path="/employee" element={<EmployeeDashboard />} />
        <Route path="/cl/employee/review/:id" element={<EmployeeReviewCLPage />} />

        {/* Assistant Manager pages */}
        <Route path="/am" element={<AMDashboard />} />
        <Route path="/cl/am/review/:id" element={<AMReviewCLPage />} />

        {/* HR pages */}
        <Route path="/hr" element={<HRDashboard />} />
        <Route path="/cl/hr/review/:id" element={<HRReviewCLPage />} />

        {/* catch-all → login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
