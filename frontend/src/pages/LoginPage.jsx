// src/pages/LoginPage.jsx
import { useState } from 'react';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
// Map roles to where they should land after login
const ROLE_REDIRECTS = {
  Admin: '/admin/users/create',
  Supervisor: '/supervisor',
  AM: '/am',                // Assistant Manager
  Manager: '/manager',
  HR: '/hr',
  Employee: '/employee',
};

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    console.log('LOGIN: submitting', { email, password });
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      console.log('LOGIN: response status', res.status);
      if (!res.ok) {
        let errMsg = 'Login failed';
        try {
          const err = await res.json();
          errMsg = err.message || errMsg;
        } catch { /* ignore error */ }
        console.error('LOGIN: error response', errMsg);
        throw new Error(errMsg);
      }
      const data = await res.json();
      console.log('LOGIN: response data', data);
      // save token + user to localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // Debug: log user and token
      console.log('LOGIN DEBUG:', { user: data.user, token: data.token });
        // Show localStorage contents before redirect
        alert('DEBUG: localStorage user=' + localStorage.getItem('user') + '\ntoken=' + localStorage.getItem('token'));
      const role = data.user.role;
      const redirectTo = ROLE_REDIRECTS[role] || '/';
      console.log('LOGIN: redirecting to', redirectTo);
      window.location.href = redirectTo;
    } catch (err) {
      setError(err.message);
      console.error('LOGIN: catch error', err);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">FUTURA</h2>
          <p className="text-gray-500 text-sm">Sign in to your account</p>
        </div>
        {error && (
          <div className="mb-4 text-red-600 text-center font-semibold">
            {error}
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="Enter your password"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition shadow-md hover:shadow-lg"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
