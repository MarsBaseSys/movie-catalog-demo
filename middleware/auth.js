const db = require('../db');

function loadUser(req, res, next) {
  if (req.session && req.session.userId) {
    const user = db
      .prepare('SELECT id, username, role, can_view, can_add, disabled FROM users WHERE id = ?')
      .get(req.session.userId);
    if (user && !user.disabled) {
      req.user = user;
    } else {
      req.session.destroy(() => {});
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

function requirePermission(flag) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role === 'admin' || req.user[flag]) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

module.exports = { loadUser, requireAuth, requireAdmin, requirePermission };
