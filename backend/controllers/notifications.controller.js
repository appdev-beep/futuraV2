// backend/controllers/notifications.controller.js
const { db } = require('../config/db');

// GET /api/notifications
async function getMyNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const [rows] = await db.query(
      `SELECT id, recipient_id, message, module, status, read_at, created_at
       FROM notifications
       WHERE recipient_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    // Your frontend expects: id, title, url, created_at
    // DB has only: message/module. So we map them and determine the correct URL
    const mapped = rows.map((n) => {
      // Extract CL ID from message (format: "CL #123 for...")
      const clIdMatch = n.message?.match(/CL #(\d+)/);
      const clId = clIdMatch ? clIdMatch[1] : null;
      
      // Determine URL based on user role and CL ID
      let url = '/';
      if (clId) {
        switch(userRole) {
          case 'Supervisor':
            url = `/cl/supervisor/review/${clId}`;
            break;
          case 'Manager':
            url = `/cl/submissions/${clId}`;
            break;
          case 'Employee':
            url = `/cl/employee/review/${clId}`;
            break;
          case 'AM':
            url = `/cl/am/review/${clId}`;
            break;
          case 'HR':
          case 'Admin':
            url = `/cl/hr/review/${clId}`;
            break;
          default:
            url = `/${userRole.toLowerCase()}`;
        }
      } else {
        // Fallback to dashboard if no CL ID found
        switch(userRole) {
          case 'Supervisor':
            url = '/supervisor';
            break;
          case 'Manager':
            url = '/manager';
            break;
          case 'Employee':
            url = '/employee';
            break;
          case 'AM':
            url = '/am';
            break;
          case 'HR':
          case 'Admin':
            url = '/hr';
            break;
          default:
            url = '/';
        }
      }

      return {
        id: n.id,
        title: n.module || 'Notification',
        url: url,
        created_at: n.created_at,
        message: n.message,
        module: n.module,
        status: n.status,
        read_at: n.read_at,
      };
    });

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

module.exports = { getMyNotifications, markAsRead };
