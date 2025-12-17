// src/pages/AMReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import Modal from '../components/Modal';

function AMReviewCLPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [cl, setCl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type, isConfirm: false, onConfirm: null });
  };

  const showConfirmModal = (title, message, onConfirm, type = 'warning') => {
    setModal({ isOpen: true, title, message, type, isConfirm: true, onConfirm });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      window.location.href = '/login';
      return;
    }

    const parsed = JSON.parse(stored);
    if (parsed.role !== 'AM') {
      showModal('Access Denied', 'Only Assistant Managers can review CLs.', 'error');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }

    setUser(parsed);
  }, []);

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
    window.location.href = '/am';
  }

  function confirmApprove() {
    showConfirmModal('Confirm Approval', 'Approve this CL?', executeApprove, 'info');
  }

  async function executeApprove() {
    closeModal();
    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/am/approve`, {
        method: 'POST',
        body: JSON.stringify({ remarks })
      });
      showModal('Success', 'CL approved successfully.', 'success');
      setTimeout(() => goBack(), 2000);
    } catch (err) {
      console.error(err);
      showModal('Error', err.message || 'Failed to approve CL.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  function confirmReturn() {
    if (!remarks.trim()) {
      showModal('Validation Error', 'Please provide remarks before returning.', 'warning');
      return;
    }
    showConfirmModal('Confirm Return', 'Return this CL to the supervisor?', executeReturn, 'warning');
  }

  async function executeReturn() {
    closeModal();
    try {
      setActionLoading(true);
      await apiRequest(`/api/cl/${id}/am/return`, {
        method: 'POST',
        body: JSON.stringify({ remarks })
      });
      showModal('Success', 'CL returned to supervisor.', 'success');
      setTimeout(() => goBack(), 2000);
    } catch (err) {
      console.error(err);
      showModal('Error', err.message || 'Failed to return CL.', 'error');
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
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!cl) {
    return (
      <div className="p-4">
        <p className="text-gray-600">CL not found.</p>
        <button onClick={goBack} className="mt-2 px-4 py-2 rounded bg-gray-600 text-white">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { header, items } = cl;
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
        ← Back to Dashboard
      </button>

      <h1 className="text-2xl font-bold mb-2">CL Review – #{header.id}</h1>
      <p className="text-sm text-gray-600 mb-4">
        Status: <strong>{header.status}</strong>
      </p>

      {/* Employee & Supervisor Info */}
      <div className="bg-white rounded shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Employee Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Employee Name</p>
            <p className="font-medium">{header.employee_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-600">Supervisor</p>
            <p className="font-medium">{header.supervisor_name || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Competencies Table */}
      <div className="bg-white rounded shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Competencies</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Competency</th>
              <th className="px-4 py-2 text-left font-semibold">MPLR</th>
              <th className="px-4 py-2 text-left font-semibold">Assigned</th>
              <th className="px-4 py-2 text-left font-semibold">Weight</th>
              <th className="px-4 py-2 text-left font-semibold">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items || []).map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-2">{it.competency_name}</td>
                <td className="px-4 py-2">{it.mplr_level}</td>
                <td className="px-4 py-2">{it.assigned_level}</td>
                <td className="px-4 py-2">{it.weight}%</td>
                <td className="px-4 py-2">{Number(it.score || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-right font-semibold">
          Total Score: {totalScore.toFixed(2)}
        </p>
      </div>

      {/* Remarks Section */}
      <div className="bg-white rounded shadow-sm p-6 mb-6">
        <label className="block text-sm font-semibold mb-2">
          Remarks {header.status === 'PENDING_AM' && <span className="text-red-600">*</span>}
        </label>
        <textarea
          className="w-full border rounded p-3 text-sm"
          rows="5"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Enter your remarks or leave empty to approve..."
        ></textarea>
      </div>

      {/* Action Buttons */}
      {header.status === 'PENDING_AM' && (
        <div className="flex gap-4">
          <button
            onClick={confirmApprove}
            disabled={actionLoading}
            className="px-6 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={confirmReturn}
            disabled={actionLoading}
            className="px-6 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {actionLoading ? 'Processing...' : 'Return for Revision'}
          </button>
        </div>
      )}

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

export default AMReviewCLPage;
