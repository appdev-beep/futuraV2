// src/pages/StartCLPage.jsx
import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

function StartCLPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supervisorRoles = ["Supervisor", "AM", "Manager", "HR"];

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
  // LOAD EMPLOYEES
  // ===============================
  useEffect(() => {
    if (!currentUser) return;

    async function loadEmployees() {
      try {
        const data = await apiRequest("/api/users", { method: "GET" });

        const filtered = data.filter(
          (u) =>
            u.role === "Employee" &&
            Number(u.department_id) === Number(currentUser.department_id)
        );

        setEmployees(filtered);
      } catch (e) {
        console.error(e);
        setError("Failed to load employees.");
      }
    }

    loadEmployees();
  }, [currentUser]);

  // ===============================
  // LOAD COMPETENCIES
  // ===============================
  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeInfo(null);
      setCompetencies([]);
      return;
    }

    async function load() {
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

    load();
  }, [selectedEmployeeId]);

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

  const totalFinalScore = competencies.reduce(
    (s, c) => s + (Number(c.final_score) || 0),
    0
  );

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

          const res = await fetch("http://localhost:4000/api/cl/upload", {
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

      // STEP 6 — SUBMIT CL
      await apiRequest(`/api/cl/${clId}/submit`, { method: "POST" });

      alert(`CL Created + Saved + Submitted.\nCL ID: ${clId}`);
      window.location.href = "/supervisor";
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to start CL.");
    } finally {
      setLoading(false);
    }
  }

  if (!currentUser) return null;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Start Competency Leveling</h1>
        <button
          onClick={() => (window.location.href = "/supervisor")}
          className="px-4 py-2 border rounded"
        >
          ← Back
        </button>
      </div>

      {error && (
        <p className="bg-red-100 border border-red-300 text-red-700 p-3 mb-4 rounded">
          {error}
        </p>
      )}

      {/* Employee Selection */}
      <label className="block mb-1 text-sm font-medium">Select Employee</label>
      <select
        className="border px-3 py-2 rounded w-full mb-6"
        value={selectedEmployeeId}
        onChange={(e) => setSelectedEmployeeId(e.target.value)}
      >
        <option value="">-- Choose Employee --</option>
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.name} ({emp.employee_id})
          </option>
        ))}
      </select>

      {/* Employee Info */}
      {employeeInfo && (
        <div className="bg-white shadow rounded p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Employee Information</h2>
          <p><strong>Name:</strong> {employeeInfo.name}</p>
          <p><strong>Position:</strong> {employeeInfo.position_title}</p>
          <p><strong>Department:</strong> {employeeInfo.department_name}</p>
        </div>
      )}

      {/* Competency Table */}
      {competencies.length > 0 && (
        <div className="bg-white shadow rounded p-4 mb-6 overflow-x-auto">
          <h2 className="text-lg font-semibold mb-3">Competency Assessment</h2>

          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 uppercase text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Competency</th>
                <th className="px-3 py-2">Weight</th>
                <th className="px-3 py-2">MPLR</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Justification</th>
                <th className="px-3 py-2">Upload PDF</th>
              </tr>
            </thead>

            <tbody>
              {competencies.map((c, i) => (
                <tr key={c.competency_id} className="border-t">
                  <td className="px-3 py-2">{c.name}</td>

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="border px-2 py-1 w-20"
                      value={c.weight}
                      onChange={(e) =>
                        updateCompetency(i, "weight", e.target.value)
                      }
                    />
                  </td>

                  <td className="px-3 py-2">{c.mplr}</td>

                  <td className="px-3 py-2">
                    <select
                      className="border px-2 py-1"
                      value={c.assigned_level}
                      onChange={(e) =>
                        updateCompetency(i, "assigned_level", e.target.value)
                      }
                    >
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-3 py-2 font-semibold text-blue-600">
                    {c.final_score.toFixed(2)}
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="text"
                      className="border px-2 py-1 w-full"
                      placeholder="Enter justification"
                      onChange={(e) =>
                        updateCompetency(i, "justification", e.target.value)
                      }
                    />
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) =>
                        updateCompetency(i, "pdf", e.target.files[0])
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-4 text-gray-700">
            <strong>Total Final Score:</strong>{" "}
            {totalFinalScore.toFixed(2)}
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        disabled={loading}
        onClick={handleStartCL}
        className="px-6 py-2 bg-blue-700 text-white rounded disabled:opacity-50"
      >
        {loading ? "Processing..." : "Start Competency Leveling"}
      </button>
    </div>
  );
}

export default StartCLPage;
