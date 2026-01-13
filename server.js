const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ items: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    const backup = DB_PATH.replace(/\.json$/, `-corrupt-${Date.now()}.json`);
    fs.writeFileSync(backup, raw);
    const fresh = { items: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function newId() {
  return Math.random().toString(16).slice(2, 10) + '-' + Date.now().toString(16);
}

function nowIso() {
  return new Date().toISOString();
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/contacts', (req, res) => {
  const db = readDb();
  res.json({ items: db.items || [] });
});

app.post('/api/contacts', (req, res) => {
  const db = readDb();
  const payload = req.body || {};

  const item = {
    id: newId(),
    ...payload,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.items = [item, ...(db.items || [])];
  writeDb(db);

  res.status(201).json(item);
});

app.put('/api/contacts/:id', (req, res) => {
  const db = readDb();
  const id = req.params.id;
  const idx = (db.items || []).findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const payload = req.body || {};
  const existing = db.items[idx];

  db.items[idx] = {
    ...existing,
    ...payload,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };
  writeDb(db);

  res.json(db.items[idx]);
});

app.delete('/api/contacts/:id', (req, res) => {
  const db = readDb();
  const id = req.params.id;
  const before = (db.items || []).length;
  db.items = (db.items || []).filter(x => x.id !== id);
  if (db.items.length === before) return res.status(404).json({ error: 'Not found' });
  writeDb(db);
  res.json({ ok: true });
});

app.delete('/api/contacts/_all', (req, res) => {
  const db = readDb();
  db.items = [];
  writeDb(db);
  res.json({ ok: true });
});



app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('ContactCRM running at http://localhost:' + PORT);
});
