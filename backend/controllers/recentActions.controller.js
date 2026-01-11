// backend/controllers/recentActions.controller.js
const { getRecentActions: fetchRecentActions } = require('../services/recentActions.service');

async function getRecentActions(req, res, next) {
  try {
    const limit = Number(req.query.limit || 20);
    const module = req.query.module || null; // optional: 'CL' or 'IDP'

    const actorId = req.user?.id;
    if (!actorId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rows = await fetchRecentActions(actorId, limit, module);
    res.json(rows || []);
  } catch (err) {
    next(err);
  }
}

module.exports = { getRecentActions };
