// src/pages/StartCLPage.jsx
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
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
      alert("Only Supervisors, AM, Manager, or HR can start CL.");
      window.location.href = "/";
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
            const weight = 0;
            const score = (weight / 100) * assignedLevel;

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

  const totalFinalScore = useMemo(() => {
    return competencies.reduce((s, c) => s + (Number(c.final_score) || 0), 0);
  }, [competencies]);

  // ===============================
  // START CL (WITH PDF UPLOAD)
  // ===============================
  async function handleStartCL() {
    if (!selectedEmployeeId) return setError("Please select an employee.");
    if (!employeeInfo) return setError("Employee data not loaded.");

    setLoading(true);
    setError("");

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
          const formData = new FormData();
          formData.append("file", comp.pdf);

          const res = await fetch(`${API_BASE_URL}/api/cl/upload`, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          uploadedFiles[comp.competency_id] = data.filePath;
        }
      }

      // STEP 4 — MERGE DB ITEMS + REACT STATE INTO A PAYLOAD
      const itemsPayload = dbItems.map((item) => {
        const comp = competencies.find(
          (c) => Number(c.competency_id) === Number(item.competency_id)
        );

        return {
          id: item.id,
          assigned_level: Number(comp.assigned_level),
          weight: Number(comp.weight),
          justification: comp.justification || "",
          pdf_path: uploadedFiles[comp.competency_id] || null,
        };
      });

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

      alert(`CL Created + Saved + Submitted.\nCL ID: ${clId}`);
      window.location.href = "/supervisor";
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

        {/* Employee Selection Grid */}
        <div className="mb-6">
          <h2 className="block mb-2 text-sm font-medium text-slate-700">
            Select Employee
          </h2>

          {employees.length === 0 && (
            <p className="text-sm text-slate-500">
              No employees found with competency setup for your department.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {employees.map((emp) => {
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

                    {/* ✅ NEW: show past/present CL summary on card */}
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
                          <tr key={cl.id} className="border-t border-slate-100">
                            <td className="px-2 py-1 text-slate-700">{cl.id}</td>
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
                  )}
                </div>

                {/* Competency Table */}
                {competencies.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <h3 className="text-sm font-semibold mb-2 text-slate-700">
                      Competency Assessment
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-slate-200 rounded-md overflow-hidden">
                        <thead className="bg-slate-100 uppercase text-[11px] text-slate-700">
                          <tr>
                            <th className="px-2 py-1 text-left">Competency</th>
                            <th className="px-2 py-1">Weight</th>
                            <th className="px-2 py-1">MPLR</th>
                            <th className="px-2 py-1">Level</th>
                            <th className="px-2 py-1">Score</th>
                            <th className="px-2 py-1 text-left">
                              Justification
                            </th>
                            <th className="px-2 py-1">Upload PDF</th>
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
                                  className="border border-slate-200 px-1 py-0.5 w-16 rounded text-xs text-slate-800"
                                  value={c.weight}
                                  onChange={(e) =>
                                    updateCompetency(
                                      i,
                                      "weight",
                                      e.target.value
                                    )
                                  }
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
                                <input
                                  type="text"
                                  className="border border-slate-200 px-1 py-0.5 w-full rounded text-xs text-slate-800"
                                  placeholder="Enter justification"
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
                  onClick={handleStartCL}
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 shadow-sm"
                >
                  {loading ? "Processing..." : "Start Competency Leveling"}
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
