import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('training-tracker.db');

export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS strength_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise TEXT NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      date TEXT NOT NULL
    );
  `);
}

export type StrengthSet = {
  id: number;
  exercise: string;
  weight: number;
  reps: number;
  date: string;
};

export function addSet(exercise: string, weight: number, reps: number, date: string) {
  db.runSync(
    'INSERT INTO strength_sets (exercise, weight, reps, date) VALUES (?, ?, ?, ?);',
    [exercise, weight, reps, date]
  );
}

export function getSetsForExercise(exercise: string) {
  return db.getAllSync<StrengthSet>(
    'SELECT * FROM strength_sets WHERE exercise = ? ORDER BY date DESC;',
    [exercise]
  );
}

export function updateSet(id: number, weight: number, reps: number) {
  db.runSync('UPDATE strength_sets SET weight = ?, reps = ? WHERE id = ?;', [weight, reps, id]);
}

export function deleteSet(id: number) {
  db.runSync('DELETE FROM strength_sets WHERE id = ?;', [id]);
}

// Garantit que la table existe dès l'import du module, avant même que
// l'effect d'init du layout racine ne se déclenche (les effects enfants
// s'exécutent avant ceux du parent, donc un écran peut requêter avant lui).
initDatabase();
