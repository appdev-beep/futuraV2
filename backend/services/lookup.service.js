// src/services/lookup.service.js

// If db.js is at src/config/db.js:
const { db } = require('../config/db');

// If your db.js is somewhere else (e.g., src/db.js),
// change the path accordingly:
// const { db } = require('../db');

/**
 * Get all departments for dropdowns
 * Returns: [{ id, name, description, has_am }]
 */
async function getDepartments() {
  const [rows] = await db.query(
    `
    SELECT
      id,
      name,
      description,
      has_am
    FROM departments
    ORDER BY name ASC
    `
  );

  return rows;
}

/**
 * Get all active positions for dropdowns
 * Returns: [{ id, title, department_id }]
 */
async function getPositions() {
  const [rows] = await db.query(
    `
    SELECT
      id,
      title,
      department_id
    FROM positions
    WHERE is_active = 1
    ORDER BY title ASC
    `
  );

  return rows;
}

/**
 * Get competencies for lookups (CL / IDP, etc.)
 * Returns: [{ id, name, competency_area, description, category }]
 */
async function getCompetencies() {
  const [rows] = await db.query(
    `
    SELECT
      id,
      name,
      competency_area,
      description,
      category
    FROM competencies
    ORDER BY name ASC
    `
  );

  return rows;
}

/**
 * Get appraisal cycles
 *
 * NOTE: Your schema snippet above doesn't include an appraisal_cycles table yet.
 * This implementation assumes a table like:
 *
 *   appraisal_cycles (
 *     id INT PK,
 *     name VARCHAR(150),
 *     start_date DATETIME,
 *     end_date DATETIME,
 *     is_active BOOLEAN
 *   )
 *
 * Adjust the table / column names to match your actual DB.
 */
async function getAppraisalCycles() {
  const [rows] = await db.query(
    `
    SELECT
      id,
      name,
      start_date,
      end_date,
      is_active
    FROM appraisal_cycles
    WHERE is_active = 1
    ORDER BY start_date DESC
    `
  );

  return rows;
}

/**
 * Get supervisors by department for dropdowns
 * Returns: [{ id, name, email }]
 */
async function getSupervisorsByDepartment(departmentId) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      name,
      email
    FROM users
    WHERE department_id = ? 
      AND role = 'Supervisor'
      AND is_active = 1
    ORDER BY name ASC
    `,
    [departmentId]
  );

  return rows;
}

/**
 * Get managers by department for dropdowns
 * Returns: [{ id, name, email }]
 */
async function getManagersByDepartment(departmentId) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      name,
      email
    FROM users
    WHERE department_id = ? 
      AND role = 'Manager'
      AND is_active = 1
    ORDER BY name ASC
    `,
    [departmentId]
  );

  return rows;
}

/**
 * Get assistant managers by department for dropdowns
 * Returns: [{ id, name, email }]
 */
async function getAMsByDepartment(departmentId) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      name,
      email
    FROM users
    WHERE department_id = ? 
      AND role = 'AM'
      AND is_active = 1
    ORDER BY name ASC
    `,
    [departmentId]
  );

  return rows;
}

/**
 * Get review periods used for IDP reviewPeriod dropdown
 * Returns: [{ id, name }]
 */
async function getReviewPeriods() {
  try {
    const [rows] = await db.query(
      `
      SELECT id, name
      FROM cycles
      WHERE is_active = 1
      ORDER BY id ASC
      `
    );
    // Return rows as array of objects {id, name}
    return rows;
  } catch (err) {
    console.warn('Warning: getReviewPeriods failed, returning empty list', err.message || err);
    return [];
  }
}

/**
 * Add a new review period
 */
async function addReviewPeriod(name) {
  const [result] = await db.query(
    `INSERT INTO cycles (name, is_active, start_date, end_date) VALUES (?, 1, NOW(), NULL)`,
    [name]
  );
  return { id: result.insertId, name };
}

module.exports = {
  getDepartments,
  getPositions,
  getCompetencies,
  getAppraisalCycles,
  getSupervisorsByDepartment,
  getManagersByDepartment,
  getAMsByDepartment,
  getReviewPeriods,
  addReviewPeriod
};

