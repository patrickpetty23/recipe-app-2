import * as SQLite from 'expo-sqlite';
import { logger } from '../utils/logger';

let db = null;

// Each migration silently skips if the column/table already exists.

function migrateAddInList(database) {
  try {
    database.execSync('ALTER TABLE ingredients ADD COLUMN in_list INTEGER NOT NULL DEFAULT 0');
    logger.info('schema.migrate', { migration: 'add_in_list_column' });
  } catch (err) {
    if (err.message && err.message.includes('duplicate column')) return;
    logger.error('schema.migrate.error', { migration: 'add_in_list_column', error: err.message });
  }
}

function migrateAddImageUri(database) {
  try {
    database.execSync('ALTER TABLE recipes ADD COLUMN image_uri TEXT');
    logger.info('schema.migrate', { migration: 'add_image_uri' });
  } catch (err) {
    if (err.message && err.message.includes('duplicate column')) return;
    logger.error('schema.migrate.error', { migration: 'add_image_uri', error: err.message });
  }
}

function migrateAddRecipeMetadata(database) {
  const columns = [
    { name: 'instructions', type: 'TEXT' },
    { name: 'prep_time', type: 'TEXT' },
    { name: 'cook_time', type: 'TEXT' },
    { name: 'cuisine', type: 'TEXT' },
    { name: 'source_url', type: 'TEXT' },
  ];
  for (const col of columns) {
    try {
      database.execSync(`ALTER TABLE recipes ADD COLUMN ${col.name} ${col.type}`);
      logger.info('schema.migrate', { migration: `add_${col.name}` });
    } catch (err) {
      if (err.message && err.message.includes('duplicate column')) continue;
      logger.error('schema.migrate.error', { migration: `add_${col.name}`, error: err.message });
    }
  }
}

export function getDatabase() {
  if (db) return db;

  logger.info('schema.getDatabase', { status: 'initializing' });

  db = SQLite.openDatabaseSync('recipe-scanner.db');
  db.execSync('PRAGMA journal_mode = WAL');
  db.execSync('PRAGMA foreign_keys = ON');

  // ── Core tables ──────────────────────────────────────────────────────────────

  db.execSync(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_uri TEXT,
      source_url TEXT,
      image_uri TEXT,
      servings INTEGER NOT NULL DEFAULT 1,
      instructions TEXT,
      prep_time TEXT,
      cook_time TEXT,
      cuisine TEXT,
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

  // ── Recipe steps ─────────────────────────────────────────────────────────────

  db.execSync(`
    CREATE TABLE IF NOT EXISTS recipe_steps (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      step_number INTEGER NOT NULL,
      instruction TEXT NOT NULL,
      illustration_url TEXT,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
  `);

  // ── Collections ───────────────────────────────────────────────────────────────

  db.execSync(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '📁',
      created_at TEXT NOT NULL
    )
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS recipe_collections (
      recipe_id TEXT NOT NULL,
      collection_id TEXT NOT NULL,
      PRIMARY KEY (recipe_id, collection_id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `);

  // ── Chat messages ─────────────────────────────────────────────────────────────

  db.execSync(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      image_uri TEXT,
      created_at TEXT NOT NULL,
      recipe_id TEXT
    )
  `);

  // ── Settings ──────────────────────────────────────────────────────────────────

  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // ── Migrations for existing installs ─────────────────────────────────────────

  migrateAddInList(db);
  migrateAddImageUri(db);
  migrateAddRecipeMetadata(db);

  // ── Indexes ───────────────────────────────────────────────────────────────────

  db.execSync(`CREATE INDEX IF NOT EXISTS idx_ingredients_in_list ON ingredients(in_list)`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe ON recipe_steps(recipe_id)`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_chat_messages_recipe ON chat_messages(recipe_id)`);

  logger.info('schema.getDatabase.success', { status: 'ready' });
  return db;
}
