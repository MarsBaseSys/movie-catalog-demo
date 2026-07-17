const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const seedAdmin = require('./seed');
const { loadUser, requireAuth, requireAdmin, requirePermission } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

seedAdmin();

const app = express();
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'movie-catalog-demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use(loadUser);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', authRoutes);
app.use('/api/users', requireAuth, requireAdmin, userRoutes);

app.get('/movies', requireAuth, requirePermission('can_view'), (req, res) => {
  const movies = db.prepare('SELECT * FROM movies').all();
  res.json(movies);
});

app.get('/movies/:id', requireAuth, requirePermission('can_view'), (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  res.json(movie);
});

app.post('/movies', requireAuth, requirePermission('can_add'), (req, res) => {
  const { title, year, genre } = req.body;
  if (!title || !year || !genre) {
    return res.status(400).json({ error: 'title, year and genre are required' });
  }

  const { lastInsertRowid } = db
    .prepare('INSERT INTO movies (title, year, genre) VALUES (?, ?, ?)')
    .run(title, year, genre);
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(lastInsertRowid);
  res.status(201).json(movie);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Movie catalog API listening on port ${PORT}`);
});
