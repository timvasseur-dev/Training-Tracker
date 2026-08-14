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
    db.execSync('ALTER TABLE strength_sets ADD COLUMN sort_order INTEGER;');
  } catch (e) {
    // la colonne existe déjà, rien à faire
  }
  db.execSync('UPDATE strength_sets SET sort_order = id WHERE sort_order IS NULL;');
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
  return db.getAllSync<{ date: string; note: string }>('SELECT * FROM session_notes;');
}

// Garantit que la table existe dès l'import du module, avant même que
// l'effect d'init du layout racine ne se déclenche (les effects enfants
// s'exécutent avant ceux du parent, donc un écran peut requêter avant lui).
initDatabase();
