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

  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // NEW: users list state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });

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
        const [deps, pos, allUsers] = await Promise.all([
          apiRequest('/api/lookup/departments', { method: 'GET' }),
          apiRequest('/api/lookup/positions', { method: 'GET' }),
          apiRequest('/api/users', { method: 'GET' })
        ]);
        setDepartments(deps);
        setPositions(pos);
        setSupervisors(allUsers.filter(u => u.role === 'Supervisor'));
      } catch (err) {
        console.error(err);
        setError('Failed to load lookups. Check your backend /lookup routes.');
      }
    }

    loadLookups();
    fetchUsers();
  }, []);

  // When department changes, reset selected position
  function handleDepartmentChange(e) {
    const value = e.target.value;
    setDepartmentId(value);
    setPositionId('');
    setSupervisorId('');
  }

  // Filter positions based on selected department
  const filteredPositions = departmentId
    ? positions.filter((p) => String(p.department_id) === String(departmentId))
    : [];

  // Filter supervisors based on selected department
  const filteredSupervisors = departmentId
    ? supervisors.filter((s) => String(s.department_id) === String(departmentId))
    : [];

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

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
        supervisor_id: supervisorId ? Number(supervisorId) : null
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
    setPassword('');
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
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
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

        {/* Create user form */}
        <div className="mb-8 rounded border border-gray-200 bg-white p-6 shadow">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingUser ? 'Edit Employee' : 'Add New Employee'}
            </h2>
            {editingUser && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
              >
                Cancel Edit
              </button>
            )}
          </div>
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
                className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
                className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
                className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
                className="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
                className="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
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
                className="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="Employee">Employee</option>
                <option value="Supervisor">Supervisor</option>
                <option value="AM">Assistant Manager</option>
                <option value="Manager">Manager</option>
                <option value="HR">HR</option>
              </select>
            </div>

            {role === 'Employee' && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Supervisor
                </label>
                <select
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                  required={role === 'Employee'}
                  disabled={!departmentId}
                  className="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">
                    {departmentId
                      ? '-- Select Supervisor --'
                      : 'Select department first'}
                  </option>
                  {filteredSupervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.employee_id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700">
                Password {editingUser && <span className="text-xs text-gray-500 font-normal">(leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editingUser}
                className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Enter password"
              />
            </div>

            <div className="md:col-span-2 pt-4">
              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 rounded bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                {editingUser ? 'Update Employee' : 'Add Employee'}
              </button>
            </div>
          </form>
        </div>

        {/* Employee Directory */}
        <section className="rounded border border-gray-200 bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Employee Directory
          </h2>

          {loadingUsers ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <p className="text-sm text-gray-500">Loading employees...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-gray-500 mb-2">No employees found</p>
              <p className="text-sm text-gray-400">Add your first employee using the form above</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Group users by department */}
              {departments.map(dept => {
                const deptUsers = users.filter(u => u.department_name === dept.name);
                if (deptUsers.length === 0) return null;
                
                return (
                  <div key={dept.id}>
                    <h3 className="text-md font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                      {dept.name} ({deptUsers.length} employees)
                    </h3>
                    <div className="overflow-x-auto rounded border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Employee ID</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Position</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Supervisor</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {deptUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <span className="font-mono text-sm">{u.employee_id}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-gray-900">{u.name}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-gray-600">{u.email}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-gray-700">{u.position_title || u.position_id}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {u.role === 'Employee' && (!u.supervisor_name && !u.supervisor_id) ? (
                                  <span className="text-red-600 font-medium text-sm">Missing</span>
                                ) : (
                                  <span className="text-gray-700">{u.supervisor_name || '-'}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditUser(u)}
                                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.name)}
                                    className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                                  >
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
                );
              })}
              
              {/* Users without department */}
              {(() => {
                const usersWithoutDept = users.filter(u => !u.department_name);
                if (usersWithoutDept.length === 0) return null;
                
                return (
                  <div>
                    <h3 className="text-md font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                      No Department ({usersWithoutDept.length} employees)
                    </h3>
                    <div className="overflow-x-auto rounded border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Employee ID</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Position</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Supervisor</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {usersWithoutDept.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <span className="font-mono text-sm">{u.employee_id}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-gray-900">{u.name}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-gray-600">{u.email}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-gray-700">{u.position_title || u.position_id}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {u.role === 'Employee' && (!u.supervisor_name && !u.supervisor_id) ? (
                                  <span className="text-red-600 font-medium text-sm">Missing</span>
                                ) : (
                                  <span className="text-gray-700">{u.supervisor_name || '-'}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditUser(u)}
                                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.name)}
                                    className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                                  >
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
                );
              })()
              }
            </div>
          )}
        </section>
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