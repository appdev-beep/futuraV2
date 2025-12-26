// src/pages/AMReviewCLPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';

function AMReviewCLPage() {
    function goBack() {
      window.location.href = '/am';
    }

    function confirmApprove() {
      showConfirmModal('Confirm Approval', 'Approve this CL?', () => {/* TODO: implement approve logic */}, 'info');
    }

    function confirmReturn() {
      if (!remarks.trim()) {
        showModal('Validation Error', 'Please provide remarks before returning.', 'warning');
        return;
      }
      showConfirmModal('Confirm Return', 'Return this CL to the supervisor?', () => {/* TODO: implement return logic */}, 'warning');
    }
  const [searchParams] = useSearchParams();
  const viewOnly = searchParams.get('viewOnly') === 'true';
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
    if (parsed.role !== 'AM') {
      showModal('Access Denied', 'Only Assistant Managers can view this page.', 'error');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }
    // ...existing code for fetching user/CL if needed...
  }, []);

  if (!user) return null;
  if (loading) return <p className="p-4">Loading...</p>;
  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-2">{error}</p>
        <button onClick={goBack} className="px-4 py-2 rounded bg-gray-600 text-white">
          Back to Assistant Manager Dashboard
        </button>
      </div>
    );
  }
  if (!cl) {
    return (
      <div className="p-4">
        <p className="text-gray-600">CL not found.</p>
        <button onClick={goBack} className="mt-2 px-4 py-2 rounded bg-gray-600 text-white">
          Back to Assistant Manager Dashboard
        </button>
      </div>
    );
  }

  // 👇 include supervisor_remarks and am_remarks from backend
  const {
    id: clId,
    status,
    items,
    employee_name,
    employee_id,
    employee_email,
    position_title,
    department_name,
    supervisor_name,
    supervisor_remarks,
    am_remarks,
    updated_at,
  } = cl;

  // ==========================
  // COMPUTE TOTAL SCORE & PROFICIENCY LEVEL
  // ==========================
  const totalScore = (items || []).reduce(
    (sum, it) => sum + (Number(it.score) || 0),
    0
  );

  const getProficiencyLevel = (score) => {
    if (score >= 4.5) return { level: 5, name: 'Expert', color: 'bg-purple-100 border-purple-400' };
    if (score >= 3.5) return { level: 4, name: 'Advanced', color: 'bg-green-100 border-green-400' };
    if (score >= 2.5) return { level: 3, name: 'Intermediate', color: 'bg-blue-100 border-blue-400' };
    if (score >= 1.5) return { level: 2, name: 'Novice', color: 'bg-yellow-100 border-yellow-400' };
    return { level: 1, name: 'Fundamental Awareness', color: 'bg-orange-100 border-orange-400' };
  };

  const proficiency = getProficiencyLevel(totalScore);

  // Render
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto py-8">
        <button
          onClick={goBack}
          className="text-slate-500 hover:text-slate-700 px-4 py-2 rounded-md hover:bg-slate-100 text-sm transition"
        >
          Back to Dashboard
        </button>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {/* Employee & Supervisor Info */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h3 className="text-sm font-semibold mb-2 text-slate-700">Employee Information</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-500">Employee Name</p>
                <p className="font-medium text-slate-800">{employee_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500">Supervisor</p>
                <p className="font-medium text-slate-800">{supervisor_name || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* TOTAL SCORE CARD */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 border border-blue-800 rounded-lg p-3 mb-3 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-blue-100 mb-0.5">TOTAL FINAL SCORE</p>
                <p className="text-2xl font-bold text-white">{totalScore.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-blue-100 mb-0.5">PROFICIENCY LEVEL</p>
                <p className="text-xl font-bold text-white">Level {proficiency.level}</p>
                <p className="text-xs font-semibold text-blue-100">{proficiency.name}</p>
              </div>
            </div>
          </div>

          {/* Competencies Table */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h3 className="text-sm font-semibold mb-2 text-slate-700">Competency Assessment</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                <thead className="bg-slate-100 uppercase text-[11px] text-slate-700">
                  <tr>
                    <th className="px-2 py-1 text-left">Competency</th>
                    <th className="px-2 py-1 text-left">MPLR</th>
                    <th className="px-2 py-1 text-left">Assigned</th>
                    <th className="px-2 py-1 text-left">Weight (%)</th>
                    <th className="px-2 py-1 text-left">Score</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {(items || []).map((it) => (
                    <tr key={it.id} className="border-t border-slate-100">
                      <td className="px-2 py-1 text-slate-800">{it.competency_name}</td>
                      <td className="px-2 py-1 text-slate-700">{it.mplr_level}</td>
                      <td className="px-2 py-1 text-slate-700">{it.assigned_level}</td>
                      <td className="px-2 py-1 text-slate-700">{it.weight}</td>
                      <td className="px-2 py-1 font-semibold text-blue-600">{Number(it.score || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PROFICIENCY LEVEL GUIDE TABLE */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3">
            <h3 className="text-sm font-semibold mb-2 text-slate-700">Proficiency Level Guide</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                <thead className="bg-slate-100 uppercase text-[11px] text-slate-700">
                  <tr>
                    <th className="px-2 py-1 text-left">Level</th>
                    <th className="px-2 py-1 text-left">Proficiency</th>
                    <th className="px-2 py-1 text-left">Description</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-1 font-semibold text-purple-600">5</td>
                    <td className="px-2 py-1 font-semibold text-purple-600">Expert</td>
                    <td className="px-2 py-1 text-slate-700">Advanced mastery; recognized authority; can innovate and lead others</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-1 font-semibold text-green-600">4</td>
                    <td className="px-2 py-1 font-semibold text-green-600">Advanced</td>
                    <td className="px-2 py-1 text-slate-700">Can apply independently in complex scenarios; mentors others</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-1 font-semibold text-blue-600">3</td>
                    <td className="px-2 py-1 font-semibold text-blue-600">Intermediate</td>
                    <td className="px-2 py-1 text-slate-700">Solid working knowledge; can perform tasks with minimal guidance</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-1 font-semibold text-yellow-600">2</td>
                    <td className="px-2 py-1 font-semibold text-yellow-600">Novice</td>
                    <td className="px-2 py-1 text-slate-700">Basic understanding; requires supervision and support</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-1 font-semibold text-orange-600">1</td>
                    <td className="px-2 py-1 font-semibold text-orange-600">Fundamental Awareness</td>
                    <td className="px-2 py-1 text-slate-700">Limited exposure; general familiarity with concepts</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks Section */}
          {!viewOnly && (
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <label className="block text-xs font-medium mb-1 text-slate-700">
                Remarks {status === 'PENDING_AM' && <span className="text-red-600">*</span>}
              </label>
              <textarea
                className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows="3"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter your remarks or leave empty to approve..."
              ></textarea>
            </div>
          )}

          {viewOnly && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                This CL is being viewed in read-only mode.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!viewOnly && status === 'PENDING_AM' && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-2">
            <button
              onClick={confirmApprove}
              disabled={actionLoading}
              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 shadow-sm"
            >
              {actionLoading ? 'Processing...' : 'Approve'}
            </button>
            <button
              onClick={confirmReturn}
              disabled={actionLoading}
              className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 shadow-sm"
            >
              {actionLoading ? 'Processing...' : 'Return for Revision'}
            </button>
          </div>
        )}
      </div>

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
