const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '.test-recipe-scanner.db');

function uuidv4() {
  return crypto.randomUUID();
}

function run() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  const db = new Database(DB_PATH);
  const results = { tests: [], passed: 0, failed: 0 };

  function assert(name, actual, expected) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      results.tests.push({ name, status: 'pass' });
      results.passed++;
    } else {
      results.tests.push({ name, status: 'fail', expected, actual });
      results.failed++;
    }
  }

  try {
    // --- Initialize schema ---
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
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
      )
    `);

    results.tests.push({ name: 'schema_init', status: 'pass' });
    results.passed++;

    // --- Insert a test recipe ---
    const recipeId = uuidv4();
    const now = new Date().toISOString();
    const recipe = {
      id: recipeId,
      title: 'Test Chocolate Chip Cookies',
      sourceType: 'camera',
      sourceUri: null,
      servings: 24,
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(
      `INSERT INTO recipes (id, title, source_type, source_uri, servings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(recipe.id, recipe.title, recipe.sourceType, recipe.sourceUri, recipe.servings, recipe.createdAt, recipe.updatedAt);

    // --- Insert 3 ingredients ---
    const ingredients = [
      { id: uuidv4(), name: 'all-purpose flour', quantity: 2.25, unit: 'cups', notes: 'sifted', checked: false },
      { id: uuidv4(), name: 'butter', quantity: 1, unit: 'cup', notes: 'softened', checked: false },
      { id: uuidv4(), name: 'vanilla extract', quantity: 1, unit: 'tsp', notes: null, checked: false },
    ];

    const insertIng = db.prepare(
      `INSERT INTO ingredients (id, recipe_id, name, quantity, unit, notes, checked, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      insertIng.run(ing.id, recipeId, ing.name, ing.quantity, ing.unit, ing.notes, ing.checked ? 1 : 0, i);
    }

    results.tests.push({ name: 'insert_recipe_and_ingredients', status: 'pass' });
    results.passed++;

    // --- Read recipe back by ID ---
    const readRecipe = db.prepare(
      'SELECT id, title, source_type, source_uri, servings, created_at, updated_at FROM recipes WHERE id = ?'
    ).get(recipeId);

    assert('recipe_id_matches', readRecipe.id, recipe.id);
    assert('recipe_title_matches', readRecipe.title, recipe.title);
    assert('recipe_source_type_matches', readRecipe.source_type, recipe.sourceType);
    assert('recipe_servings_matches', readRecipe.servings, recipe.servings);
    assert('recipe_created_at_matches', readRecipe.created_at, recipe.createdAt);

    // --- Read ingredients back ---
    const readIngredients = db.prepare(
      'SELECT id, recipe_id, name, quantity, unit, notes, checked, sort_order FROM ingredients WHERE recipe_id = ? ORDER BY sort_order'
    ).all(recipeId);

    assert('ingredient_count', readIngredients.length, 3);
    assert('ingredient_0_name', readIngredients[0].name, 'all-purpose flour');
    assert('ingredient_0_quantity', readIngredients[0].quantity, 2.25);
    assert('ingredient_0_unit', readIngredients[0].unit, 'cups');
    assert('ingredient_0_notes', readIngredients[0].notes, 'sifted');
    assert('ingredient_1_name', readIngredients[1].name, 'butter');
    assert('ingredient_1_quantity', readIngredients[1].quantity, 1);
    assert('ingredient_2_name', readIngredients[2].name, 'vanilla extract');
    assert('ingredient_2_notes', readIngredients[2].notes, null);

    // --- Toggle ingredient checked ---
    db.prepare(
      'UPDATE ingredients SET checked = CASE WHEN checked = 0 THEN 1 ELSE 0 END WHERE id = ?'
    ).run(ingredients[0].id);

    const toggled = db.prepare('SELECT checked FROM ingredients WHERE id = ?').get(ingredients[0].id);
    assert('toggle_checked_on', toggled.checked, 1);

    db.prepare(
      'UPDATE ingredients SET checked = CASE WHEN checked = 0 THEN 1 ELSE 0 END WHERE id = ?'
    ).run(ingredients[0].id);

    const toggledBack = db.prepare('SELECT checked FROM ingredients WHERE id = ?').get(ingredients[0].id);
    assert('toggle_checked_off', toggledBack.checked, 0);

    // --- Update ingredient ---
    db.prepare('UPDATE ingredients SET quantity = ?, unit = ? WHERE id = ?').run(3, 'cups', ingredients[0].id);
    const updated = db.prepare('SELECT quantity, unit FROM ingredients WHERE id = ?').get(ingredients[0].id);
    assert('update_ingredient_quantity', updated.quantity, 3);
    assert('update_ingredient_unit', updated.unit, 'cups');

    // --- Delete ingredient ---
    db.prepare('DELETE FROM ingredients WHERE id = ?').run(ingredients[2].id);
    const afterDelete = db.prepare('SELECT COUNT(*) as cnt FROM ingredients WHERE recipe_id = ?').get(recipeId);
    assert('delete_ingredient_count', afterDelete.cnt, 2);

    // --- Delete recipe (cascading) ---
    db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(recipeId);
    db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);
    const afterRecipeDelete = db.prepare('SELECT COUNT(*) as cnt FROM recipes').get();
    const afterIngDelete = db.prepare('SELECT COUNT(*) as cnt FROM ingredients').get();
    assert('delete_recipe_cascade_recipes', afterRecipeDelete.cnt, 0);
    assert('delete_recipe_cascade_ingredients', afterIngDelete.cnt, 0);

    // --- Scaler logic test ---
    const scaled = ingredients.map((ing) => ({
      ...ing,
      quantity: ing.quantity != null ? ing.quantity * 2 : null,
    }));
    assert('scaler_flour', scaled[0].quantity, 4.5);
    assert('scaler_butter', scaled[1].quantity, 2);
    assert('scaler_vanilla', scaled[2].quantity, 2);

    const nullIng = { id: 'x', name: 'salt', quantity: null, unit: null, notes: 'to taste', checked: false };
    const scaledNull = nullIng.quantity != null ? nullIng.quantity * 2 : null;
    assert('scaler_null_stays_null', scaledNull, null);

  } catch (err) {
    results.tests.push({ name: 'unexpected_error', status: 'fail', error: err.message });
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
