const express = require('express');
const db = require('../db');
const { verifyPassword, hashPassword } = require('../auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 4;
const LOCK_DURATION_MS = 2 * 60 * 60 * 1000;

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (user.disabled) {
    return res.status(403).json({ error: '该账号已被管理员禁用' });
  }

  const lockApplies = user.role !== 'admin';
  const now = Date.now();

  if (lockApplies && user.locked_until && user.locked_until > now) {
    const minutesLeft = Math.ceil((user.locked_until - now) / 60000);
    return res.status(403).json({ error: `登录失败次数过多，账号已被锁定，请 ${minutesLeft} 分钟后再试` });
  }

  if (lockApplies && user.locked_until && user.locked_until <= now) {
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    user.failed_attempts = 0;
    user.locked_until = null;
  }

  if (!verifyPassword(password, user.salt, user.password_hash)) {
    if (!lockApplies) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const attempts = user.failed_attempts + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = now + LOCK_DURATION_MS;
      db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
        attempts,
        lockedUntil,
        user.id
      );
      return res.status(403).json({ error: '密码连续输错次数过多，账号已被锁定 2 小时' });
    }
    db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, user.id);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
  req.session.userId = user.id;
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    can_view: user.role === 'admin' || !!user.can_view,
    can_add: user.role === 'admin' || !!user.can_add,
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    can_view: req.user.role === 'admin' || !!req.user.can_view,
    can_add: req.user.role === 'admin' || !!req.user.can_add,
  });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(currentPassword, user.salt, user.password_hash)) {
    return res.status(401).json({ error: '当前密码不正确' });
  }

  const { salt, hash } = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, user.id);
  res.status(204).end();
});

module.exports = router;
