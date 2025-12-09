// src/pages/ManagerReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';

function ManagerReviewCLPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [cl, setCl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false); // 👈 for approve/return buttons

  const managerRoles = ['Manager', 'HR', 'Admin'];

  // ==========================
  // AUTH GUARD
  // ==========================
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(stored);
    if (!managerRoles.includes(parsed.role)) {
      alert('Only Managers / HR / Admin can view this page.');
      window.location.href = '/';
      return;
    }

    setUser(parsed);
  }, []);

  // ==========================
  // LOAD CL DETAILS
  // ==========================
  useEffect(() => {
    if (!user) return;

    async function loadCL() {
      try {
        const data = await apiRequest(`/api/cl/${id}`, { method: 'GET' });
        setCl(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load CL details.');
      } finally {
        setLoading(false);
      }
    }

    loadCL();
  }, [user, id]);

  function goBack() {
    window.location.href = '/manager';
  }

  // ==========================
  // HANDLERS: APPROVE / RETURN
  // ==========================
  async function handleApprove() {
    if (!window.confirm('Approve this CL?')) return;

    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/manager/approve`, {
        method: 'POST',
      });
      alert('CL approved successfully.');
      window.location.href = '/manager';
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to approve CL.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReturn() {
    if (!window.confirm('Return this CL to the supervisor?')) return;

    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/manager/return`, {
        method: 'POST',
      });
      alert('CL returned to supervisor.');
      window.location.href = '/manager';
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to return CL.');
    } finally {
      setActionLoading(false);
    }
  }

  if (!user) return null;

  if (loading) return <p className="p-4">Loading...</p>;

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-2">{error}</p>
        <button onClick={goBack} className="px-4 py-2 rounded bg-gray-600 text-white">
          Back to Manager Dashboard
        </button>
      </div>
    );
  }

  if (!cl) {
    return (
      <div className="p-4">
        <p className="text-gray-600">CL not found.</p>
        <button onClick={goBack} className="mt-2 px-4 py-2 rounded bg-gray-600 text-white">
          Back to Manager Dashboard
        </button>
      </div>
    );
  }

  const { header, items } = cl;

  // ==========================
  // COMPUTE TOTAL SCORE
  // ==========================
  const totalScore = (items || []).reduce(
    (sum, it) => sum + (Number(it.score) || 0),
    0
  );

  return (
    <div className="max-w-6xl mx-auto p-8">
      <button
        onClick={goBack}
        className="mb-4 px-4 py-2 rounded border border-gray-300 text-sm"
      >
        ← Back to Manager Dashboard
      </button>

      <h1 className="text-2xl font-bold mb-2">
        CL Review – #{header.id}
      </h1>

      <p className="text-sm text-gray-600 mb-4">
        Status: <strong>{header.status}</strong>
      </p>

      {/* COMPETENCY TABLE */}
      <div className="bg-white shadow rounded p-4 mb-6 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3">Competencies</h2>
        
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 uppercase text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Competency</th>
              <th className="px-3 py-2 text-left">MPLR</th>
              <th className="px-3 py-2 text-left">Assigned Level</th>
              <th className="px-3 py-2 text-left">Weight (%)</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Justification</th>
              <th className="px-3 py-2 text-left">PDF Attachment</th>
            </tr>
          </thead>

          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2">{it.competency_name}</td>
                <td className="px-3 py-2">{it.mplr_level}</td>
                <td className="px-3 py-2">{it.assigned_level}</td>
                <td className="px-3 py-2">{it.weight}</td>
                <td className="px-3 py-2">{Number(it.score || 0).toFixed(2)}</td>
                <td className="px-3 py-2">{it.justification}</td>

                {/* PDF FILE COLUMN */}
                <td className="px-3 py-2">
                  {it.pdf_path ? (
                    <a
                      href={`http://localhost:4000/${it.pdf_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      View PDF
                    </a>
                  ) : (
                    <span className="text-gray-400 text-xs">No file</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTAL SCORE */}
        <div className="mt-4 text-sm">
          <p className="text-gray-700">
            <strong>Total Final Score:</strong> {totalScore.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Score = (Weight % / 100) × Assigned Level. Total is sum of all scores.
          </p>
        </div>
      </div>

      {/* PROFICIENCY LEVEL GUIDE */}
      <div className="bg-white shadow rounded p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Proficiency Level Guide
        </h2>

        <table className="min-w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Proficiency</th>
              <th className="px-3 py-2">Definition</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="px-3 py-2">1</td><td>Fundamental Awareness</td><td>Basic understanding…</td></tr>
            <tr><td className="px-3 py-2">2</td><td>Novice</td><td>Limited experience…</td></tr>
            <tr><td className="px-3 py-2">3</td><td>Intermediate</td><td>Works independently…</td></tr>
            <tr><td className="px-3 py-2">4</td><td>Advanced</td><td>Handles complex tasks…</td></tr>
            <tr><td className="px-3 py-2">5</td><td>Expert</td><td>Top-level mastery…</td></tr>
          </tbody>
        </table>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex gap-3">
        <button
          className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
          onClick={handleApprove}
          disabled={actionLoading}
        >
          {actionLoading ? 'Processing...' : 'Approve'}
        </button>

        <button
          className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
          onClick={handleReturn}
          disabled={actionLoading}
        >
          Return to Supervisor
        </button>
      </div>
    </div>
  );
}

export default ManagerReviewCLPage;
