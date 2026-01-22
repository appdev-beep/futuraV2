// src/pages/HR/HREmployeeManagement.jsx
import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import Modal from '../../components/Modal';

function HREmployeeManagement() {
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [role, setRole] = useState('Employee');
  const [password, setPassword] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [amId, setAmId] = useState('');

  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [managers, setManagers] = useState([]);
  const [ams, setAms] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // NEW: users list state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });

  // UI state
  const [activeView, setActiveView] = useState('table'); // 'table' or 'form'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type, isConfirm: false, onConfirm: null });
  };

  const showConfirmModal = (title, message, onConfirm) => {
    setModal({ isOpen: true, title, message, type: 'warning', isConfirm: true, onConfirm });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });
  };

  // Check that current user is HR only
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      window.location.href = '/login';
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== 'HR') {
      showModal('Access Denied', 'Only HR can access this page.', 'error');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }
  }, []);

  // Helper: load users
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const data = await apiRequest('/api/users', { method: 'GET' });
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError((prev) => prev || 'Failed to load users.');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load departments, positions, and users
  useEffect(() => {
    async function loadLookups() {
      try {
        const [deps, pos] = await Promise.all([
          apiRequest('/api/lookup/departments', { method: 'GET' }),
          apiRequest('/api/lookup/positions', { method: 'GET' })
        ]);
        setDepartments(deps);
        setPositions(pos);
      } catch (err) {
        console.error(err);
        setError('Failed to load lookups. Check your backend /lookup routes.');
      }
    }

    loadLookups();
    fetchUsers();
  }, []);

  // When department changes, reset selected position and hierarchy
  function handleDepartmentChange(e) {
    const value = e.target.value;
    setDepartmentId(value);
    setPositionId('');
    setSupervisorId('');
    setManagerId('');
    setAmId('');
    
    // Load department-specific users
    if (value) {
      loadDepartmentUsers(value);
    }
  }

  // Load department-specific users
  const loadDepartmentUsers = async (departmentId) => {
    try {
      const [supervisorsData, managersData, amsData] = await Promise.all([
        apiRequest(`/api/lookup/supervisors/${departmentId}`, { method: 'GET' }),
        apiRequest(`/api/lookup/managers/${departmentId}`, { method: 'GET' }),
        apiRequest(`/api/lookup/ams/${departmentId}`, { method: 'GET' })
      ]);
      setSupervisors(supervisorsData);
      setManagers(managersData);
      setAms(amsData);
    } catch (err) {
      console.error('Failed to load department users:', err);
    }
  };

  // Filter positions based on selected department
  const filteredPositions = departmentId
    ? positions.filter((p) => String(p.department_id) === String(departmentId))
    : [];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const body = {
        employee_id: employeeId,
        name,
        email,
        position_id: Number(positionId),
        department_id: Number(departmentId),
        role,
        supervisor_id: supervisorId ? Number(supervisorId) : null,
        manager_id: managerId ? Number(managerId) : null,
        am_id: amId ? Number(amId) : null
      };

      if (editingUser) {
        // Update existing employee
        if (password) {
          body.password = password;
        }
        
        await apiRequest(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
        
        setMessage(`Employee "${name}" was updated successfully`);
        setEditingUser(null);
      } else {
        // Create new employee
        body.password = password;
        
        const created = await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        // Check if this was a reactivation or new creation
        const isReactivation = created.created_at !== created.updated_at;
        
        setMessage(
          isReactivation 
            ? `Employee "${created.name}" was reactivated successfully` 
            : `Employee created successfully with ID ${created.id || created.employee_id || 'N/A'}`
        );
      }
      
      // Clear form
      setEmployeeId('');
      setName('');
      setEmail('');
      setDepartmentId('');
      setPositionId('');
      setRole('Employee');
      setPassword('');
      setSupervisorId('');
      setManagerId('');
      setAmId('');
      setActiveView('table'); // Return to table view

      // Refresh users list
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setError(err.message || `Failed to ${editingUser ? 'update' : 'create'} employee.`);
    }
  }

  // Handle edit user
  function handleEditUser(user) {
    setEditingUser(user);
    setEmployeeId(user.employee_id);
    setName(user.name || '');
    setEmail(user.email);
    setDepartmentId(String(user.department_id));
    setPositionId(String(user.position_id));
    setRole(user.role);
    setSupervisorId(user.supervisor_id ? String(user.supervisor_id) : '');
    setManagerId(user.manager_id ? String(user.manager_id) : '');
    setAmId(user.am_id ? String(user.am_id) : '');
    setPassword('');
    
    // Load department users when editing
    if (user.department_id) {
      loadDepartmentUsers(user.department_id);
    }
    
    setActiveView('form'); // Switch to form view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingUser(null);
    setEmployeeId('');
    setName('');
    setEmail('');
    setDepartmentId('');
    setPositionId('');
    setRole('Employee');
    setPassword('');
    setSupervisorId('');
    setManagerId('');
    setAmId('');
    setActiveView('table'); // Return to table view
  }

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = selectedDepartment === '' || user.department_name === selectedDepartment;
    const matchesRole = selectedRole === '' || user.role === selectedRole;
    
    return matchesSearch && matchesDepartment && matchesRole;
  });

  // Group filtered users by department
  const groupedUsers = departments.reduce((acc, dept) => {
    const deptUsers = filteredUsers.filter(u => u.department_name === dept.name);
    if (deptUsers.length > 0) {
      acc[dept.name] = deptUsers;
    }
    return acc;
  }, {});

  // Users without department
  const usersWithoutDept = filteredUsers.filter(u => !u.department_name);
  if (usersWithoutDept.length > 0) {
    groupedUsers['No Department'] = usersWithoutDept;
  }

  // Handle delete user
  async function handleDeleteUser(userId, userName) {
    showConfirmModal(
      'Delete Employee',
      `Are you sure you want to delete employee "${userName}"? This action cannot be undone.`,
      async () => {
        try {
          await apiRequest(`/api/users/${userId}`, {
            method: 'DELETE'
          });
          showModal('Success', 'Employee deleted successfully.', 'success');
          await fetchUsers();
        } catch (err) {
          console.error(err);
          showModal('Error', err.message || 'Failed to delete employee.', 'error');
        }
      }
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white shadow border-b border-gray-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.location.href = '/hr'}
              className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                HR – Employee Management
              </h1>
              <p className="text-sm text-gray-600">Manage employee accounts and information</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {message && (
          <div className="mb-6 rounded-xl border-l-4 border-green-400 bg-green-50 p-4 shadow-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800">{message}</span>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border-l-4 border-red-400 bg-red-50 p-4 shadow-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveView('table')}
              className={`px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                activeView === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v14M16 5v14" />
                </svg>
                Employee Directory ({filteredUsers.length})
              </div>
            </button>
            <button
              onClick={() => setActiveView('form')}
              className={`px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                activeView === 'form'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {editingUser ? 'Edit Employee' : 'Add New Employee'}
              </div>
            </button>
          </nav>
        </div>

        {/* Table View */}
        {activeView === 'table' && (
          <div className="rounded-lg border border-gray-200 bg-white shadow">
            {/* Search and Filter Controls */}
            <div className="border-b border-gray-200 bg-gray-50 p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Employees
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name, email, or employee ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* Department Filter */}
                <div className="lg:w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Department
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role Filter */}
                <div className="lg:w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Roles</option>
                    <option value="Employee">Employee</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="AM">Assistant Manager</option>
                    <option value="Manager">Manager</option>
                    <option value="HR">HR</option>
                  </select>
                </div>

                {/* Clear Filters */}
                {(searchTerm || selectedDepartment || selectedRole) && (
                  <div className="lg:w-auto flex items-end">
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedDepartment('');
                        setSelectedRole('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Table Content */}
            <div className="p-6">
              {loadingUsers ? (
                <div className="text-center py-12">
                  <div className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  <p className="text-sm text-gray-500">Loading employees...</p>
                </div>
              ) : Object.keys(groupedUsers).length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-lg text-gray-500 mb-2">
                    {searchTerm || selectedDepartment || selectedRole 
                      ? 'No employees found matching your filters' 
                      : 'No employees found'
                    }
                  </p>
                  <p className="text-sm text-gray-400">
                    {searchTerm || selectedDepartment || selectedRole 
                      ? 'Try adjusting your search or filters'
                      : 'Add your first employee using the form'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(groupedUsers).map(([departmentName, deptUsers]) => (
                    <div key={departmentName}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {departmentName}
                        </h3>
                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                          {deptUsers.length} employees
                        </span>
                      </div>
                      
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium text-gray-700">Employee</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700">Contact</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700">Position</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700">Reporting Structure</th>
                              <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {deptUsers.map((user) => (
                              <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                                <td className="px-4 py-4">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                                        <span className="text-sm font-medium text-white">
                                          {user.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : user.employee_id.slice(0, 2)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">{user.name || 'N/A'}</div>
                                      <div className="text-sm text-gray-500 font-mono">{user.employee_id}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-sm text-gray-900">{user.email}</div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-sm text-gray-900">{user.position_title || user.position_id || 'N/A'}</div>
                                </td>
                                <td className="px-4 py-4">
                                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    user.role === 'Manager' ? 'bg-purple-100 text-purple-800' :
                                    user.role === 'AM' ? 'bg-blue-100 text-blue-800' :
                                    user.role === 'Supervisor' ? 'bg-green-100 text-green-800' :
                                    user.role === 'HR' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {user.role}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-sm space-y-1">
                                    {user.supervisor_name && (
                                      <div className="flex items-center text-gray-600">
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-2">SUP:</span>
                                        {user.supervisor_name}
                                      </div>
                                    )}
                                    {user.manager_name && (
                                      <div className="flex items-center text-gray-600">
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-2">MGR:</span>
                                        {user.manager_name}
                                      </div>
                                    )}
                                    {user.am_name && (
                                      <div className="flex items-center text-gray-600">
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-2">AM:</span>
                                        {user.am_name}
                                      </div>
                                    )}
                                    {user.role === 'Employee' && (!user.supervisor_name && !user.supervisor_id) && (
                                      <div className="text-red-600 text-xs font-medium flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Missing Supervisor
                                      </div>
                                    )}
                                    {!user.supervisor_name && !user.manager_name && !user.am_name && user.role !== 'Employee' && (
                                      <div className="text-gray-400 text-xs">No reporting structure</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditUser(user)}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150"
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id, user.name)}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-150"
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create/Edit Form */}
        {activeView === 'form' && (
          <div className="rounded-lg border border-gray-200 bg-white shadow">
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingUser ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                  </svg>
                  {editingUser ? 'Edit Employee' : 'Add New Employee'}
                </h2>
                {editingUser && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-6"></div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    required
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    placeholder="Enter employee ID"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    placeholder="Enter full name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    placeholder="Enter email address"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={handleDepartmentChange}
                    required
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Position
                  </label>
                  <select
                    value={positionId}
                    onChange={(e) => setPositionId(e.target.value)}
                    required
                    disabled={!departmentId}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {departmentId
                        ? '-- Select Position --'
                        : 'Select department first'}
                    </option>
                    {filteredPositions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="AM">Assistant Manager</option>
                    <option value="Manager">Manager</option>
                    <option value="HR">HR</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Supervisor
                  </label>
                  <select
                    value={supervisorId}
                    onChange={(e) => setSupervisorId(e.target.value)}
                    required={role === 'Employee'}
                    disabled={!departmentId}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {departmentId
                        ? '-- Select Supervisor --'
                        : 'Select department first'}
                    </option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Manager
                  </label>
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    disabled={!departmentId}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {departmentId
                        ? '-- Select Manager (Optional) --'
                        : 'Select department first'}
                    </option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Assistant Manager
                  </label>
                  <select
                    value={amId}
                    onChange={(e) => setAmId(e.target.value)}
                    disabled={!departmentId}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {departmentId
                        ? '-- Select Assistant Manager (Optional) --'
                        : 'Select department first'}
                    </option>
                    {ams.map((am) => (
                      <option key={am.id} value={am.id}>
                        {am.name} ({am.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Password {editingUser && <span className="text-xs text-gray-500 font-normal">(leave blank to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!editingUser}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    placeholder="Enter password"
                  />
                </div>

                <div className="md:col-span-2 pt-4 border-t border-gray-200">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {editingUser ? 'Update Employee' : 'Add Employee'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        isConfirm={modal.isConfirm}
      />
    </div>
  );
}

export default HREmployeeManagement;