// src/pages/StartCLPage.jsx
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import Modal from '../components/Modal';
import { 
  MagnifyingGlassIcon, 
  Squares2X2Icon, 
  ListBulletIcon 
} from '@heroicons/react/24/outline';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function StartCLPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [competencies, setCompetencies] = useState([]);
  const [remarks, setRemarks] = useState("");

  const [clHistory, setClHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });

  const [showCLDetailsModal, setShowCLDetailsModal] = useState(false);
  const [selectedCLDetails, setSelectedCLDetails] = useState(null);
  const [clDetailsLoading, setClDetailsLoading] = useState(false);

  // Search and view state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'

  const showAlertModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type, isConfirm: false, onConfirm: null });
  };

  const showConfirmModal = (title, message, onConfirm, type = 'warning') => {
    setModal({ isOpen: true, title, message, type, isConfirm: true, onConfirm });
  };

  const closeAlertModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });
  };

  const supervisorRoles = ["Supervisor", "AM", "Manager", "HR"];

  // -------------------------------
  // Helpers
  // -------------------------------
  function normalizeArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.history)) return data.history;
    return [];
  }

  function safeDate(val) {
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function pickLatest(historyArr) {
    if (!Array.isArray(historyArr) || historyArr.length === 0) return null;

    const sorted = [...historyArr].sort((a, b) => {
      const da = safeDate(a.created_at);
      const db = safeDate(b.created_at);
      if (da && db) return db - da; // newest first
      if (da && !db) return -1;
      if (!da && db) return 1;
      return (b.id || 0) - (a.id || 0);
    });

    return sorted[0];
  }

  // ===============================
  // LOAD USER
  // ===============================
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return (window.location.href = "/login");

    const parsed = JSON.parse(stored);
    if (!supervisorRoles.includes(parsed.role)) {
      showAlertModal('Access Denied', 'Only Supervisors, AM, Manager, or HR can start CL.', 'error');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }

    setCurrentUser(parsed);
  }, []);

  // ===============================
  // LOAD EMPLOYEES (ONLY THOSE WITH COMPETENCIES)
  // + ADD HISTORY SUMMARY PER EMPLOYEE (for cards)
  // ===============================
  useEffect(() => {
    if (!currentUser) return;

    async function loadEmployees() {
      try {
        setError("");

        const data = await apiRequest("/api/users", { method: "GET" });

        const filtered = (data || []).filter(
          (u) =>
            u.role === "Employee" &&
            Number(u.department_id) === Number(currentUser.department_id)
        );

        const enriched = await Promise.all(
          filtered.map(async (emp) => {
            // 1) competencyCount
            let competencyCount = 0;
            try {
              const resp = await apiRequest(
                `/api/cl/employee/${emp.id}/competencies`,
                { method: "GET" }
              );
              competencyCount = (resp?.competencies || []).length;
            } catch {
              competencyCount = 0;
            }

            // 2) history summary (for showing "past/present CL" on card)
            let historyCount = 0;
            let latestCL = null;

            try {
              const histResp = await apiRequest(
                `/api/cl/employee/${emp.id}/history`,
                { method: "GET" }
              );
              const histArr = normalizeArray(histResp);

              historyCount = histArr.length;
              latestCL = pickLatest(histArr);
            } catch {
              historyCount = 0;
              latestCL = null;
            }

            return {
              ...emp,
              competencyCount,
              historyCount,
              latestCL,
            };
          })
        );

        const onlyWithCompetencies = enriched.filter(
          (e) => Number(e.competencyCount) > 0
        );

        setEmployees(onlyWithCompetencies);
      } catch (e) {
        console.error(e);
        setError("Failed to load employees.");
      }
    }

    loadEmployees();
  }, [currentUser]);

  // ===============================
  // LOAD COMPETENCIES + EMPLOYEE INFO WHEN MODAL OPENS
  // ===============================
  useEffect(() => {
    if (!showModal || !selectedEmployeeId) {
      setEmployeeInfo(null);
      setCompetencies([]);
      return;
    }

    async function loadCompetencies() {
      try {
        const data = await apiRequest(
          `/api/cl/employee/${selectedEmployeeId}/competencies`,
          { method: "GET" }
        );

        setEmployeeInfo(data.employee || null);

        setCompetencies(
          (data.competencies || []).map((c) => {
            const assignedLevel = c.mplr;
            const weight = "";
            const score = 0;

            return {
              ...c,
              assigned_level: assignedLevel,
              weight,
              justification: "",
              pdf: null,
              final_score: score,
            };
          })
        );
      } catch (e) {
        console.error(e);
        setError("Failed to load competencies.");
      }
    }

    loadCompetencies();
  }, [showModal, selectedEmployeeId]);

  // ===============================
  // LOAD PAST / EXISTING CL HISTORY (FULL TABLE IN MODAL)
  // ===============================
  useEffect(() => {
    if (!showModal || !selectedEmployeeId) {
      setClHistory([]);
      return;
    }

    async function loadHistory() {
      try {
        setHistoryLoading(true);
        const data = await apiRequest(
          `/api/cl/employee/${selectedEmployeeId}/history`,
          { method: "GET" }
        );

        setClHistory(normalizeArray(data));
      } catch (e) {
        console.error(e);
        setError((prev) => prev || "Failed to load CL history.");
      } finally {
        setHistoryLoading(false);
      }
    }

    loadHistory();
  }, [showModal, selectedEmployeeId]);

  // ===============================
  // UPDATE COMPETENCY FIELDS
  // ===============================
  function updateCompetency(index, field, value) {
    const updated = [...competencies];
    updated[index][field] = value;

    const weightNum = Number(updated[index].weight) || 0;
    const levelNum = Number(updated[index].assigned_level) || 0;

    updated[index].final_score = (weightNum / 100) * levelNum;

    setCompetencies(updated);
  }

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    
    const query = searchQuery.toLowerCase();
    return employees.filter(emp => 
      emp.name?.toLowerCase().includes(query) ||
      emp.employee_id?.toLowerCase().includes(query) ||
      emp.position_title?.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  const totalFinalScore = useMemo(() => {
    return competencies.reduce((s, c) => s + (Number(c.final_score) || 0), 0);
  }, [competencies]);

  // ===============================
  // START CL (WITH PDF UPLOAD)
  // ===============================
  function validateAndConfirmStart() {
    if (!selectedEmployeeId) return setError("Please select an employee.");
    if (!employeeInfo) return setError("Employee data not loaded.");

    // Validate all weights are filled
    const emptyWeights = competencies.filter(c => !c.weight || c.weight === '' || Number(c.weight) === 0);
    if (emptyWeights.length > 0) {
      showAlertModal('Validation Error', 'Please enter weight values for all competencies. Weight cannot be 0 or empty.', 'warning');
      return;
    }

    // Check if total weight equals 100
    const totalWeight = competencies.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      showAlertModal('Validation Error', `Total weight must equal 100%. Current total: ${totalWeight.toFixed(2)}%`, 'warning');
      return;
    }

    // Show confirmation
    showConfirmModal(
      'Confirm Submission',
      'Are you sure you want to create and submit this CL?',
      handleStartCL,
      'info'
    );
  }

  async function handleStartCL() {
    setLoading(true);
    setError("");
    closeAlertModal();

    try {
      // STEP 1 — CREATE CL HEADER
      const createBody = {
        employee_id: Number(selectedEmployeeId),
        supervisor_id: currentUser.id,
        department_id: employeeInfo.department_id,
        cycle_id: 1,
      };

      const created = await apiRequest("/api/cl", {
        method: "POST",
        body: JSON.stringify(createBody),
      });

      const clId = created.id;

      // STEP 2 — FETCH DB ITEMS TO GET THEIR IDs
      const initial = await apiRequest(`/api/cl/${clId}`, { method: "GET" });
      const dbItems = initial.items || [];

      // STEP 3 — UPLOAD PDFs FIRST
      const uploadedFiles = {};

      for (const comp of competencies) {
        if (comp.pdf) {
          console.log(`Uploading PDF for competency ${comp.competency_id}:`, comp.pdf.name);
          const formData = new FormData();
          formData.append("file", comp.pdf);

          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/api/cl/upload`, {
            method: "POST",
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData,
          });

          if (!res.ok) {
            console.error(`Failed to upload PDF for competency ${comp.competency_id}`);
            throw new Error(`Failed to upload PDF: ${res.statusText}`);
          }

          const data = await res.json();
          console.log(`PDF uploaded successfully for competency ${comp.competency_id}:`, data.filePath);
          uploadedFiles[comp.competency_id] = data.filePath;
        }
      }

      console.log('All uploaded files:', uploadedFiles);

      // STEP 4 — MERGE DB ITEMS + REACT STATE INTO A PAYLOAD
      const itemsPayload = dbItems.map((item) => {
        const comp = competencies.find(
          (c) => Number(c.competency_id) === Number(item.competency_id)
        );

        const payload = {
          id: item.id,
          assigned_level: Number(comp.assigned_level),
          weight: Number(comp.weight),
          justification: comp.justification || "",
          pdf_path: uploadedFiles[comp.competency_id] || null,
        };

        console.log(`Item ${item.id} (competency ${comp.competency_id}):`, payload);
        return payload;
      });

      console.log('Final items payload:', itemsPayload);

      // STEP 5 — SAVE ITEMS TO DATABASE
      await apiRequest(`/api/cl/${clId}`, {
        method: "PUT",
        body: JSON.stringify({ items: itemsPayload }),
      });

      // STEP 6 — SUBMIT CL WITH REMARKS
      await apiRequest(`/api/cl/${clId}/submit`, {
        method: "POST",
        body: JSON.stringify({ remarks }),
      });

      showAlertModal('Success', `CL Created + Saved + Submitted.\nCL ID: ${clId}`, 'success');
      setTimeout(() => window.location.href = "/supervisor", 2000);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to start CL.");
    } finally {
      setLoading(false);
    }
  }

  // ===============================
  // HANDLE EMPLOYEE CARD CLICK – OPEN MODAL
  // ===============================
  function handleEmployeeClick(emp) {
    setSelectedEmployeeId(emp.id);
    setEmployeeInfo(emp);
    setRemarks("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelectedEmployeeId("");
    setEmployeeInfo(null);
    setCompetencies([]);
    setClHistory([]);
    setRemarks("");
    setError("");
  }

  async function handleCLClick(clId) {
    try {
      setClDetailsLoading(true);
      setShowCLDetailsModal(true);
      setSelectedCLDetails(null);

      const data = await apiRequest(`/api/cl/${clId}`, { method: 'GET' });
      setSelectedCLDetails(data);
    } catch (e) {
      console.error(e);
      showAlertModal('Error', 'Failed to load CL details.', 'error');
    } finally {
      setClDetailsLoading(false);
    }
  }

  function closeCLDetailsModal() {
    setShowCLDetailsModal(false);
    setSelectedCLDetails(null);
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex justify-between mb-6 items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Start Competency Leveling
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Select an employee to view their competencies and previous CL
              records.
            </p>
          </div>
          <button
            onClick={() => (window.location.href = "/supervisor")}
            className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
          >
            ← Back
          </button>
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 mb-4 rounded-md">
            {error}
          </p>
        )}

        {/* EMPLOYEE CREW (Cards) */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              Select an Employee to Start Competency Leveling
            </h2>
            
            {/* View Toggle Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded transition ${
                  viewMode === "grid"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title="Grid View"
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded transition ${
                  viewMode === "list"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title="List View"
              >
                <ListBulletIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="mb-4 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, employee ID, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              {searchQuery ? "No employees found matching your search." : "No employees with competencies found."}
            </p>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredEmployees.map((emp) => {
                const latest = emp.latestCL;
                const latestDate = latest?.created_at
                  ? new Date(latest.created_at).toLocaleDateString()
                  : null;

                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleEmployeeClick(emp)}
                    className="relative border border-slate-200 border-l-4 border-l-blue-500 rounded-sm pl-3 pr-4 py-4 text-left shadow-sm transition
                      flex gap-3 items-start bg-white hover:shadow-md hover:-translate-y-0.5"
                  >
                    {/* Avatar / Icon */}
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5.5 20.5a7 7 0 0113 0M12 12a4 4 0 100-8 4 4 0 000 8z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Text content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-sm truncate text-slate-800">
                          {emp.name}
                        </div>
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {emp.employee_id}
                        </span>
                      </div>

                      {emp.position_title && (
                        <div className="text-xs text-slate-700 mt-1">
                          {emp.position_title}
                        </div>
                      )}

                      {emp.department_name && (
                        <div className="text-[11px] text-slate-500">
                          {emp.department_name}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {emp.historyCount || 0} CL record(s)
                        </span>

                        {latest?.status ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            Latest: {latest.status}
                            {latestDate ? ` • ${latestDate}` : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            No CL yet
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500">
                        Click to view competencies and history
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEmployees.map((emp) => {
                const latest = emp.latestCL;
                const latestDate = latest?.created_at
                  ? new Date(latest.created_at).toLocaleDateString()
                  : null;

                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleEmployeeClick(emp)}
                    className="w-full border border-slate-200 border-l-4 border-l-blue-500 rounded-sm pl-3 pr-4 py-3 text-left shadow-sm transition
                      flex gap-3 items-center bg-white hover:shadow-md hover:bg-slate-50"
                  >
                    {/* Avatar / Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5.5 20.5a7 7 0 0113 0M12 12a4 4 0 100-8 4 4 0 000 8z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Main Content - Horizontal Layout */}
                    <div className="flex-1 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-sm text-slate-800">
                              {emp.name}
                            </div>
                            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {emp.employee_id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {emp.position_title && (
                              <span className="text-xs text-slate-700">
                                {emp.position_title}
                              </span>
                            )}
                            {emp.department_name && (
                              <>
                                <span className="text-slate-400">•</span>
                                <span className="text-xs text-slate-500">
                                  {emp.department_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Tags */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                          {emp.historyCount || 0} CL record(s)
                        </span>

                        {latest?.status ? (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 whitespace-nowrap">
                            Latest: {latest.status}
                            {latestDate ? ` • ${latestDate}` : ""}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                            No CL yet
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-slate-100/80 backdrop-blur-sm"
              onClick={closeModal}
            />

            <div className="relative z-50 bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    Competency Leveling Details
                  </h2>
                  {employeeInfo && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {employeeInfo.name}{" "}
                      {employeeInfo.employee_id &&
                        `• ${employeeInfo.employee_id}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={closeModal}
                  className="text-slate-500 hover:text-slate-700 text-xl leading-none px-2 py-1 rounded-full hover:bg-slate-100"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
                {/* Employee Info */}
                {employeeInfo && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <h3 className="text-sm font-semibold mb-1 text-slate-700">
                      Employee Information
                    </h3>
                    <p className="text-sm text-slate-700">
                      <strong>Name:</strong> {employeeInfo.name}
                    </p>
                    <p className="text-sm text-slate-700">
                      <strong>Position:</strong>{" "}
                      {employeeInfo.position_title || "N/A"}
                    </p>
                    <p className="text-sm text-slate-700">
                      <strong>Department:</strong>{" "}
                      {employeeInfo.department_name || "N/A"}
                    </p>
                  </div>
                )}

                {/* Past / Existing CL History */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <h3 className="text-sm font-semibold mb-2 text-slate-700">
                    Past / Existing Competency Leveling
                  </h3>

                  {historyLoading && (
                    <p className="text-xs text-slate-500">Loading history...</p>
                  )}

                  {!historyLoading && clHistory.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No previous competency leveling records found.
                    </p>
                  )}

                  {!historyLoading && clHistory.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="px-2 py-1 text-left">CL ID</th>
                            <th className="px-2 py-1 text-left">Cycle</th>
                            <th className="px-2 py-1 text-left">Status</th>
                            <th className="px-2 py-1 text-left">Date</th>
                            <th className="px-2 py-1 text-left">Score</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {clHistory.map((cl) => (
                            <tr
                              key={cl.id}
                              onClick={() => handleCLClick(cl.id)}
                              className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition"
                            >
                              <td className="px-2 py-1 text-blue-600 font-medium">{cl.id}</td>
                              <td className="px-2 py-1 text-slate-700">
                                {cl.cycle_name || cl.cycle_id || "-"}
                              </td>
                              <td className="px-2 py-1 text-slate-700">
                                {cl.status || "-"}
                              </td>
                              <td className="px-2 py-1 text-slate-700">
                                {cl.created_at
                                  ? new Date(cl.created_at).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td className="px-2 py-1 text-slate-700">
                                {cl.total_score != null ? cl.total_score : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-[11px] text-slate-500 mt-2 italic">
                        💡 Click on any row to view full details
                      </p>
                    </div>
                  )}
                </div>

                {/* Competency Table */}
                {competencies.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <h3 className="text-sm font-semibold mb-2 text-slate-700">
                      Competency Assessment
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                        <thead className="bg-slate-100 uppercase text-[11px] text-slate-700">
                          <tr>
                            <th className="px-2 py-1 text-left min-w-[150px]">Competency</th>
                            <th className="px-2 py-1 w-20">Weight</th>
                            <th className="px-2 py-1 w-16">MPLR</th>
                            <th className="px-2 py-1 w-16">Level</th>
                            <th className="px-2 py-1 w-20">Score</th>
                            <th className="px-2 py-1 text-left min-w-[200px]">
                              Comments (Justification / Trainings / Certificates, Etc)
                            </th>
                            <th className="px-2 py-1 min-w-[150px]">Upload PDF</th>
                          </tr>
                        </thead>

                        <tbody className="bg-white">
                          {competencies.map((c, i) => (
                            <tr
                              key={c.competency_id}
                              className="border-t border-slate-100"
                            >
                              <td className="px-2 py-1 text-slate-800">
                                {c.name}
                              </td>

                              <td className="px-2 py-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  placeholder="%"
                                  className="border border-slate-200 px-1 py-0.5 w-16 rounded text-xs text-slate-800"
                                  value={c.weight}
                                  onChange={(e) =>
                                    updateCompetency(
                                      i,
                                      "weight",
                                      e.target.value
                                    )
                                  }
                                  required
                                />
                              </td>

                              <td className="px-2 py-1 text-slate-700">
                                {c.mplr}
                              </td>

                              <td className="px-2 py-1">
                                <select
                                  className="border border-slate-200 px-1 py-0.5 rounded text-xs text-slate-800 bg-white"
                                  value={c.assigned_level}
                                  onChange={(e) =>
                                    updateCompetency(
                                      i,
                                      "assigned_level",
                                      e.target.value
                                    )
                                  }
                                >
                                  {[1, 2, 3, 4, 5].map((lvl) => (
                                    <option key={lvl} value={lvl}>
                                      {lvl}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="px-2 py-1 font-semibold text-blue-600">
                                {Number(c.final_score || 0).toFixed(2)}
                              </td>

                              <td className="px-2 py-1">
                                <textarea
                                  className="border border-slate-200 px-1 py-0.5 w-full rounded text-xs text-slate-800 resize-y min-h-[60px]"
                                  placeholder="Enter comments, justification, trainings, certificates, etc."
                                  onChange={(e) =>
                                    updateCompetency(
                                      i,
                                      "justification",
                                      e.target.value
                                    )
                                  }
                                />
                              </td>

                              <td className="px-2 py-1">
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="text-[11px] text-slate-600"
                                  onChange={(e) =>
                                    updateCompetency(
                                      i,
                                      "pdf",
                                      e.target.files[0]
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="mt-3 text-xs text-slate-700">
                      <strong>Total Final Score:</strong>{" "}
                      {totalFinalScore.toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Remarks */}
                {competencies.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <label className="block text-xs font-medium mb-1 text-slate-700">
                      Remarks for Next Reviewer
                    </label>
                    <textarea
                      className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows="3"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add any notes or context for the next reviewer..."
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-md text-slate-700 bg-white hover:bg-slate-100"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  disabled={loading || competencies.length === 0}
                  onClick={validateAndConfirmStart}
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 shadow-sm"
                >
                  {loading ? "Processing..." : "Start Competency Leveling"}
                </button>
              </div>
            </div>
          </div>
        )}

        <Modal
          isOpen={modal.isOpen}
          onClose={closeAlertModal}
          onConfirm={modal.onConfirm}
          title={modal.title}
          message={modal.message}
          type={modal.type}
          isConfirm={modal.isConfirm}
        />

        {/* CL Details Modal */}
        {showCLDetailsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={closeCLDetailsModal}
            />

            <div className="relative z-50 bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-800">
                  Competency Leveling Details {selectedCLDetails?.id ? `(CL #${selectedCLDetails.id})` : ''}
                </h3>
                <button
                  onClick={closeCLDetailsModal}
                  className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {clDetailsLoading && (
                  <div className="text-center py-8 text-gray-500">
                    Loading CL details...
                  </div>
                )}

                {!clDetailsLoading && !selectedCLDetails && (
                  <div className="text-center py-8 text-gray-500">
                    No details available.
                  </div>
                )}

                {!clDetailsLoading && selectedCLDetails && (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">CL ID:</span>
                          <span className="ml-2 font-medium text-gray-800">{selectedCLDetails.id}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Employee:</span>
                          <span className="ml-2 font-medium text-gray-800">{selectedCLDetails.employee_name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Supervisor:</span>
                          <span className="ml-2 font-medium text-gray-800">{selectedCLDetails.supervisor_name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <span className="ml-2 font-medium text-blue-600">{selectedCLDetails.status}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Department:</span>
                          <span className="ml-2 font-medium text-gray-800">{selectedCLDetails.department_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Score:</span>
                          <span className="ml-2 font-medium text-green-600">{selectedCLDetails.total_score || 'N/A'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-600">Created:</span>
                          <span className="ml-2 font-medium text-gray-800">
                            {selectedCLDetails.created_at ? new Date(selectedCLDetails.created_at).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Competency Items */}
                    {selectedCLDetails.items && selectedCLDetails.items.length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 p-4 border-b border-gray-200">Competency Assessment Items</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Competency</th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Weight (%)</th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">MPLR</th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Level</th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Score</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Comments (Justification / Trainings / Certificates, Etc)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {selectedCLDetails.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-800">{item.competency_name || 'N/A'}</td>
                                  <td className="px-4 py-3 text-center text-gray-700">{item.weight || 0}%</td>
                                  <td className="px-4 py-3 text-center text-gray-700">{item.mplr || 'N/A'}</td>
                                  <td className="px-4 py-3 text-center font-medium text-blue-600">{item.assigned_level || 'N/A'}</td>
                                  <td className="px-4 py-3 text-center font-semibold text-green-600">
                                    {((item.weight / 100) * item.assigned_level).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 text-xs">{item.justification || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Remarks */}
                    {selectedCLDetails.remarks && (
                      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Remarks</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedCLDetails.remarks}</p>
                      </div>
                    )}

                    {/* Decisions */}
                    {(selectedCLDetails.hr_decision || selectedCLDetails.manager_decision) && (
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Review Decisions</h4>
                        <div className="space-y-2 text-sm">
                          {selectedCLDetails.hr_decision && (
                            <div>
                              <span className="text-gray-600">HR Decision:</span>
                              <span className="ml-2 font-medium text-gray-800">{selectedCLDetails.hr_decision}</span>
                              {selectedCLDetails.hr_remarks && (
                                <p className="mt-1 text-xs text-gray-600 ml-4">💬 {selectedCLDetails.hr_remarks}</p>
                              )}
                            </div>
                          )}
                          {selectedCLDetails.manager_decision && (
                            <div>
                              <span className="text-gray-600">Manager Decision:</span>
                              <span className="ml-2 font-medium text-gray-800">{selectedCLDetails.manager_decision}</span>
                              {selectedCLDetails.manager_remarks && (
                                <p className="mt-1 text-xs text-gray-600 ml-4">💬 {selectedCLDetails.manager_remarks}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button
                  onClick={closeCLDetailsModal}
                  className="px-4 py-2 text-sm rounded-md bg-gray-600 text-white hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StartCLPage;
