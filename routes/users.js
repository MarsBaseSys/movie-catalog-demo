const express = require('express');
const db = require('../db');
const { hashPassword } = require('../auth');

const router = express.Router();

router.get('/', (req, res) => {
  const users = db
    .prepare('SELECT id, username, role, can_view, can_add, disabled, locked_until FROM users')
    .all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { username, password, role, can_view, can_add } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const finalRole = role === 'admin' ? 'admin' : 'user';
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  const { salt, hash } = hashPassword(password);
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO users (username, password_hash, salt, role, can_view, can_add) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(username, hash, salt, finalRole, can_view ? 1 : 0, can_add ? 1 : 0);
  const user = db
    .prepare('SELECT id, username, role, can_view, can_add, disabled, locked_until FROM users WHERE id = ?')
    .get(lastInsertRowid);
  res.status(201).json(user);
});

router.patch('/:id', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { can_view, can_add, disabled } = req.body;

  if (disabled === true) {
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }
    if (target.role === 'admin') {
      const activeAdminCount = db
        .prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND disabled = 0")
        .get().c;
      if (activeAdminCount <= 1) {
        return res.status(400).json({ error: 'Cannot disable the last active admin' });
      }
    }
  }

  const nextDisabled = disabled === undefined ? target.disabled : disabled ? 1 : 0;
  const clearingLock = disabled === false;

  db.prepare(
    'UPDATE users SET can_view = ?, can_add = ?, disabled = ?, failed_attempts = ?, locked_until = ? WHERE id = ?'
  ).run(
    can_view === undefined ? target.can_view : can_view ? 1 : 0,
    can_add === undefined ? target.can_add : can_add ? 1 : 0,
    nextDisabled,
    clearingLock ? 0 : target.failed_attempts,
    clearingLock ? null : target.locked_until,
    target.id
  );
  const updated = db
    .prepare('SELECT id, username, role, can_view, can_add, disabled, locked_until FROM users WHERE id = ?')
    .get(target.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (target.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last remaining admin' });
    }
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.status(204).end();
});

module.exports = router;
