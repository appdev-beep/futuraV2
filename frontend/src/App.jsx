// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPageSeparate from './pages/LoginPage';
import AdminCreateUserPage from './pages/AdminPage';
import SupervisorDashboard from './pages/SupervisorDashboard';
import StartCLPage from './pages/StartCLPage';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerReviewCLPage from './pages/ManagerReviewCLPage';

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
        <Route path="/cl/start" element={<StartCLPage />} />

        {/* Manager pages */}
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/cl/submissions/:id" element={<ManagerReviewCLPage />} />

        {/* catch-all → login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
