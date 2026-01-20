const { db } = require('../config/db');

async function logRecentAction({
  actor_id,
  module = 'CL',
  action_type,
  cl_id = null,
  employee_id = null,
  title,
  description = null,
  url = null,
}) {
  await db.query(
    `INSERT INTO recent_actions
      (actor_id, module, action_type, cl_id, employee_id, title, description, url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [actor_id, module, action_type, cl_id, employee_id, title, description, url]
  );
}

async function getRecentActions(actorId, limit = 20, module = null) {
  // Get user role to determine if they should see department-wide recent actions
  const [userRows] = await db.query(
    `SELECT role, department_id FROM users WHERE id = ?`,
    [actorId]
  );
  
  const user = userRows[0];
  if (!user) {
    return [];
  }

  let sql = '';
  let params = [];

  // If user is Manager, show Manager, AM, HR actions; if AM, show only AM and HR actions
  if (user.role === 'Manager') {
    sql = `
      SELECT ra.id, ra.module, ra.title, ra.description, ra.url, ra.created_at, 
             u.name as actor_name, u.role as actor_role
      FROM recent_actions ra
      JOIN users u ON ra.actor_id = u.id
      WHERE (ra.actor_id = ? OR (u.department_id = ? AND u.role IN ('Manager', 'AM', 'HR')))
    `;
    params = [actorId, user.department_id];
  } else if (user.role === 'AM') {
    sql = `
      SELECT ra.id, ra.module, ra.title, ra.description, ra.url, ra.created_at, 
             u.name as actor_name, u.role as actor_role
      FROM recent_actions ra
      JOIN users u ON ra.actor_id = u.id
      WHERE (ra.actor_id = ? OR (u.department_id = ? AND u.role IN ('AM', 'HR')))
    `;
    params = [actorId, user.department_id];
  } else if (user.role === 'HR') {
    sql = `
      SELECT ra.id, ra.module, ra.title, ra.description, ra.url, ra.created_at, 
             u.name as actor_name, u.role as actor_role
      FROM recent_actions ra
      JOIN users u ON ra.actor_id = u.id
      WHERE (ra.actor_id = ? OR (u.department_id = ? AND u.role IN ('AM', 'HR')))
    `;
    params = [actorId, user.department_id];
  } else {
    // For other roles, just show their own actions
    sql = `
      SELECT ra.id, ra.module, ra.title, ra.description, ra.url, ra.created_at,
             u.name as actor_name, u.role as actor_role
      FROM recent_actions ra
      JOIN users u ON ra.actor_id = u.id
      WHERE ra.actor_id = ?
    `;
    params = [actorId];
  }

  if (module && (module === 'CL' || module === 'IDP')) {
    sql += ' AND ra.module = ?';
    params.push(module);
  }
  sql += ' ORDER BY ra.created_at DESC LIMIT ?';
  params.push(Number(limit));

  const [rows] = await db.query(sql, params);
  return rows || [];
}

module.exports = { logRecentAction, getRecentActions };
