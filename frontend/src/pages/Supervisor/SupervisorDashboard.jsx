// src/pages/Supervisor/SupervisorDashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api/client';
import {
  ClipboardDocumentCheckIcon,
  BookOpenIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  Squares2X2Icon,
  ClockIcon,
  UserIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';

import '../../index.css';
import '../../App.css';
import SupervisorCL from './SupervisorCL';
import SupervisorIDP from './SupervisorIDP';

const SCORING_GUIDE = [
  { score: 5, description: 'Exceptional & Completed: Exceeded expectations, demonstrated mastery beyond the target level. Project/activity is completed, and impact is notable.', status: 'Completed & Exceeded Competency' },
  { score: 4, description: 'Advanced & Completed: Fully met expectations with proficiency at or slightly above the target level. The project/activity is fully completed.', status: 'Completed & Above Target Expectation' },
  { score: 3, description: 'Proficient & Completed: Met most expectations, demonstrated proficiency at the target level. The project/activity is fully completed.', status: 'Completed & Met Expectations' },
  { score: 2, description: 'Developing & Incomplete: Some progress made, but competency is below the target level. The project/activity is incomplete or partially completed.', status: 'In Progress (50-79% Completed)' },
  { score: 1, description: 'Basic & Not Started: Little to no progress in competency development. The project/activity is not started or significantly behind schedule.', status: 'Not Started/In Progress (<50%)' }
];

const DEVELOPMENT_TYPES = ['Education', 'Experience', 'Exposure'];

function SupervisorDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [summary, setSummary] = useState({
    clPending: 0,
    clApproved: 0,
    clReturned: 0,
  });

  const [idpSummary, setIdpSummary] = useState({
    idpCreation: 0,
    idpPending: 0,
    idpApproved: 0,
    idpReturned: 0,
  });

  const [clByStatus, setClByStatus] = useState({});
  const [idpEmployees, setIdpEmployees] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recentActions, setRecentActions] = useState([]);

  const [activePage, setActivePage] = useState('CL'); // 'CL' or 'IDP'
  const [activeSection, setActiveSection] = useState('ALL');
  const [showFullRecentActions, setShowFullRecentActions] = useState(false);
  const [showFullNotifications, setShowFullNotifications] = useState(false);

  const [modalState, setModalState] = useState({
    open: false,
    title: '',
    message: '',
    showCancel: false,
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: null,
  });

  const [notificationModalState, setNotificationModalState] = useState({
    open: false,
    notification: null,
  });

  // IDP Creation Modal State
  const [idpModalState, setIdpModalState] = useState({
    open: false,
    employee: null,
    loading: false,
    saving: false,
    error: '',
    competencies: [],
    idpData: {
      reviewPeriod: '1st Cycle Performance Review',
      nextReviewDate: new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0],
      items: []
    }
  });



  const [department, setDepartment] = useState(null);

  // Dynamically build CL status sections based on department.has_am
  const CL_STATUS_SECTIONS = useMemo(() => {
    const sections = [
      { key: 'DRAFT', label: 'Returned for Review', icon: PencilSquareIcon },
      { key: 'PENDING_EMPLOYEE', label: 'For Approval by Employee', icon: UserIcon },
      { key: 'PENDING_HR', label: 'For Approval by HR', icon: BriefcaseIcon },
    ];
    if (department && department.has_am) {
      sections.push({ key: 'PENDING_AM', label: 'For Approval by Assistant Manager', icon: ClockIcon });
    }
    sections.push({ key: 'PENDING_MANAGER', label: 'For Approval by Manager', icon: ClockIcon });
    sections.push({ key: 'APPROVED', label: 'Approved', icon: CheckCircleIcon });
    return sections;
  }, [department]);

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

    setUser(parsed);

    // Fetch department info for the user
    async function fetchDepartment() {
      try {
        const departments = await apiRequest('/api/lookup/departments');
        const dept = departments.find((d) => d.id === parsed.department_id);
        setDepartment(dept || null);
      } catch {
        setDepartment(null);
      }
    }
    fetchDepartment();
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadDashboard() {
      try {
        const [clSummary, clGrouped, idpData] = await Promise.all([
          apiRequest('/api/cl/supervisor/summary'),
          apiRequest('/api/cl/supervisor/all'),
          apiRequest('/api/idp/supervisor/for-creation'),
        ]);

        setSummary({
          clPending: clSummary.clPending || 0,
          clApproved: clSummary.clApproved || 0,
          clReturned: clSummary.clInProgress || 0,
        });

        setClByStatus(clGrouped || {});
        
        // Set IDP employees and summary
        setIdpEmployees(idpData || []);
        setIdpSummary({
          idpCreation: (idpData || []).length,
          idpPending: 0,
          idpApproved: 0,
          idpReturned: 0,
        });
      } catch (err) {
        console.error(err);
        setError('Failed to load Supervisor dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user]);

  // Notifications (polling)
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

  // Recent actions
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

  function logout() {
    localStorage.clear();
    window.location.href = '/login';
  }

  function goTo(url) {
    const currentPath = window.location.pathname;
    const targetPath = url.split('?')[0];
    
    // If already on the target page, just reload data instead of full refresh
    if (currentPath === targetPath) {
      window.location.reload();
      return;
    }
    
    window.location.href = url;
  }

  function openModal(options) {
    setModalState({
      open: true,
      title: options.title || '',
      message: options.message || '',
      showCancel: options.showCancel || false,
      confirmText: options.confirmText || (options.showCancel ? 'Confirm' : 'OK'),
      cancelText: options.cancelText || 'Cancel',
      onConfirm: options.onConfirm || null,
    });
  }

  function closeModal() {
    setModalState((prev) => ({
      ...prev,
      open: false,
      onConfirm: null,
      showCancel: false,
    }));
  }

  async function handleModalConfirm() {
    const fn = modalState.onConfirm;
    closeModal();
    if (fn) await fn();
  }

  async function handleDeleteCL(clId) {
    openModal({
      title: 'Delete CL',
      message: 'Are you sure you want to delete this CL? This action cannot be undone. All associated data will be permanently removed.',
      showCancel: true,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await apiRequest(`/api/cl/${clId}`, { method: 'DELETE' });
          openModal({
            title: 'Deleted',
            message: 'CL deleted successfully. The action has been logged in your Recent Actions.',
            showCancel: false,
            confirmText: 'OK',
            onConfirm: () => window.location.reload(),
          });
        } catch (err) {
          console.error(err);
          openModal({
            title: 'Error',
            message: err.message || 'Failed to delete CL.',
            showCancel: false,
            confirmText: 'OK',
          });
        }
      },
    });
  }

  async function handleNotificationClick(n) {
    // Mark notification as read
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/notifications/${n.id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  async function handleRecentActionClick(action) {
    // If action is a deletion, show when it was deleted
    if (action.title && action.title.toLowerCase().includes('deleted')) {
      openModal({
        title: 'Recent Action Details',
        message: `${action.title}\n\n${action.description || ''}\n\nDeleted at: ${new Date(action.created_at).toLocaleString()}`,
        showCancel: false,
        confirmText: 'OK',
      });
      return;
    }
    
    // Check if we're staying on the same page
    const url = action.url || '/supervisor';
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
    const url = n?.url || '/supervisor';
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

  async function openIDPModal(employee) {
    try {
      setIdpModalState(prev => ({ ...prev, loading: true, error: '', employee }));
      
      // Fetch the approved CL details which contains the competency levels
      console.log('Fetching CL for employee:', employee);
      const clResponse = await apiRequest(`/api/cl/${employee.cl_id}`);
      console.log('CL Response:', clResponse);
      
      if (clResponse && clResponse.items && clResponse.items.length > 0) {
        console.log('Found competencies:', clResponse.items);
        
        // Convert CL items to IDP items
        const idpItems = clResponse.items.map(item => ({
          competencyId: item.competency_id,
          competencyName: item.competency_name,
          competencyArea: item.competency_area, // ✅ ADD THIS
          currentLevel: item.assigned_level || item.self_rating || 1,
          targetLevel: Math.min((item.assigned_level || item.self_rating || 1) + 1, 5),
          developmentActivities: []
        }));
        
        setIdpModalState(prev => ({ 
          ...prev, 
          open: true, 
          loading: false,
          competencies: clResponse.items || [],
          idpData: {
            ...prev.idpData,
            items: idpItems
          }
        }));
      } else {
        console.log('No competencies found in response');
        setIdpModalState(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'No approved competencies found for this employee.',
          open: true,
          competencies: []
        }));
      }
    } catch (error) {
      console.error('Error loading employee competencies:', error);
      setIdpModalState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to load employee competencies. Please try again.',
        open: true
      }));
    }
  }

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(
      (n) => String(n.status || '').toLowerCase() === 'unread'
    ).length;
  }, [notifications]);

  const sectionCounts = useMemo(() => {
    const counts = { ALL: 0 };
    for (const s of CL_STATUS_SECTIONS) {
      counts[s.key] = (clByStatus?.[s.key] || []).length;
      counts.ALL += counts[s.key];
    }
    return counts;
  }, [clByStatus, CL_STATUS_SECTIONS]);

  const activeLabel = useMemo(() => {
    if (activeSection === 'ALL') return 'All Competency Levelings';
    const s = CL_STATUS_SECTIONS.find((x) => x.key === activeSection);
    return s ? s.label : 'All Competency Levelings';
  }, [activeSection, CL_STATUS_SECTIONS]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white">
      {/* LEFT SIDEBAR */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">FUTURA</h2>
          <p className="text-sm text-gray-500">{user.role}</p>
        </div>

        <nav className="p-4 space-y-4 overflow-y-auto">
          {/* Competency Leveling */}
          <div className="space-y-1">
            <button
              onClick={() => setActivePage('CL')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded transition
                ${activePage === 'CL' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-600" />
              <span>Competency Leveling</span>
            </button>

            {/* ✅ REPLACE THE "Start" SLOT WITH OPTIONS */}
            <div className="pr-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2 px-3">
                CL Sections
              </p>

            <button
              type="button"
              onClick={() => setActiveSection('ALL')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                ${activeSection === 'ALL' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <span className="flex items-center gap-2">
                <Squares2X2Icon className="w-4 h-4" />
                All
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {sectionCounts.ALL || 0}
              </span>
            </button>

            <div className="mt-1 space-y-1">
              {CL_STATUS_SECTIONS.map(({ key, label, icon }) => {
                const Icon = icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveSection(key)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition
                      ${activeSection === key ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {label}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {sectionCounts[key] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Keep Start button, but place it AFTER the options */}
            <button
              onClick={() => goTo('/cl/start')}
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded
                         text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
            >
              <span>➤ Start Competency Leveling</span>
            </button>
            </div>
          </div>

          {/* IDP */}
          <button
            onClick={() => setActivePage('IDP')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded transition
              ${activePage === 'IDP' ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <BookOpenIcon className="w-5 h-5 text-green-600" />
            <span>IDP Leveling</span>
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {activePage === 'CL' ? 'Competency Levelling' : 'IDP Leveling'}
            </h1>
            <p className="text-gray-600">
              Welcome, {user.name} ({user.employee_id})
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded bg-red-600 text-white
                         text-sm hover:bg-red-700 transition"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {error && <div className="text-red-600 mb-4">{error}</div>}
        
        {activePage === 'CL' && (
          <SupervisorCL
            loading={loading}
            summary={summary}
            activeLabel={activeLabel}
            activeSection={activeSection}
            CL_STATUS_SECTIONS={CL_STATUS_SECTIONS}
            sectionCounts={sectionCounts}
            clByStatus={clByStatus}
            handleDeleteCL={handleDeleteCL}
            goTo={goTo}
            setActiveSection={setActiveSection}
          />
        )}

        {activePage === 'IDP' && (
          <SupervisorIDP
            idpSummary={idpSummary}
            idpEmployees={idpEmployees}
            openIDPModal={openIDPModal}
          />
        )}
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="w-56 bg-white border-l border-gray-200 flex flex-col">
        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <button
            onClick={() => setShowFullNotifications(true)}
            className="p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition text-left"
          >
            <div className="flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-semibold text-gray-700">Notifications</span>
              <ArrowsPointingOutIcon className="w-4 h-4 text-gray-400" />
            </div>

            {unreadCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500 text-white">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="flex-1 p-4 overflow-y-auto space-y-2 no-scrollbar">
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No notifications.</p>
            ) : (
              notifications.map((n, idx) => {
                const isUnread = String(n.status || '').toLowerCase() === 'unread';
                return (
                  <button
                    key={`${n.id}-${idx}`}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                      isUnread ? 'bg-orange-50 hover:bg-orange-100' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-medium text-gray-800 whitespace-pre-wrap">
                      {n.message || n.title || 'Notification'}
                    </p>
                    {n.created_at && (
                      <p className="text-[11px] text-gray-400">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <div className="flex flex-col min-h-0" style={{ height: '50%' }}>
          <button
            onClick={() => setShowFullRecentActions(true)}
            className="p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Recent Actions</span>
              <ArrowsPointingOutIcon className="w-4 h-4 text-gray-400" />
            </div>
            {recentActions.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500 text-white">
                {recentActions.length}
              </span>
            )}
          </button>

          <div className="flex-1 p-2 overflow-y-auto no-scrollbar">
            {recentActions.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-2">No recent actions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-semibold text-gray-600">Action</th>
                      <th className="px-2 py-1 text-left font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActions.slice(0, 10).map((a, idx) => (
                      <tr
                        key={`${a.id}-${idx}`}
                        onClick={() => handleRecentActionClick(a)}
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-2 py-2">
                          <p className="font-medium text-gray-800 truncate">{a.title || 'Action'}</p>
                          {a.description && (
                            <p className="text-gray-600 truncate text-[11px]">{a.description}</p>
                          )}
                        </td>
                        <td className="px-2 py-2 text-gray-500 whitespace-nowrap">
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

      <Modal
        open={modalState.open}
        title={modalState.title}
        message={modalState.message}
        showCancel={modalState.showCancel}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={handleModalConfirm}
        onClose={closeModal}
      />

      <NotificationModal
        open={notificationModalState.open}
        notification={notificationModalState.notification}
        onProceed={() => proceedToNotificationLink(notificationModalState.notification)}
        onClose={closeNotificationModal}
      />

      {/* IDP Creation Modal */}
      <IDPCreationModal
        isOpen={idpModalState.open}
        employee={idpModalState.employee}

        idpData={idpModalState.idpData}
        loading={idpModalState.loading}
        saving={idpModalState.saving}
        error={idpModalState.error}
        onClose={() => setIdpModalState(prev => ({ ...prev, open: false }))}
        onSave={async (idpPayload) => {
          try {
            setIdpModalState(prev => ({ ...prev, saving: true, error: '' }));
            
            await apiRequest('/api/idp/create', {
              method: 'POST',
              body: JSON.stringify({
                employeeId: idpModalState.employee?.id,
                supervisorId: user.id,
                reviewPeriod: idpPayload.reviewPeriod,
                nextReviewDate: idpPayload.nextReviewDate,
                items: idpPayload.items
              })
            });
            
            setIdpModalState(prev => ({ ...prev, open: false, saving: false }));
            openModal({
              title: 'Success',
              message: 'IDP created successfully!',
              showCancel: false,
              confirmText: 'OK',
            });
            
            // Reload IDP employees list
            const idpData = await apiRequest('/api/idp/supervisor/for-creation');
            setIdpEmployees(idpData || []);
            
          } catch (err) {
            console.error('Failed to create IDP:', err);
            setIdpModalState(prev => ({ 
              ...prev, 
              saving: false, 
              error: 'Failed to create IDP. Please try again.' 
            }));
          }
        }}
        onUpdateIdpData={(path, value) => {
          setIdpModalState(prev => {
            const newData = { ...prev.idpData };
            const pathArray = path.split('.');
            let current = newData;
            
            for (let i = 0; i < pathArray.length - 1; i++) {
              if (!current[pathArray[i]]) {
                current[pathArray[i]] = {};
              }
              current = current[pathArray[i]];
            }
            
            current[pathArray[pathArray.length - 1]] = value;
            return { ...prev, idpData: newData };
          });
        }}
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
        onClose={() => setShowFullNotifications(false)}
      />
    </div>
  );
}

/* COMPONENTS */

function SummaryCard({ label, value, gradientClass }) {
  return (
    <div className={`p-4 rounded shadow-md bg-gradient-to-r ${gradientClass}`}>
      <h3 className="text-sm text-white/80">{label}</h3>
      <p className="text-3xl font-semibold text-white mt-1">{value}</p>
    </div>
  );
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
              <Td>
                {item.status === 'DRAFT' 
                  ? (item.awaiting_approval_from 
                      ? `Returned from ${item.awaiting_approval_from.replace('PENDING_', '').replace(/_/g, ' ')}` 
                      : 'Draft - Not Submitted')
                  : item.status}
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

function Th({ children }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="px-4 py-2 text-gray-700">{children}</td>;
}

function Modal({
  open,
  title,
  message,
  showCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-700 whitespace-pre-line">{message}</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          {showCancel && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationModal({ open, notification, onProceed, onClose }) {
  if (!open || !notification) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Notification Details</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Message</p>
            <p className="text-sm text-gray-800 mt-1">
              {notification.message || notification.title || 'No message'}
            </p>
          </div>
          {notification.module && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Module</p>
              <p className="text-sm text-gray-800 mt-1">{notification.module}</p>
            </div>
          )}
          {notification.created_at && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Time</p>
              <p className="text-sm text-gray-800 mt-1">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              String(notification.status || '').toLowerCase() === 'unread'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {notification.status || 'Unknown'}
            </span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
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

function FullNotificationsModal({ open, notifications, onNotificationClick, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-800">All Notifications</h3>
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

// IDP Creation Modal Component
function IDPCreationModal({ 
  isOpen, 
  employee, 
  // ...existing code...
  idpData, 
  loading, 
  saving, 
  error,
  onClose, 
  onSave,
  onUpdateIdpData
}) {
  const [showScoringGuide, setShowScoringGuide] = useState(false);

  const addDevelopmentActivity = (itemIndex) => {
    const newItems = [...idpData.items];
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
    onUpdateIdpData('items', newItems);
  };

  const removeDevelopmentActivity = (itemIndex, activityIndex) => {
    const newItems = [...idpData.items];
    newItems[itemIndex].developmentActivities.splice(activityIndex, 1);
    onUpdateIdpData('items', newItems);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white text-black">
      <div className="w-full h-full overflow-y-auto">
        <div className="p-4 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 p-4 rounded-md bg-black">
            <h2 className="text-lg font-semibold text-white">Create Individual Development Plan (IDP)</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowScoringGuide(!showScoringGuide)}
                className="bg-gray-800 text-white text-xs font-bold px-3 py-2 rounded-full hover:bg-gray-700"
              >
                {showScoringGuide ? 'Hide' : 'Show'} Scoring Guide
              </button>
              <button
                onClick={onClose}
                className="bg-gray-300 text-black text-xl font-bold px-3 py-2 rounded-full hover:bg-gray-400"
              >
                ✕
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3 p-3 rounded-md bg-gray-100">
              <p className="text-black font-bold text-sm">⚠️ {error} ⚠️</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-4 p-6 rounded-3xl bg-gray-100">
              <div className="animate-spin rounded-full h-6 w-6 border-b-4 mx-auto border-gray-400"></div>
              <p className="mt-1 text-black text-sm font-bold">Loading competencies...</p>
            </div>
          ) : (
            <>
              {/* Scoring Guide */}
              {showScoringGuide && (
                <div className="mb-4 bg-white p-3 rounded-md">
                  <h3 className="font-medium mb-2 text-sm text-black">Scoring Guide for IDP Completion and Competency Mastery</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border">
                      <thead className="bg-white border-b">
                        <tr>
                          <th className="px-2 py-1 border text-left">Score</th>
                          <th className="px-2 py-1 border text-left">Description</th>
                          <th className="px-2 py-1 border text-left">Completion Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SCORING_GUIDE.map((guide) => (
                          <tr key={guide.score}>
                            <td className="px-2 py-1 border font-semibold">{guide.score}</td>
                            <td className="px-2 py-1 border">{guide.description}</td>
                            <td className="px-2 py-1 border">{guide.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Employee Information */}
              <div className="mb-4 p-3 rounded-md bg-white">
                <h3 className="font-medium mb-2 text-sm text-black">Employee Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-black">Name</label>
                    <p className="font-bold text-black">{employee?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block font-medium text-black">Position</label>
                    <p className="font-bold text-black">{employee?.position || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block font-medium text-black">Department</label>
                    <p className="font-bold text-black">{employee?.department || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block font-medium text-black">Date Created</label>
                    <p className="font-bold text-black">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Review Period</label>
                    <input
                      type="text"
                      value={idpData.reviewPeriod}
                      onChange={(e) => onUpdateIdpData('reviewPeriod', e.target.value)}
                      className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black border bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">Next Review Date</label>
                    <input
                      type="date"
                      value={idpData.nextReviewDate}
                      onChange={(e) => onUpdateIdpData('nextReviewDate', e.target.value)}
                      className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black border bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Development Plan */}
              <div className="mb-4">
                <h3 className="font-medium mb-2 text-sm text-black p-3 rounded-md text-center bg-gray-100">Development Plan</h3>
                {idpData.items.length === 0 ? (
                  <div className="text-center py-4 text-black p-6 rounded-3xl bg-gray-100">
                    <p className="text-sm font-bold">No approved competencies found for this employee.</p>
                    <p className="text-xs font-bold">Employee must have approved CL competencies before creating IDP.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {idpData.items.map((item, itemIndex) => {
                      return (
                        <div key={item.competencyId} className="p-3 rounded-md mb-3 bg-white">
                          <div className="grid grid-cols-4 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-black mb-1">Development Area</label>
                              <input
                                type="text"
                                value={item.competencyArea || '[No competency_area]'}
                                readOnly
                                className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-black mb-1">Competency</label>
                              <input
                                type="text"
                                value={item.competencyName}
                                readOnly
                                className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-black mb-1">Current Level</label>
                              <input
                                type="number"
                                value={item.currentLevel}
                                readOnly
                                className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-black mb-1">Target Level</label>
                              <input
                                type="number"
                                value={item.targetLevel}
                                readOnly
                                className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                              />
                            </div>
                          </div>
                          {/* Development Activities */}
                          <div className="space-y-3 mt-3">
                            <div className="flex justify-between items-center">
                              <h4 className="font-medium text-black">Development Activities</h4>
                              <button
                                onClick={() => addDevelopmentActivity(itemIndex)}
                                className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-full hover:bg-gray-700"
                              >
                                Add Activity
                              </button>
                            </div>
                            {item.developmentActivities && item.developmentActivities.map((activity, activityIndex) => (
                              <div key={activityIndex} className="p-3 rounded-md bg-gray-50">
                                <div className="flex justify-end mb-2">
                                  {item.developmentActivities.length > 1 && (
                                    <button
                                      onClick={() => removeDevelopmentActivity(itemIndex, activityIndex)}
                                      className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full hover:bg-red-800"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-black mb-1">Type</label>
                                    <select
                                      value={activity.type}
                                      onChange={(e) => onUpdateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.type`, e.target.value)}
                                      className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                                    >
                                      {DEVELOPMENT_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-black mb-1">Target Date</label>
                                    <input
                                      type="date"
                                      value={activity.targetCompletionDate}
                                      onChange={(e) => onUpdateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.targetCompletionDate`, e.target.value)}
                                      className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-black mb-1">Score</label>
                                    <select
                                      value={activity.score}
                                      onChange={(e) => onUpdateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.score`, parseInt(e.target.value))}
                                      className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                                    >
                                      {[1,2,3,4,5].map(score => (
                                        <option key={score} value={score}>{score}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="mt-3 space-y-2">
                                  <div>
                                    <label className="block text-xs font-medium text-black mb-1">Development Activity</label>
                                    <textarea
                                      value={activity.activity}
                                      onChange={(e) => onUpdateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.activity`, e.target.value)}
                                      rows={2}
                                      className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                                      placeholder="Describe the development activity..."
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-black mb-1">Expected Results</label>
                                    <textarea
                                      value={activity.expectedResults}
                                      onChange={(e) => onUpdateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.expectedResults`, e.target.value)}
                                      rows={2}
                                      className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                                      placeholder="What new skills or knowledge will you gain?"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-black mb-1">Knowledge Sharing</label>
                                    <textarea
                                      value={activity.sharingMethod}
                                      onChange={(e) => onUpdateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.sharingMethod`, e.target.value)}
                                      rows={2}
                                      className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                                      placeholder="How will you share knowledge with team members?"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-black mb-1">Application Method</label>
                                    <textarea
                                      value={activity.applicationMethod}
                                      onChange={(e) => onUpdateIdpData(`items.${itemIndex}.developmentActivities.${activityIndex}.applicationMethod`, e.target.value)}
                                      rows={2}
                                      className="w-full px-2 py-1 rounded-xl text-xs font-bold text-black bg-gray-100"
                                      placeholder="How will you apply the learning to improve work performance?"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 rounded-2xl font-bold bg-gray-300 text-black hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onSave(idpData)}
                  disabled={saving || idpData.items.length === 0}
                  className="px-4 py-2 rounded-2xl font-bold bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create IDP'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupervisorDashboard;
