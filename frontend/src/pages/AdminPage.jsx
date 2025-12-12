// src/pages/AdminCreateUserPage.jsx
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

function AdminPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [role, setRole] = useState('Employee');
  const [password, setPassword] = useState('');

  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // NEW: users list state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

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
      alert('Only Admin and Supervisor can access this page.');
      window.location.href = '/';
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

  // When department changes, reset selected position
  function handleDepartmentChange(e) {
    const value = e.target.value;
    setDepartmentId(value);
    setPositionId('');
  }

  // Filter positions based on selected department
  const filteredPositions = departmentId
    ? positions.filter((p) => String(p.department_id) === String(departmentId))
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
        password
      };

      const created = await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      setMessage(
        `User created with id ${created.id || created.employee_id || 'N/A'}`
      );
      // Optional: clear form
      setEmployeeId('');
      setName('');
      setEmail('');
      setDepartmentId('');
      setPositionId('');
      setRole('Employee');
      setPassword('');

      // NEW: refresh users list after creating a user
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create user.');
    }
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

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                Create User
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminPage;
