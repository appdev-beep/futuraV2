// backend/services/notification.service.js

const db = require("../config/db"); 
// ^ use whatever you already use for DB queries (knex/sequelize/prisma/mysql2).
// Replace db.notifications.create(...) with your actual query style.

async function createNotification({ recipient_id, message, module = "Competency Leveling" }) {
  if (!recipient_id) return;

  // Example (pseudo) — change to your DB code:
  return db.notifications.create({
    data: {
      recipient_id,
      message,
      module,
      status: "Unread",
      created_at: new Date(),
    },
  });
}

module.exports = { createNotification };
