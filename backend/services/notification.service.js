// backend/services/notification.service.js

const { db } = require("../config/db"); 

async function createNotification({ recipient_id, message, module = "Competency Leveling" }) {
  if (!recipient_id) return;

  try {
    const [result] = await db.query(
      `INSERT INTO notifications (recipient_id, message, module, status, created_at)
       VALUES (?, ?, ?, 'Unread', NOW())`,
      [recipient_id, message, module]
    );
    return result;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

module.exports = { createNotification };
