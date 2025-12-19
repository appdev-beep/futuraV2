// backend/controllers/notifications.controller.js
const { db } = require('../config/db');

// GET /api/notifications
async function getMyNotifications(req, res, next) {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT id, recipient_id, message, module, status, read_at, created_at
       FROM notifications
       WHERE recipient_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    // Your frontend expects: id, title, url, created_at
    // DB has only: message/module. So we map them.
    const mapped = rows.map((n) => ({
      id: n.id,
      title: n.module || 'Notification',
      url: '/supervisor',          // ✅ default (you can improve later)
      created_at: n.created_at,
      message: n.message,
      module: n.module,
      status: n.status,
      read_at: n.read_at,
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notifications/:id/read
async function markAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const notifId = Number(req.params.id);
    if (!notifId) return res.status(400).json({ message: 'Invalid notification id' });

    // ensure user owns it
    const [rows] = await db.query(
      `SELECT id FROM notifications WHERE id = ? AND recipient_id = ? LIMIT 1`,
      [notifId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await db.query(
      `UPDATE notifications
       SET status = 'Read', read_at = NOW()
       WHERE id = ?`,
      [notifId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notifications/mark-all-read
async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.id;

    await db.query(
      `UPDATE notifications
       SET status = 'Read', read_at = NOW()
       WHERE recipient_id = ? AND status = 'Unread'`,
      [userId]
    );

    res.json({ ok: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyNotifications, markAsRead, markAllAsRead };
