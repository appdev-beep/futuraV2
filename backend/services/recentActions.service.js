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

async function getRecentActions(actorId, limit = 20) {
  const [rows] = await db.query(
    `SELECT id, title, description, url, created_at
     FROM recent_actions
     WHERE actor_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [actorId, Number(limit)]
  );
  return rows || [];
}

module.exports = { logRecentAction, getRecentActions };
