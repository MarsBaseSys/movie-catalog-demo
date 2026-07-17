const db = require('./db');
const { hashPassword } = require('./auth');

function seedAdmin() {
  const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
  if (adminCount > 0) return;
  const { salt, hash } = hashPassword('admin');
  db.prepare(
    'INSERT INTO users (username, password_hash, salt, role, can_view, can_add) VALUES (?, ?, ?, ?, 1, 1)'
  ).run('admin', hash, salt, 'admin');
  console.log('Seeded default admin user (admin/admin)');
}

module.exports = seedAdmin;
