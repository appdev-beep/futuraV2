// src/middleware/auth.middleware.js

// Placeholder – currently allows every request.
// Later: read JWT/session, validate, and attach req.user.
function requireAuth(req, res, next) {
  // TODO: implement real authentication and role handling
  next();
}

module.exports = { requireAuth };
