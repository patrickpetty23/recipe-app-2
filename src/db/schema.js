import * as SQLite from 'expo-sqlite';
import { logger } from '../utils/logger';

let db = null;

function migrateAddInList(database) {
  try {
    database.execSync('ALTER TABLE ingredients ADD COLUMN in_list INTEGER NOT NULL DEFAULT 0');
    logger.info('schema.migrate', { migration: 'add_in_list_column' });
  } catch (err) {
    if (err.message && err.message.includes('duplicate column')) {
      return;
    }
    logger.error('schema.migrate.error', { migration: 'add_in_list_column', error: err.message });
  }
}

export function getDatabase() {
  if (db) return db;

  logger.info('schema.getDatabase', { status: 'initializing' });

  db = SQLite.openDatabaseSync('recipe-scanner.db');
  db.execSync('PRAGMA journal_mode = WAL');
  db.execSync('PRAGMA foreign_keys = ON');

  db.execSync(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_uri TEXT,
      servings INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity REAL,
      unit TEXT,
      notes TEXT,
      checked INTEGER NOT NULL DEFAULT 0,
      in_list INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
  `);

  migrateAddInList(db);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_ingredients_in_list ON ingredients(in_list)
  `);

  logger.info('schema.getDatabase.success', { status: 'ready' });
  return db;
}
