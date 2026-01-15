// src/utils/exportUtils.js
// Centralized export utilities for PDF and CSV generation.
// Consolidates export logic from multiple review pages.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { displayStatus } from '../constants/statusConstants';

/**
 * Export CL data to CSV format
 * @param {Object} cl - CL object with items array
 * @param {Object} options - Export options
 * @returns {void} - Downloads CSV file
 */
export function exportCLToCSV(cl, options = {}) {
  if (!cl || !cl.items || cl.items.length === 0) {
    console.warn('No CL data to export');
    return;
  }

  const {
    filename = `CL-${cl.id}-${new Date().toISOString().split('T')[0]}.csv`,
    includeHeader = true,
  } = options;

  let csv = '\uFEFF'; // BOM for proper UTF-8 encoding in Excel

  if (includeHeader) {
    csv += 'CL ID,Cycle,Status,Total Score\n';
    csv += `${cl.id},"${cl.cycle_name || cl.cycle_id || ''}",${displayStatus(cl.status)},${cl.total_score || ''}\n\n`;
  }

  csv += 'Competency,Weight (%),Level,Score,Comments\n';

  cl.items.forEach((item) => {
    const score = ((item.weight || 0) / 100) * (item.assigned_level || 0);
    csv += `"${(item.competency_name || '').replace(/"/g, '""')}",${item.weight || 0},${item.assigned_level || ''},${score.toFixed(2)},"${(item.justification || '').replace(/"/g, '""')}"\n`;
  });

  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export CL data to PDF format
 * @param {Object} cl - CL object with items array
 * @param {Object} options - Export options
 * @returns {void} - Downloads PDF file
 */
export function exportCLToPDF(cl, options = {}) {
  if (!cl || !cl.items || cl.items.length === 0) {
    console.warn('No CL data to export');
    return;
  }

  const {
    filename = `CL-${cl.id}-${new Date().toISOString().split('T')[0]}.pdf`,
    title = 'Competency Leveling Form',
    includeEmployeeInfo = false,
    employeeName = '',
    employeeId = '',
  } = options;

  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  // CL Info
  doc.setFontSize(10);
  let yPos = 25;
  
  doc.text(`CL ID: ${cl.id}`, 14, yPos);
  yPos += 7;
  
  if (includeEmployeeInfo && employeeName) {
    doc.text(`Employee: ${employeeName}`, 14, yPos);
    yPos += 7;
  }
  
  if (includeEmployeeInfo && employeeId) {
    doc.text(`Employee ID: ${employeeId}`, 14, yPos);
    yPos += 7;
  }
  
  doc.text(`Cycle: ${cl.cycle_name || cl.cycle_id || ''}`, 14, yPos);
  yPos += 7;
  doc.text(`Status: ${displayStatus(cl.status)}`, 14, yPos);
  yPos += 7;
  doc.text(`Total Score: ${cl.total_score != null ? Number(cl.total_score).toFixed(2) : ''}`, 14, yPos);
  yPos += 9;

  // Table data
  const tableData = cl.items.map((item) => [
    item.competency_name || '',
    item.weight || 0,
    item.assigned_level || '',
    (((item.weight || 0) / 100) * (item.assigned_level || 0)).toFixed(2),
    item.justification || '',
  ]);

  autoTable(doc, {
    head: [['Competency', 'Weight (%)', 'Level', 'Score', 'Comments']],
    body: tableData,
    startY: yPos,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    bodyStyles: {
      textColor: [0, 0, 0],
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 'auto' },
    },
  });

  doc.save(filename);
}

/**
 * Export IDP data to CSV format
 * @param {Object} idp - IDP object with activities array
 * @param {Object} options - Export options
 * @returns {void} - Downloads CSV file
 */
export function exportIDPToCSV(idp, options = {}) {
  if (!idp) {
    console.warn('No IDP data to export');
    return;
  }

  const {
    filename = `IDP-${idp.id}-${new Date().toISOString().split('T')[0]}.csv`,
  } = options;

  let csv = '\uFEFF'; // BOM for proper UTF-8 encoding

  // Header info
  csv += 'IDP ID,Employee,Cycle,Status\n';
  csv += `${idp.id},"${idp.employee_name || ''}","${idp.cycle_name || ''}",${displayStatus(idp.status)}\n\n`;

  // Activities
  if (idp.activities && idp.activities.length > 0) {
    csv += 'Type,Description,Target Start,Target End,Actual Start,Actual End,Status,Score,Remarks\n';
    
    idp.activities.forEach((activity) => {
      csv += `"${activity.development_type || ''}","${(activity.description || '').replace(/"/g, '""')}",${activity.target_start_date || ''},${activity.target_end_date || ''},${activity.actual_start_date || ''},${activity.actual_end_date || ''},"${activity.completion_status || ''}",${activity.supervisor_score || ''},"${(activity.supervisor_remarks || '').replace(/"/g, '""')}"\n`;
    });
  }

  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export IDP data to PDF format
 * @param {Object} idp - IDP object with activities array
 * @param {Object} options - Export options
 * @returns {void} - Downloads PDF file
 */
export function exportIDPToPDF(idp, options = {}) {
  if (!idp) {
    console.warn('No IDP data to export');
    return;
  }

  const {
    filename = `IDP-${idp.id}-${new Date().toISOString().split('T')[0]}.pdf`,
    title = 'Individual Development Plan',
  } = options;

  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  // IDP Info
  doc.setFontSize(10);
  doc.text(`IDP ID: ${idp.id}`, 14, 25);
  doc.text(`Employee: ${idp.employee_name || ''}`, 14, 32);
  doc.text(`Cycle: ${idp.cycle_name || ''}`, 14, 39);
  doc.text(`Status: ${displayStatus(idp.status)}`, 14, 46);

  // Activities table
  if (idp.activities && idp.activities.length > 0) {
    const tableData = idp.activities.map((activity) => [
      activity.development_type || '',
      activity.description || '',
      activity.target_start_date || '',
      activity.target_end_date || '',
      activity.completion_status || '',
      activity.supervisor_score || '',
    ]);

    autoTable(doc, {
      head: [['Type', 'Description', 'Start', 'End', 'Status', 'Score']],
      body: tableData,
      startY: 55,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [241, 245, 249],
      },
    });
  }

  doc.save(filename);
}

/**
 * Generic table export to CSV
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Column definitions [{key, header}]
 * @param {string} filename - Output filename
 */
export function exportTableToCSV(data, columns, filename) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  let csv = '\uFEFF'; // BOM

  // Header row
  csv += columns.map((col) => `"${col.header}"`).join(',') + '\n';

  // Data rows
  data.forEach((row) => {
    csv += columns.map((col) => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',') + '\n';
  });

  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Helper function to trigger file download
 * @param {string} content - File content
 * @param {string} filename - Output filename
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export default {
  exportCLToCSV,
  exportCLToPDF,
  exportIDPToCSV,
  exportIDPToPDF,
  exportTableToCSV,
};
