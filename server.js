const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

app.get('/movies', (req, res) => {
  const movies = db.prepare('SELECT * FROM movies').all();
  res.json(movies);
});

app.get('/movies/:id', (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  res.json(movie);
});

app.post('/movies', (req, res) => {
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
