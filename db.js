const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'movies.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    genre TEXT NOT NULL
  )
`);

module.exports = db;
