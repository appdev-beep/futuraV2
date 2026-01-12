// src/pages/EmployeeDashboard.jsx
import { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../api/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BellIcon,
  ArrowRightOnRectangleIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  ArrowsPointingOutIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  DocumentTextIcon,
  UserCircleIcon,
  ClockIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import '../index.css';
import '../App.css'; 
import Modal from '../components/Modal';
import { displayStatus } from '../utils/statusHelper';

function EmployeeDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCL, setPendingCL] = useState([]);
  const [clHistory, setClHistory] = useState([]); // includes decision fields
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  
  const [notificationModalState, setNotificationModalState] = useState({
    open: false,
    notification: null,
  });

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileDetails, setProfileDetails] = useState(null);
  const [selectedCL, _setSelectedCL] = useState(null);
  const [selectedCLLoading, _setSelectedCLLoading] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('ALL');
  const [recentActionFilter, setRecentActionFilter] = useState('ALL');

  const [activeView, setActiveView] = useState('pending'); // 'pending' or 'history'
  const [, setActiveModule] = useState('CL'); // 'CL' or 'IDP' (we only need the setter)
  const [currentCompetencies, setCurrentCompetencies] = useState(null);
  const [approvedCompetencies, setApprovedCompetencies] = useState(null);
  const [competenciesLoading, setCompetenciesLoading] = useState(false);
  const [showFullNotifications, setShowFullNotifications] = useState(false);
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);
  const [employeeIDPs, setEmployeeIDPs] = useState([]);

  // Auth check – must be logged in and Employee
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(storedUser);

    if (parsed.role !== 'Employee') {
      window.location.href = '/';
      return;
    }

    setUser(parsed);
  }, []);

  // Load pending CLs + full history for this employee
  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const [pendingData, historyData] = await Promise.all([
          apiRequest('/api/cl/employee/pending', { method: 'GET' }),
          apiRequest('/api/cl/employee/my/history', { method: 'GET' }),
        ]);

        setPendingCL(pendingData || []);
        setClHistory(historyData || []);
      } catch (err) {
        console.error(err);
        setError(
          'Failed to load your dashboard data. Please check /api/cl/employee/pending and /api/cl/employee/my/history routes.'
        );
      } finally {
        setLoading(false);
      }
    }

    // Kick off dashboard load
    loadDashboard();
  }, [user]);

  // ==========================
  // LOAD NOTIFICATIONS
  // ==========================
  useEffect(() => {
    if (!user) return;
    let timer;

    async function loadNotifications() {
      try {
        const data = await apiRequest('/api/notifications');
        setNotifications(data || []);
      } catch (err) {
        console.error('Failed to load notifications', err);
      }
    }

    loadNotifications();
    timer = setInterval(loadNotifications, 15000);

    return () => clearInterval(timer);
  }, [user]);

  // ==========================
  // LOAD RECENT ACTIONS
  // ==========================
  useEffect(() => {
    if (!user) return;

    async function loadRecentActions() {
      try {
        const data = await apiRequest('/api/recent-actions');
        setRecentActions(data || []);
      } catch (err) {
        console.error('Failed to load recent actions', err);
      }
    }

    loadRecentActions();
  }, [user]);

  // Load competencies for employee and split into current (in-flow) and approved
  useEffect(() => {
    if (!user) return;

    async function loadCompetencies() {
      setCompetenciesLoading(true);
      try {
        // Employees fetch their own competencies via a dedicated endpoint to avoid role checks
        const data = await apiRequest(`/api/cl/employee/my/competencies`, { method: 'GET' });
        const all = data?.competencies || [];

        // Determine approved items from API
        const approvedFromApi = all.filter((c) => {
          const s = String(c.status || c.approval_status || '').toLowerCase();
          if (s.includes('approved')) return true;
          if (c.approved === true) return true;
          if (c.approved_at) return true;
          return false;
        });

        // Determine current/in-flow items from API (not approved)
        const currentFromApi = all.filter((c) => !approvedFromApi.includes(c));

        // Also derive competencies from CL history by fetching CL details
        const clHistorySource = Array.isArray(clHistory) ? clHistory : [];
        const clToFetch = clHistorySource.slice(0, 25); // limit to recent 25 CLs to avoid too many requests
        const clDetails = await Promise.all(
          clToFetch.map(async (cl) => {
            try {
              const d = await apiRequest(`/api/cl/${cl.id}`);
              return { header: cl, details: d };
            } catch {
              return { header: cl, details: null };
            }
          })
        );

        const currentFromCLs = [];
        const approvedFromCLs = [];

        for (const pair of clDetails) {
          const cl = pair.header;
          const d = pair.details;
          const s = String(cl.status || '').toLowerCase();
          const items = (d && Array.isArray(d.items)) ? d.items : [];

          if (s.includes('approved')) {
            for (const it of items) {
              approvedFromCLs.push({
                id: it.competency_id || it.id || null,
                competency_name: it.competency_name || it.name || it.competency || null,
                approved_level: it.assigned_level || it.approved_level || it.mplr || null,
                approved_at: cl.approved_at || cl.updated_at || cl.decision_at || null,
                notes: it.justification || it.description || it.notes || null,
              });
            }
          } else {
            for (const it of items) {
              currentFromCLs.push({
                id: it.competency_id || it.id || null,
                competency_name: it.competency_name || it.name || it.competency || null,
                current_level: it.current_level || it.assigned_level || it.mplr || null,
                suggested_level: it.suggested_level || it.mplr || null,
                notes: it.justification || it.description || it.notes || null,
              });
            }
          }
        }

        // Merge API + CL-derived lists and dedupe by competency_name or id
        const keyFor = (c) => (c.id ? String(c.id) : (c.competency_name ? `name:${c.competency_name}` : JSON.stringify(c)));

        const mergedCurrent = [...currentFromApi.map(c => ({ ...c })), ...currentFromCLs];
        const seenCurrent = new Set();
        const uniqueCurrent = [];
        for (const c of mergedCurrent) {
          const k = keyFor(c);
          if (!seenCurrent.has(k)) {
            seenCurrent.add(k);
            uniqueCurrent.push(c);
          }
        }

        const mergedApproved = [...approvedFromApi.map(c => ({ ...c })), ...approvedFromCLs];
        const seenApproved = new Set();
        const uniqueApproved = [];
        for (const c of mergedApproved) {
          const k = keyFor(c);
          if (!seenApproved.has(k)) {
            seenApproved.add(k);
            uniqueApproved.push(c);
          }
        }

        setApprovedCompetencies(uniqueApproved);
        setCurrentCompetencies(uniqueCurrent);
      } catch (err) {
        console.error('Failed to load competencies:', err);
        setApprovedCompetencies([]);
        setCurrentCompetencies([]);
      } finally {
        setCompetenciesLoading(false);
      }
    }

    // Only load when user is present; keep cached between views
    loadCompetencies();
  }, [user, pendingCL, clHistory]);

  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === 'ALL') return notifications;
    return notifications.filter(n => n.module === notificationFilter);
  }, [notifications, notificationFilter]);

  const filteredRecentActions = useMemo(() => {
    if (recentActionFilter === 'ALL') return recentActions;
    return recentActions.filter(a => a.module === recentActionFilter);
  }, [recentActions, recentActionFilter]);

  function handleExportCSV(cl) {
    if (!cl || !cl.items || cl.items.length === 0) return;

    let csv = '\uFEFF'; // BOM for proper UTF-8 encoding in Excel
    csv += 'CL ID,Cycle,Status,Total Score\n';
    csv += `${cl.id},"${cl.cycle_name || cl.cycle_id || ''}",${displayStatus(cl.status)},${cl.total_score || ''}\n\n`;
    csv += 'Competency,Weight (%),Level,Score,Comments\n';

    cl.items.forEach((item) => {
      const score = ((item.weight || 0) / 100) * (item.assigned_level || 0);
      csv += `"${item.competency_name || ''}",${item.weight || 0},${item.assigned_level || ''},${score.toFixed(2)},"${(item.justification || '').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CL-${cl.id}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  function handleExportPDF(cl) {
    if (!cl || !cl.items || cl.items.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Competency Leveling Form', 14, 15);

    doc.setFontSize(10);
    doc.text(`CL ID: ${cl.id}`, 14, 25);
    doc.text(`Cycle: ${cl.cycle_name || cl.cycle_id || ''}`, 14, 32);
    doc.text(`Status: ${displayStatus(cl.status)}`, 14, 39);
    doc.text(`Total Score: ${cl.total_score != null ? Number(cl.total_score).toFixed(2) : ''}`, 14, 46);

    const tableData = cl.items.map((item) => [
      item.competency_name || '',
      item.weight || 0,
      item.assigned_level || '',
      (((item.weight || 0) / 100) * (item.assigned_level || 0)).toFixed(2),
      item.justification || '',
    ]);

    autoTable(doc, {
      head: [['Competency', 'Weight (%)', 'Level', 'Score', 'Comments']],
      body: tableData,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [0, 0, 0] },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });

    doc.save(`CL-${cl.id}-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function goTo(url) {
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    if (currentPath === targetPath) {
      window.location.reload();
      return;
    }
    window.location.href = url;
  }

  async function openProfileModal() {
    setShowProfileModal(true);
    setProfileLoading(true);
    try {
      const data = await apiRequest(`/api/users/${user?.id}`);
      setProfileDetails(data || user);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setProfileDetails(user);
    } finally {
      setProfileLoading(false);
    }
  }

  function closeProfileModal() {
    setShowProfileModal(false);
    setProfileDetails(null);
  }

  async function handleNotificationClick(n) {
    // Mark notification as read
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/notifications/${n.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      // Reload notifications to update the list
      const data = await apiRequest('/api/notifications');
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    setNotificationModalState({
      open: true,
      notification: n,
    });
  }

  async function handleMarkAllAsRead() {
    try {
      await apiRequest('/api/notifications/mark-all-read', { method: 'PATCH' });
      // Reload notifications to update UI
      const data = await apiRequest('/api/notifications');
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }

  async function handleRecentActionClick(action) {
    // If action is a deletion, show when it was deleted
    if (action.title && action.title.toLowerCase().includes('deleted')) {
      alert(`${action.title}\n\n${action.description || ''}\n\nDeleted at: ${new Date(action.created_at).toLocaleString()}`);
      return;
    }
    
    // Check if we're staying on the same page
    const url = action.url || '/employee';
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    
    if (currentPath === targetPath) {
      // Just close modal and stay on current page
      return;
    }
    
    // Navigate to different page
    const separator = url.includes('?') ? '&' : '?';
    window.location.href = `${url}${separator}viewOnly=true`;
  }

  async function proceedToNotificationLink(n) {
    setNotificationModalState({ open: false, notification: null });
    
    try {
      if (n?.id) {
        await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
        // Reload notifications to update UI
        const data = await apiRequest('/api/notifications');
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
    
    // Check if we're staying on the same page
    const url = n?.url || '/employee';
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    
    if (currentPath === targetPath) {
      // Stay on current page without refresh
      return;
    }
    
    // Navigate to different page
    window.location.href = url;
  }

  function closeNotificationModal() {
    setNotificationModalState({ open: false, notification: null });
    // Modal stays closed without refresh
  }

  // open profile modal when user presses View Profile
  // (uses clHistory already loaded above)

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadEmployeeIDPs() {
      try {
        const data = await apiRequest('/api/idp/employee/my');
        if (!cancelled) setEmployeeIDPs(data || []);
      } catch (err) {
        console.error('Failed to load employee IDPs', err);
        if (!cancelled) setEmployeeIDPs([]);
      }
    }
    loadEmployeeIDPs();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) {
    return null; // wait for auth check
  }

  // If you ever want only rows where employee actually acted:
  // const employeeActivity = clHistory.filter(
  //   (row) => row.employee_decision != null && row.employee_decision !== ''
  // );
  const employeeActivity = clHistory;

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT SIDEBAR - Navigation */}
      <aside className="w-72 bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <AcademicCapIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">FUTURA</h2>
              <p className="text-xs text-slate-400">Employee Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => { setActiveModule('IDP'); setActiveView('idp_pending'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium text-sm ${
              activeView === 'idp_pending'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <DocumentTextIcon className="w-5 h-5" />
            <span>IDP For Approval</span>
          </button>

          <button
            onClick={() => { setActiveModule('CL'); setActiveView('pending'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium text-sm ${
              activeView === 'pending'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <ClipboardDocumentListIcon className="w-5 h-5" />
            <span>CL For Approval</span>
          </button>

          <button
            onClick={() => { setActiveModule('CL'); setActiveView('tracking'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium text-sm ${
              activeView === 'tracking'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <ChartBarIcon className="w-5 h-5" />
            <span>CL & IDP Tracking</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
                       bg-red-600/90 text-white hover:bg-red-600 transition shadow-lg hover:shadow-xl font-medium text-sm"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="p-8">
          <header className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-1">Employee Dashboard</h1>
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                    <UserCircleIcon className="w-4 h-4" />
                    {user.name}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">ID: {user.employee_id}</span>
                </p>
              </div>

              <div>
                <button
                  onClick={openProfileModal}
                  title="View profile"
                  aria-label="View profile"
                  className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg transition text-slate-700 hover:text-blue-600 font-medium text-sm"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {user && user.name ? (
                      <span>{user.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}</span>
                    ) : (
                      <UserCircleIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="hidden md:inline">View Profile</span>
                </button>
              </div>
            </div>
          </header>

          {/* Dashboard Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Pending CLs</p>
                  <p className="text-3xl font-bold text-blue-600">{pendingCL.length}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                  <ClipboardDocumentCheckIcon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Pending IDPs</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {employeeIDPs.filter(h => h.status === 'PENDING_EMPLOYEE').length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                  <DocumentTextIcon className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Total History</p>
                  <p className="text-3xl font-bold text-emerald-600">{clHistory.length + employeeIDPs.length}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <ChartBarIcon className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="mb-6 text-center py-12">
              <div className="inline-flex items-center gap-2 text-slate-600">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="font-medium">Loading dashboard…</span>
              </div>
            </div>
          )}

        <ProfileModal
          open={showProfileModal}
          userData={profileDetails || user}
          loading={profileLoading}
          onClose={closeProfileModal}
        />

        {/* Current Competencies View */}
        {activeView === 'current' && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Current Competencies</h2>
            {competenciesLoading ? (
              <p className="text-sm text-gray-600">Loading competencies…</p>
            ) : (currentCompetencies && currentCompetencies.length > 0) ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Competency</Th>
                      <Th>Current Level</Th>
                      <Th>Suggested MPLR</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentCompetencies.map((c, i) => (
                      <tr key={c.id || i} className="hover:bg-gray-50">
                        <Td>{c.competency_name || c.name || '-'}</Td>
                        <Td>{c.current_level || c.mplr || '-'}</Td>
                        <Td>{c.suggested_level || c.mplr || '-'}</Td>
                        <Td className="text-xs text-gray-600">{c.notes || c.description || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-600">No current competencies in flow.</p>
            )}
          </section>
        )}

        {/* Approved Competencies View */}
        {activeView === 'approved' && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Approved Competencies</h2>
            {competenciesLoading ? (
              <p className="text-sm text-gray-600">Loading competencies…</p>
            ) : (approvedCompetencies && approvedCompetencies.length > 0) ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Competency</Th>
                      <Th>Approved Level</Th>
                      <Th>Approved On</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {approvedCompetencies.map((c, i) => (
                      <tr key={c.id || i} className="hover:bg-gray-50">
                        <Td>{c.competency_name || c.name || '-'}</Td>
                        <Td>{c.approved_level || c.assigned_level || c.mplr || '-'}</Td>
                        <Td>{c.approved_at ? new Date(c.approved_at).toLocaleString() : (c.approved_on ? new Date(c.approved_on).toLocaleString() : '-')}</Td>
                        <Td className="text-xs text-gray-600">{c.notes || c.description || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-600">No approved competencies found.</p>
            )}
          </section>
        )}

        {/* CONDITIONAL CONTENT BASED ON VIEW */}

        {/* IDP Views (real lists) */}
          {activeView && typeof activeView === 'string' && activeView.startsWith('idp') && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <DocumentTextIcon className="w-6 h-6 text-purple-600" />
                  IDP — {activeView === 'idp_pending' ? 'For Your Acknowledgement' : activeView === 'idp_returned' ? 'Returned to You' : activeView === 'idp_approved' ? 'Cycle Completed IDPs' : 'My IDPs'}
                </h2>
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                  {employeeIDPs.filter(h => {
                    if (activeView === 'idp_pending') return h.status === 'PENDING_EMPLOYEE';
                    if (activeView === 'idp_returned') return h.status === 'RETURNED';
                    if (activeView === 'idp_approved') return (h.status === 'CYCLE_COMPLETED');
                    return true;
                  }).length} {activeView === 'idp_pending' ? 'Pending' : 'Total'}
                </span>
              </div>

              {employeeIDPs.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium mb-1">No IDPs Found</p>
                  <p className="text-sm text-slate-500">You don't have any IDP records yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <Th>IDP #</Th>
                          <Th>Supervisor</Th>
                          <Th>Status</Th>
                          <Th>Submitted At</Th>
                          <Th>Actions</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {employeeIDPs.filter(h => {
                          if (activeView === 'idp_pending') return h.status === 'PENDING_EMPLOYEE';
                          if (activeView === 'idp_returned') return h.status === 'RETURNED';
                          if (activeView === 'idp_approved') return (h.status === 'CYCLE_COMPLETED');
                          return true;
                        }).map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50 transition">
                            <Td>
                              <span className="font-semibold text-slate-900">#{h.id}</span>
                            </Td>
                            <Td>{h.supervisor_name || h.supervisor_id || '-'}</Td>
                            <Td>
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                                {displayStatus(h.status)}
                              </span>
                            </Td>
                            <Td>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <ClockIcon className="w-4 h-4" />
                                {h.created_at ? new Date(h.created_at).toLocaleString() : '-'}
                              </div>
                            </Td>
                            <Td>
                              <button
                                type="button"
                                onClick={() => goTo(`/employee/idp/view/${h.id}`)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 shadow-sm hover:shadow transition"
                              >
                                <DocumentTextIcon className="w-4 h-4" />
                                View
                              </button>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeView === 'pending' && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardDocumentCheckIcon className="w-6 h-6 text-blue-600" />
                  Pending Competency Leveling Review
                </h2>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                  {pendingCL.length} Pending
                </span>
              </div>
              {pendingCL.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium mb-1">All Caught Up!</p>
                  <p className="text-sm text-slate-500">No pending competency leveling forms for your review.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <Th>Supervisor</Th>
                          <Th>Department</Th>
                          <Th>Submitted At</Th>
                          <Th>Status</Th>
                          <Th>Actions</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {pendingCL.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition">
                            <Td>{item.supervisor_name}</Td>
                            <Td>{item.department_name}</Td>
                            <Td>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <ClockIcon className="w-4 h-4" />
                                {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                              </div>
                            </Td>
                            <Td>
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                {displayStatus(item.status)}
                              </span>
                            </Td>
                            <Td>
                              <button
                                type="button"
                                onClick={() => goTo(`/cl/employee/review/${item.id}`)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm hover:shadow transition"
                              >
                                <DocumentTextIcon className="w-4 h-4" />
                                Review
                              </button>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

        {activeView === 'history' && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">My Competency Leveling Activity</h2>
            {selectedCLLoading ? (
              <div className="p-6 text-center text-gray-500">Loading CL details…</div>
            ) : selectedCL ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">CL Basic Information</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExportCSV(selectedCL)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-slate-600 text-white hover:bg-slate-700 transition font-semibold"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV
                    </button>
                    <button
                      onClick={() => handleExportPDF(selectedCL)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-slate-600 text-white hover:bg-slate-700 transition font-semibold"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Export PDF
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-600">CL ID:</span>
                      <span className="ml-2 font-medium text-slate-800">{selectedCL.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Cycle:</span>
                      <span className="ml-2 font-medium text-slate-800">{selectedCL.cycle_name || selectedCL.cycle_id || ''}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Status:</span>
                      <span className="ml-2 font-medium text-slate-600">{displayStatus(selectedCL.status)}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Total Score:</span>
                      <span className="ml-2 font-medium text-slate-600">{selectedCL.total_score != null ? Number(selectedCL.total_score).toFixed(2) : ''}</span>
                    </div>
                  </div>
                </div>

                {selectedCL.items && selectedCL.items.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-700 p-4 border-b border-slate-200">Competency Assessment Items</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Competency</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Weight (%)</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Level</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Score</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Comments</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedCL.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-800">{item.competency_name || ''}</td>
                              <td className="px-4 py-3 text-center text-slate-700">{item.weight || 0}%</td>
                              <td className="px-4 py-3 text-center font-medium text-slate-600">{item.assigned_level || ''}</td>
                              <td className="px-4 py-3 text-center font-semibold text-slate-600">{((item.weight/100) * item.assigned_level).toFixed(2)}</td>
                              <td className="px-4 py-3 text-slate-700 text-xs">{item.justification || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : employeeActivity.length === 0 ? (
              <p className="text-sm text-gray-600">You don&apos;t have any competency leveling activity yet.</p>
              ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>CL ID</Th>
                      <Th>Cycle</Th>
                      <Th>Status</Th>
                      <Th>Employee Decision</Th>
                      <Th>Employee Decided At</Th>
                      <Th>Total Score</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employeeActivity.map((cl) => (
                      <tr key={cl.id} className="hover:bg-gray-50">
                        <Td>{cl.id}</Td>
                        <Td>{cl.cycle_name || cl.cycle_id || '-'}</Td>
                        <Td>{displayStatus(cl.status) || '-'}</Td>
                        <Td>{cl.employee_decision || '-'}</Td>
                        <Td>{cl.employee_decided_at ? new Date(cl.employee_decided_at).toLocaleString() : '-'}</Td>
                        <Td>{cl.total_score != null ? cl.total_score : '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

          {activeView === 'tracking' && (
            <section>
              <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <ChartBarIcon className="w-6 h-6 text-emerald-600" />
                  CL & IDP Tracking
                </h2>
                <p className="text-sm text-slate-600">View all your competency leveling and IDP records</p>
              </div>

              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-600" />
                    All CLs
                  </h3>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                    {clHistory.length} Total
                  </span>
                </div>
                {clHistory && clHistory.length > 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <Th>CL #</Th>
                            <Th>Cycle</Th>
                            <Th>Status</Th>
                            <Th>Submitted</Th>
                            <Th>Actions</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {clHistory.map(cl => (
                            <tr key={cl.id} className="hover:bg-slate-50 transition">
                              <Td>
                                <span className="font-semibold text-slate-900">#{cl.id}</span>
                              </Td>
                              <Td>{cl.cycle_name || cl.cycle_id || '-'}</Td>
                              <Td>
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                  {displayStatus(cl.status)}
                                </span>
                              </Td>
                              <Td>
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <ClockIcon className="w-4 h-4" />
                                  {cl.created_at ? new Date(cl.created_at).toLocaleString() : '-'}
                                </div>
                              </Td>
                              <Td>
                                <button
                                  onClick={() => goTo(`/cl/employee/review/${cl.id}`)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm hover:shadow transition"
                                >
                                  <DocumentTextIcon className="w-4 h-4" />
                                  View
                                </button>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <ClipboardDocumentCheckIcon className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium mb-1">No CL Records Yet</p>
                    <p className="text-sm text-slate-500">Your competency leveling records will appear here.</p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <DocumentTextIcon className="w-5 h-5 text-purple-600" />
                    All IDPs
                  </h3>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                    {employeeIDPs.length} Total
                  </span>
                </div>
                {employeeIDPs && employeeIDPs.length > 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <Th>IDP #</Th>
                            <Th>Supervisor</Th>
                            <Th>Status</Th>
                            <Th>Submitted</Th>
                            <Th>Actions</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {employeeIDPs.map(h => (
                            <tr key={h.id} className="hover:bg-slate-50 transition">
                              <Td>
                                <span className="font-semibold text-slate-900">#{h.id}</span>
                              </Td>
                              <Td>{h.supervisor_name || h.supervisor_id || '-'}</Td>
                              <Td>
                                <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                                  {displayStatus(h.status)}
                                </span>
                              </Td>
                              <Td>
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <ClockIcon className="w-4 h-4" />
                                  {h.created_at ? new Date(h.created_at).toLocaleString() : '-'}
                                </div>
                              </Td>
                              <Td>
                                <button
                                  onClick={() => goTo(`/employee/idp/view/${h.id}`)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 shadow-sm hover:shadow transition"
                                >
                                  <DocumentTextIcon className="w-4 h-4" />
                                  View
                                </button>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <DocumentTextIcon className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium mb-1">No IDP Records Yet</p>
                    <p className="text-sm text-slate-500">Your individual development plan records will appear here.</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* RIGHT SIDEBAR - Notifications & Recent Actions */}
      <aside className="w-72 bg-white border-l border-slate-200 flex flex-col">
        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={() => setShowFullNotifications(true)}
              className="w-full flex items-center justify-between hover:bg-slate-50 transition text-left rounded px-2 py-1 -mx-2 mb-3"
            >
              <div className="flex items-center gap-2">
                <BellIcon className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-semibold text-slate-700">Notifications</span>
                <ArrowsPointingOutIcon className="w-4 h-4 text-slate-400" />
              </div>
              {unreadCount > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500 text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="mt-2 w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition text-center mb-3"
              >
                Mark All as Read
              </button>
            )}
            {/* Filter buttons */}
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'CL', 'IDP'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setNotificationFilter(filter)}
                  className={`px-3 py-1 text-xs rounded-full font-semibold transition ${
                    notificationFilter === filter
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-2 no-scrollbar">
            {filteredNotifications.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No notifications.</p>
            ) : (
              filteredNotifications.map((n, idx) => {
                const isUnread = String(n.status || '').toLowerCase() === 'unread';
                return (
                  <button
                    key={`${n.id}-${idx}`}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                      isUnread ? 'bg-orange-50 hover:bg-orange-100' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <p className="flex-1 font-medium text-slate-800 whitespace-pre-wrap">
                        {n.message || n.title || 'Notification'}
                      </p>
                      {n.module && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          n.module === 'CL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {n.module}
                        </span>
                      )}
                    </div>
                    {n.created_at && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-slate-200" />

        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={() => setShowFullRecentActions(true)}
              className="w-full flex items-center justify-between hover:bg-slate-50 transition text-left rounded px-2 py-1 -mx-2 mb-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">Recent Actions</span>
                <ArrowsPointingOutIcon className="w-4 h-4 text-slate-400" />
              </div>
              {filteredRecentActions.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white">
                  {filteredRecentActions.length}
                </span>
              )}
            </button>
            {/* Filter buttons */}
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'CL', 'IDP'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setRecentActionFilter(filter)}
                  className={`px-3 py-1 text-xs rounded-full font-semibold transition ${
                    recentActionFilter === filter
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-2 overflow-y-auto no-scrollbar">
            {filteredRecentActions.length === 0 ? (
              <p className="text-xs text-slate-400 italic px-2">No recent actions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-semibold text-slate-600">Action</th>
                      <th className="px-2 py-1 text-left font-semibold text-slate-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecentActions.slice(0, 10).map((a, idx) => (
                      <tr
                        key={`${a.id}-${idx}`}
                        onClick={() => handleRecentActionClick(a)}
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <p className="font-medium text-slate-800 truncate">{a.title || 'Action'}</p>
                            {a.module && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                                a.module === 'CL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {a.module}
                              </span>
                            )}
                          </div>
                          {a.description && (
                            <p className="text-slate-600 truncate text-[11px]">{a.description}</p>
                          )}
                        </td>
                        <td className="px-2 py-2 text-slate-500 whitespace-nowrap">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </aside>

      <NotificationModal
        open={notificationModalState.open}
        notification={notificationModalState.notification}
        onProceed={() => proceedToNotificationLink(notificationModalState.notification)}
        onClose={closeNotificationModal}
      />

      <FullRecentActionsModal
        open={showFullRecentActions}
        recentActions={recentActions}
        onActionClick={handleRecentActionClick}
        onClose={() => setShowFullRecentActions(false)}
      />

      <FullNotificationsModal
        open={showFullNotifications}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onMarkAllRead={handleMarkAllAsRead}
        onClose={() => setShowFullNotifications(false)}
      />
    </div>
  );
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

function NotificationModal({ open, notification, onProceed, onClose }) {
  if (!open || !notification) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Notification Details</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Message</p>
            <p className="text-sm text-slate-800 mt-1">
              {notification.message || notification.title || 'No message'}
            </p>
          </div>
          {notification.module && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Module</p>
              <p className="text-sm text-slate-800 mt-1">{notification.module}</p>
            </div>
          )}
          {notification.created_at && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Time</p>
              <p className="text-sm text-slate-800 mt-1">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Status</p>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              String(notification.status || '').toLowerCase() === 'unread'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-slate-100 text-slate-800'
            }`}>
              {notification.status || 'Unknown'}
            </span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Go to Form
          </button>
        </div>
      </div>
    </div>
  );
}

function FullRecentActionsModal({ open, recentActions, onActionClick, onClose }) {
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [searchTerm, setSearchTerm] = useState('');

  if (!open) return null;

  // Filter actions by date range and search term
  const filteredActions = recentActions.filter(a => {
    // Date filtering
    if (a.created_at) {
      const actionDate = new Date(a.created_at);
      const start = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
      const end = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
      
      if (start && actionDate < start) return false;
      if (end) {
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (actionDate > endOfDay) return false;
      }
    }
    
    // Search term filtering (search in title, description)
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      const matchTitle = (a.title || '').toLowerCase().includes(search);
      const matchDescription = (a.description || '').toLowerCase().includes(search);
      if (!matchTitle && !matchDescription) return false;
    }
    
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Recent Actions</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Date Filter */}
          <div className="space-y-3">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  setDateFilter({ startDate: '', endDate: '' });
                  setSearchTerm('');
                }}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
              >
                Clear
              </button>
            </div>
            
            {/* Search by Employee Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Search Employee Name</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by employee name..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {filteredActions.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No recent actions found.</p>
          ) : (
            <div className="bg-white shadow rounded overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Action</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredActions.map((a, idx) => (
                    <tr
                      key={`${a.id}-${idx}`}
                      onClick={() => {
                        onActionClick(a);
                        if (!a.title || !a.title.toLowerCase().includes('deleted')) {
                          onClose();
                        }
                      }}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-gray-800 font-medium">{a.title || 'Action'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.description || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {a.created_at ? new Date(a.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FullNotificationsModal({ open, notifications, onNotificationClick, onClose, onMarkAllRead }) {
  if (!open) return null;

  const unreadCount = notifications.filter(n => String(n.status || '').toLowerCase() === 'unread').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold text-gray-800">All Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  onMarkAllRead();
                }}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                Mark All as Read ({unreadCount})
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {notifications.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No notifications found.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n, idx) => {
                const isUnread = String(n.status || '').toLowerCase() === 'unread';
                return (
                  <button
                    key={`${n.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      onNotificationClick(n);
                      onClose();
                    }}
                    className={`w-full text-left p-4 rounded-lg border border-gray-200
                               transition shadow-sm hover:shadow ${
                                 isUnread ? 'bg-orange-50 hover:bg-orange-100' : 'bg-white hover:bg-gray-50'
                               }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 mb-1">
                          {n.message || n.title || 'Notification'}
                        </p>
                        {n.module && (
                          <p className="text-sm text-gray-600 mb-2">Module: {n.module}</p>
                        )}
                        {n.created_at && (
                          <p className="text-xs text-gray-400">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {isUnread && (
                        <span className="ml-4 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                          Unread
                        </span>
                      )}
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

// Profile modal for viewing complete employee information
function ProfileModal({ open, userData, loading, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-50 bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Employee Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading profile…</p>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold">Basic Information</h4>
                <div className="space-y-2 mt-2 text-sm">
                  <div className="flex justify-between">
                    <div className="text-slate-600">Name:</div>
                    <div className="font-medium text-right">{userData?.name || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Employee ID:</div>
                    <div className="font-medium text-right">{userData?.employee_id || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Email:</div>
                    <div className="font-medium text-right">{userData?.email || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Position:</div>
                    <div className="font-medium text-right">{userData?.position_title || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Department:</div>
                    <div className="font-medium text-right">{userData?.department_name || '-'}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-slate-600">Supervisor:</div>
                    <div className="font-medium text-right">{userData?.supervisor_name || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Past competencies moved to sidebar */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeDashboard;
