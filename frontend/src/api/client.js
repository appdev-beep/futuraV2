// src/api/client.js
export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`http://localhost:4000${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let message = 'Request failed';
    try {
      const errBody = await res.json();
      message = errBody.message || message;
    } catch (_) {}
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}
