// src/pages/LoginPage.jsx
import { useState } from 'react';

// Map roles to where they should land after login
const ROLE_REDIRECTS = {
  Admin: '/admin/users/create',
  Supervisor: '/supervisor',
  AM: '/supervisor',        // Assistant Manager
  Manager: '/manager',      // ⬅️ go to Manager dashboard
  HR: '/manager',           // ⬅️ HR shares Manager dashboard
  Employee: '/',            // regular employees (adjust if you add an Employee dashboard)
};

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Login failed');
      }

      const data = await res.json();

      // save token + user to localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      const role = data.user.role;
      const redirectTo = ROLE_REDIRECTS[role] || '/';

      window.location.href = redirectTo;
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto' }}>
      <h2>FUTURA Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email</label><br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <label>Password</label><br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" style={{ marginTop: 15 }}>Login</button>
      </form>
    </div>
  );
}

export default LoginPage;
