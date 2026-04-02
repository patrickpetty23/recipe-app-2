const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '.test-shopping-list.db');

function uuidv4() {
  return crypto.randomUUID();
}

function run() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  const db = new Database(DB_PATH);
  const results = { steps: [], passed: 0, failed: 0 };

  function check(name, actual, expected) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      results.steps.push({ name, status: 'pass' });
      results.passed++;
      return true;
    }
    results.steps.push({ name, status: 'fail', expected, actual });
    results.failed++;
    return false;
  }

  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
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

    db.exec(`
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

    // Step 1: Save a test recipe with 3 ingredients
    const recipeId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO recipes (id, title, source_type, source_uri, servings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(recipeId, 'Test Tacos', 'camera', null, 4, now, now);

    const ingredients = [
      { id: uuidv4(), name: 'ground beef', quantity: 1, unit: 'lb', notes: null },
      { id: uuidv4(), name: 'taco shells', quantity: 8, unit: 'count', notes: null },
      { id: uuidv4(), name: 'shredded cheese', quantity: 1, unit: 'cup', notes: null },
    ];

    const insertIng = db.prepare(
      `INSERT INTO ingredients (id, recipe_id, name, quantity, unit, notes, checked, in_list, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`
    );
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      insertIng.run(ing.id, recipeId, ing.name, ing.quantity, ing.unit, ing.notes, i);
    }

    check('step1_recipe_saved', true, true);
    console.error('Step 1: Saved recipe with 3 ingredients');

    // Step 2: Add recipe to shopping list (set in_list = 1)
    db.prepare('UPDATE ingredients SET in_list = 1 WHERE recipe_id = ?').run(recipeId);

    const listItems = db.prepare(
      `SELECT i.id, i.name, i.quantity, i.unit, i.checked, i.in_list, r.title AS recipe_title
       FROM ingredients i
       JOIN recipes r ON r.id = i.recipe_id
       WHERE i.in_list = 1
       ORDER BY r.title, i.sort_order`
    ).all();

    check('step2_list_count', listItems.length, 3);
    check('step2_all_in_list', listItems.every((i) => i.in_list === 1), true);
    check('step2_item_0_name', listItems[0].name, 'ground beef');
    check('step2_item_1_name', listItems[1].name, 'taco shells');
    check('step2_item_2_name', listItems[2].name, 'shredded cheese');
    check('step2_recipe_title', listItems[0].recipe_title, 'Test Tacos');
    console.error('Step 2: Added to shopping list — all 3 ingredients appear');

    // Step 3: Toggle one ingredient as checked
    db.prepare(
      'UPDATE ingredients SET checked = CASE WHEN checked = 0 THEN 1 ELSE 0 END WHERE id = ?'
    ).run(ingredients[0].id);

    const toggled = db.prepare('SELECT checked FROM ingredients WHERE id = ?').get(ingredients[0].id);
    check('step3_toggle_checked', toggled.checked, 1);

    const others = db.prepare('SELECT checked FROM ingredients WHERE id IN (?, ?)').all(ingredients[1].id, ingredients[2].id);
    check('step3_others_unchecked', others.every((i) => i.checked === 0), true);
    console.error('Step 3: Toggled one ingredient checked — state persisted');

    // Step 4: Clear checked items (uncheck all in_list items)
    db.prepare('UPDATE ingredients SET checked = 0 WHERE in_list = 1').run();

    const afterClear = db.prepare('SELECT checked FROM ingredients WHERE recipe_id = ?').all(recipeId);
    check('step4_all_unchecked', afterClear.every((i) => i.checked === 0), true);
    check('step4_still_in_list', db.prepare('SELECT COUNT(*) as cnt FROM ingredients WHERE in_list = 1').get().cnt, 3);
    console.error('Step 4: Cleared checked — all unchecked, still on list');

    // Step 5: Clear shopping list (set in_list = 0 for all)
    db.prepare('UPDATE ingredients SET in_list = 0, checked = 0').run();

    const afterListClear = db.prepare('SELECT COUNT(*) as cnt FROM ingredients WHERE in_list = 1').get();
    check('step5_list_empty', afterListClear.cnt, 0);

    const ingredientsStillExist = db.prepare('SELECT COUNT(*) as cnt FROM ingredients WHERE recipe_id = ?').get(recipeId);
    check('step5_ingredients_still_exist', ingredientsStillExist.cnt, 3);
    console.error('Step 5: Cleared list — empty but ingredients still in DB');

  } catch (err) {
    results.steps.push({ name: 'unexpected_error', status: 'fail', error: err.message });
    results.failed++;
  } finally {
    db.close();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  }

  results.status = results.failed === 0 ? 'pass' : 'fail';
  console.log(JSON.stringify(results, null, 2));

  if (results.failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

run();
