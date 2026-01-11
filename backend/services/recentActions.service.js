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
  let sql = `SELECT id, module, title, description, url, created_at
             FROM recent_actions
             WHERE actor_id = ?`;
  const params = [actorId];
  if (module && (module === 'CL' || module === 'IDP')) {
    sql += ' AND module = ?';
    params.push(module);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));

  const [rows] = await db.query(sql, params);
  return rows || [];
}

module.exports = { logRecentAction, getRecentActions };
