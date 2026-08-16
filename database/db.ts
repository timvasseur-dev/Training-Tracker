import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('training-tracker.db');

export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS strength_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise TEXT NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      date TEXT NOT NULL,
      sort_order INTEGER
    );
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS session_notes (
      date TEXT PRIMARY KEY,
      note TEXT
    );
  `);
  try {
    db.execSync('ALTER TABLE session_notes ADD COLUMN duration_min REAL;');
  } catch (e) {}
  try {
    db.execSync('ALTER TABLE session_notes ADD COLUMN training_load REAL;');
  } catch (e) {}
  db.execSync(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      distance_km REAL NOT NULL,
      duration_min REAL NOT NULL,
      avg_hr INTEGER,
      vo2max REAL,
      cadence INTEGER,
      calories INTEGER,
      training_load REAL,
      note TEXT,
      sort_order INTEGER
    );
  `);
  try {
    db.execSync('ALTER TABLE runs ADD COLUMN cadence INTEGER;');
  } catch (e) {}
  try {
    db.execSync('ALTER TABLE runs ADD COLUMN calories INTEGER;');
  } catch (e) {}
  try {
    db.execSync('ALTER TABLE runs ADD COLUMN training_load REAL;');
  } catch (e) {}
  try {
    db.execSync('ALTER TABLE runs ADD COLUMN note TEXT;');
  } catch (e) {}
  try {
    db.execSync('ALTER TABLE runs ADD COLUMN health_connect_id TEXT;');
  } catch (e) {}
  try {
    db.execSync('ALTER TABLE strength_sets ADD COLUMN sort_order INTEGER;');
  } catch (e) {
    // la colonne existe déjà, rien à faire
  }
  db.execSync('UPDATE strength_sets SET sort_order = id WHERE sort_order IS NULL;');
  db.execSync(`
    CREATE TABLE IF NOT EXISTS crossfit_wods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      duration_min REAL,
      training_load REAL,
      note TEXT,
      sort_order INTEGER
    );
  `);
}

export type StrengthSet = {
  id: number;
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  sort_order: number;
};

export function addSet(exercise: string, weight: number, reps: number, date: string) {
  const row = db.getFirstSync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM strength_sets WHERE exercise = ? AND date = ?;',
    [exercise, date]
  );
  const nextOrder = (row?.maxOrder ?? 0) + 1;
  db.runSync(
    'INSERT INTO strength_sets (exercise, weight, reps, date, sort_order) VALUES (?, ?, ?, ?, ?);',
    [exercise, weight, reps, date, nextOrder]
  );
}

export function updateSet(id: number, weight: number, reps: number) {
  db.runSync('UPDATE strength_sets SET weight = ?, reps = ? WHERE id = ?;', [weight, reps, id]);
}

export function deleteSet(id: number) {
  db.runSync('DELETE FROM strength_sets WHERE id = ?;', [id]);
}

export function deleteSetsForDate(date: string) {
  db.runSync('DELETE FROM strength_sets WHERE date = ?;', [date]);
}

export function moveSet(id: number, direction: 'up' | 'down') {
  const current = db.getFirstSync<StrengthSet>('SELECT * FROM strength_sets WHERE id = ?;', [id]);
  if (!current) return;
  const comparator = direction === 'up' ? '<' : '>';
  const orderBy = direction === 'up' ? 'DESC' : 'ASC';
  const neighbor = db.getFirstSync<StrengthSet>(
    `SELECT * FROM strength_sets WHERE exercise = ? AND date = ? AND sort_order ${comparator} ? ORDER BY sort_order ${orderBy} LIMIT 1;`,
    [current.exercise, current.date, current.sort_order]
  );
  if (!neighbor) return;
  db.runSync('UPDATE strength_sets SET sort_order = ? WHERE id = ?;', [neighbor.sort_order, current.id]);
  db.runSync('UPDATE strength_sets SET sort_order = ? WHERE id = ?;', [current.sort_order, neighbor.id]);
}

export function getSetsForExercise(exercise: string) {
  return db.getAllSync<StrengthSet>(
    'SELECT * FROM strength_sets WHERE exercise = ? ORDER BY date DESC, sort_order ASC;',
    [exercise]
  );
}

export function getAllSets() {
  return db.getAllSync<StrengthSet>(
    'SELECT * FROM strength_sets ORDER BY date DESC, exercise ASC, sort_order ASC;'
  );
}

export function saveNoteForDate(date: string, note: string) {
  if (note.trim() === '') {
    db.runSync('DELETE FROM session_notes WHERE date = ?;', [date]);
  } else {
    db.runSync(
      'INSERT INTO session_notes (date, note) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET note = excluded.note;',
      [date, note]
    );
  }
}

export function getAllNotes() {
  return db.getAllSync<{ date: string; note: string; duration_min: number | null; training_load: number | null }>(
    'SELECT * FROM session_notes;'
  );
}

export function saveSessionLoadForDate(date: string, durationMin: number | null, trainingLoad: number | null) {
  db.runSync(
    'INSERT INTO session_notes (date, duration_min, training_load) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET duration_min = excluded.duration_min, training_load = excluded.training_load;',
    [date, durationMin, trainingLoad]
  );
}

export function addRun(date: string, distanceKm: number, durationMin: number, avgHr: number | null, vo2max: number | null, cadence: number | null, calories: number | null, trainingLoad: number | null, note: string | null) {
  const row = db.getFirstSync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM runs WHERE date = ?;',
    [date]
  );
  const nextOrder = (row?.maxOrder ?? 0) + 1;
  db.runSync(
    'INSERT INTO runs (date, distance_km, duration_min, avg_hr, vo2max, cadence, calories, training_load, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [date, distanceKm, durationMin, avgHr, vo2max, cadence, calories, trainingLoad, note, nextOrder]
  );
}

export function updateRun(id: number, distanceKm: number, durationMin: number, avgHr: number | null, vo2max: number | null, cadence: number | null, calories: number | null, trainingLoad: number | null, note: string | null) {
  db.runSync(
    'UPDATE runs SET distance_km = ?, duration_min = ?, avg_hr = ?, vo2max = ?, cadence = ?, calories = ?, training_load = ?, note = ? WHERE id = ?;',
    [distanceKm, durationMin, avgHr, vo2max, cadence, calories, trainingLoad, note, id]
  );
}

export function deleteRun(id: number) {
  db.runSync('DELETE FROM runs WHERE id = ?;', [id]);
}

export function getAllRuns() {
  return db.getAllSync('SELECT * FROM runs ORDER BY date DESC, sort_order DESC;');
}

export function addWod(date: string, name: string, durationMin: number | null, trainingLoad: number | null, note: string | null) {
  const row = db.getFirstSync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM crossfit_wods WHERE date = ?;',
    [date]
  );
  const nextOrder = (row?.maxOrder ?? 0) + 1;
  db.runSync(
    'INSERT INTO crossfit_wods (date, name, duration_min, training_load, note, sort_order) VALUES (?, ?, ?, ?, ?, ?);',
    [date, name, durationMin, trainingLoad, note, nextOrder]
  );
}

export function updateWod(id: number, name: string, durationMin: number | null, trainingLoad: number | null, note: string | null) {
  db.runSync(
    'UPDATE crossfit_wods SET name = ?, duration_min = ?, training_load = ?, note = ? WHERE id = ?;',
    [name, durationMin, trainingLoad, note, id]
  );
}

export function deleteWod(id: number) {
  db.runSync('DELETE FROM crossfit_wods WHERE id = ?;', [id]);
}

export function getAllWods() {
  return db.getAllSync('SELECT * FROM crossfit_wods ORDER BY date DESC, sort_order DESC;');
}

export function runExistsByHealthConnectId(hcId: string) {
  const row = db.getFirstSync('SELECT id FROM runs WHERE health_connect_id = ?;', [hcId]);
  return row != null;
}

export function addRunFromHealthConnect(date: string, distanceKm: number, durationMin: number, avgHr: number | null, calories: number | null, hcId: string) {
  const row = db.getFirstSync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM runs WHERE date = ?;',
    [date]
  );
  const nextOrder = (row?.maxOrder ?? 0) + 1;
  db.runSync(
    'INSERT INTO runs (date, distance_km, duration_min, avg_hr, calories, health_connect_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?);',
    [date, distanceKm, durationMin, avgHr, calories, hcId, nextOrder]
  );
}

// Garantit que la table existe dès l'import du module, avant même que
// l'effect d'init du layout racine ne se déclenche (les effects enfants
// s'exécutent avant ceux du parent, donc un écran peut requêter avant lui).
initDatabase();
