// src/pages/AdminCreateUserPage.jsx
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import Modal from '../components/Modal';

function AdminPage() {
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

  // Check that current user is Admin or Supervisor
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      window.location.href = '/login';
      return;
    }
    const user = JSON.parse(userStr);
    const allowedRoles = ['Admin', 'Supervisor'];
    if (!allowedRoles.includes(user.role)) {
      showModal('Access Denied', 'Only Admin and Supervisor can access this page.', 'error');
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
        // Update existing user
        if (password) {
          body.password = password;
        }
        
        await apiRequest(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
        
        setMessage(`User "${name}" was updated successfully`);
        setEditingUser(null);
      } else {
        // Create new user
        body.password = password;
        
        const created = await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify(body)
        });

        // Check if this was a reactivation or new creation
        const isReactivation = created.created_at !== created.updated_at;
        
        setMessage(
          isReactivation 
            ? `User "${created.name}" was reactivated successfully` 
            : `User created successfully with ID ${created.id || created.employee_id || 'N/A'}`
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
      setError(err.message || `Failed to ${editingUser ? 'update' : 'create'} user.`);
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
      'Delete User',
      `Are you sure you want to delete user "${userName}"? This action cannot be undone.`,
      async () => {
        try {
          await apiRequest(`/api/users/${userId}`, {
            method: 'DELETE'
          });
          showModal('Success', 'User deleted successfully.', 'success');
          await fetchUsers();
        } catch (err) {
          console.error(err);
          showModal('Error', err.message || 'Failed to delete user.', 'error');
        }
      }
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">
            Admin – Create User Account
          </h1>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {message && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Create user form */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h2>
            {editingUser && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel Edit
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Department
              </label>
              <select
                value={departmentId}
                onChange={handleDepartmentChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Position
              </label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                required
                disabled={!departmentId}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
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

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Employee">Employee</option>
                <option value="Supervisor">Supervisor</option>
                <option value="AM">AM</option>
                <option value="Manager">Manager</option>
                <option value="HR">HR</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {role === 'Employee' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Supervisor
                </label>
                <select
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                  required={role === 'Employee'}
                  disabled={!departmentId}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
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

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password {editingUser && <span className="text-xs text-gray-500">(leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editingUser}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>

        {/* NEW: Users list */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Existing Users
          </h2>

          {loadingUsers ? (
            <p className="text-sm text-gray-500">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-500">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Emp ID
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Email
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Department
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Position
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Role
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Supervisor
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-3 py-2">{u.employee_id}</td>
                      <td className="px-3 py-2">{u.name}</td>
                      <td className="px-3 py-2">{u.email}</td>
                      <td className="px-3 py-2">
                        {u.department_name || u.department_id}
                      </td>
                      <td className="px-3 py-2">
                        {u.position_title || u.position_id}
                      </td>
                      <td className="px-3 py-2">{u.role}</td>
                      <td className="px-3 py-2">
                        {u.role === 'Employee' && (!u.supervisor_name && !u.supervisor_id) ? (
                          <span className="text-red-600 font-medium">⚠ Missing</span>
                        ) : (
                          u.supervisor_name || '-'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditUser(u)}
                            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
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

export default AdminPage;
