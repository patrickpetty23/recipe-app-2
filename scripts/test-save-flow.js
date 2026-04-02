const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '.test-save-flow.db');

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
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
      )
    `);

    // Step 1: Create and save a recipe with 3 ingredients
    const recipeId = uuidv4();
    const now = new Date().toISOString();
    const recipe = {
      id: recipeId,
      title: 'Test Pasta Carbonara',
      sourceType: 'camera',
      sourceUri: null,
      servings: 4,
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(
      `INSERT INTO recipes (id, title, source_type, source_uri, servings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(recipe.id, recipe.title, recipe.sourceType, recipe.sourceUri, recipe.servings, recipe.createdAt, recipe.updatedAt);

    const ingredients = [
      { id: uuidv4(), name: 'spaghetti', quantity: 400, unit: 'g', notes: null },
      { id: uuidv4(), name: 'pancetta', quantity: 200, unit: 'g', notes: 'diced' },
      { id: uuidv4(), name: 'parmesan cheese', quantity: 1, unit: 'cup', notes: 'grated' },
    ];

    const insertIng = db.prepare(
      `INSERT INTO ingredients (id, recipe_id, name, quantity, unit, notes, checked, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      insertIng.run(ing.id, recipeId, ing.name, ing.quantity, ing.unit, ing.notes, 0, i);
    }

    check('step1_create_recipe', true, true);
    console.error('Step 1: Created recipe with 3 ingredients');

    // Step 2: Read it back by ID and confirm all fields match
    const readRecipe = db.prepare(
      'SELECT id, title, source_type, source_uri, servings, created_at, updated_at FROM recipes WHERE id = ?'
    ).get(recipeId);

    const readIngredients = db.prepare(
      'SELECT id, recipe_id, name, quantity, unit, notes, checked, sort_order FROM ingredients WHERE recipe_id = ? ORDER BY sort_order'
    ).all(recipeId);

    check('step2_recipe_id', readRecipe.id, recipe.id);
    check('step2_recipe_title', readRecipe.title, recipe.title);
    check('step2_recipe_source_type', readRecipe.source_type, recipe.sourceType);
    check('step2_recipe_servings', readRecipe.servings, recipe.servings);
    check('step2_ingredient_count', readIngredients.length, 3);
    check('step2_ingredient_0_name', readIngredients[0].name, 'spaghetti');
    check('step2_ingredient_0_quantity', readIngredients[0].quantity, 400);
    check('step2_ingredient_1_name', readIngredients[1].name, 'pancetta');
    check('step2_ingredient_1_notes', readIngredients[1].notes, 'diced');
    check('step2_ingredient_2_name', readIngredients[2].name, 'parmesan cheese');
    check('step2_ingredient_2_unit', readIngredients[2].unit, 'cup');
    console.error('Step 2: Read back recipe — all fields match');

    // Step 3: Update one ingredient name and confirm persistence
    const targetIngId = ingredients[1].id;
    db.prepare('UPDATE ingredients SET name = ? WHERE id = ?').run('guanciale', targetIngId);

    const updatedIng = db.prepare('SELECT name FROM ingredients WHERE id = ?').get(targetIngId);
    check('step3_update_name', updatedIng.name, 'guanciale');
    console.error('Step 3: Updated ingredient name — confirmed persisted');

    // Step 4: Delete the recipe and confirm it no longer exists
    db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(recipeId);
    db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);

    const deletedRecipe = db.prepare('SELECT id FROM recipes WHERE id = ?').get(recipeId);
    const deletedIngredients = db.prepare('SELECT id FROM ingredients WHERE recipe_id = ?').all(recipeId);

    check('step4_recipe_deleted', deletedRecipe, undefined);
    check('step4_ingredients_deleted', deletedIngredients.length, 0);
    console.error('Step 4: Deleted recipe — confirmed gone');

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
