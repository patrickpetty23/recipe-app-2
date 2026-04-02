import { getDatabase } from './schema';
import { logger } from '../utils/logger';

export function saveRecipe(recipe) {
  logger.info('queries.saveRecipe', { id: recipe.id, title: recipe.title });
  try {
    const db = getDatabase();
    db.runSync(
      `INSERT INTO recipes (id, title, source_type, source_uri, servings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      recipe.id,
      recipe.title,
      recipe.sourceType,
      recipe.sourceUri ?? null,
      recipe.servings,
      recipe.createdAt,
      recipe.updatedAt
    );
    logger.info('queries.saveRecipe.success', { id: recipe.id });
  } catch (err) {
    logger.error('queries.saveRecipe.error', { id: recipe.id, error: err.message });
    throw err;
  }
}

export function getAllRecipes() {
  logger.info('queries.getAllRecipes', {});
  try {
    const db = getDatabase();
    const rows = db.getAllSync(
      'SELECT id, title, source_type, source_uri, servings, created_at, updated_at FROM recipes ORDER BY created_at DESC'
    );
    const recipes = rows.map(mapRecipeRow);
    logger.info('queries.getAllRecipes.success', { count: recipes.length });
    return recipes;
  } catch (err) {
    logger.error('queries.getAllRecipes.error', { error: err.message });
    throw err;
  }
}

export function getRecipeById(id) {
  logger.info('queries.getRecipeById', { id });
  try {
    const db = getDatabase();
    const row = db.getFirstSync(
      'SELECT id, title, source_type, source_uri, servings, created_at, updated_at FROM recipes WHERE id = ?',
      id
    );
    if (!row) {
      logger.info('queries.getRecipeById.notFound', { id });
      return null;
    }
    const recipe = mapRecipeRow(row);
    const ingredientRows = db.getAllSync(
      'SELECT id, recipe_id, name, quantity, unit, notes, checked, in_list, sort_order FROM ingredients WHERE recipe_id = ? ORDER BY sort_order',
      id
    );
    recipe.ingredients = ingredientRows.map(mapIngredientRow);
    logger.info('queries.getRecipeById.success', { id, ingredientCount: recipe.ingredients.length });
    return recipe;
  } catch (err) {
    logger.error('queries.getRecipeById.error', { id, error: err.message });
    throw err;
  }
}

export function updateRecipe(id, fields) {
  logger.info('queries.updateRecipe', { id, fields: Object.keys(fields) });
  try {
    const db = getDatabase();
    const allowed = ['title', 'servings'];
    const columnMap = { title: 'title', servings: 'servings' };
    const setClauses = [];
    const values = [];
    for (const key of allowed) {
      if (key in fields) {
        setClauses.push(`${columnMap[key]} = ?`);
        values.push(fields[key]);
      }
    }
    if (setClauses.length === 0) return;
    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    db.runSync(
      `UPDATE recipes SET ${setClauses.join(', ')} WHERE id = ?`,
      ...values
    );
    logger.info('queries.updateRecipe.success', { id });
  } catch (err) {
    logger.error('queries.updateRecipe.error', { id, error: err.message });
    throw err;
  }
}

export function deleteRecipe(id) {
  logger.info('queries.deleteRecipe', { id });
  try {
    const db = getDatabase();
    db.runSync('DELETE FROM ingredients WHERE recipe_id = ?', id);
    db.runSync('DELETE FROM recipes WHERE id = ?', id);
    logger.info('queries.deleteRecipe.success', { id });
  } catch (err) {
    logger.error('queries.deleteRecipe.error', { id, error: err.message });
    throw err;
  }
}

export function saveIngredients(recipeId, ingredients) {
  logger.info('queries.saveIngredients', { recipeId, count: ingredients.length });
  try {
    const db = getDatabase();
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      db.runSync(
        `INSERT INTO ingredients (id, recipe_id, name, quantity, unit, notes, checked, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ing.id,
        recipeId,
        ing.name,
        ing.quantity ?? null,
        ing.unit ?? null,
        ing.notes ?? null,
        ing.checked ? 1 : 0,
        i
      );
    }
    logger.info('queries.saveIngredients.success', { recipeId, count: ingredients.length });
  } catch (err) {
    logger.error('queries.saveIngredients.error', { recipeId, error: err.message });
    throw err;
  }
}

export function updateIngredient(id, fields) {
  logger.info('queries.updateIngredient', { id, fields: Object.keys(fields) });
  try {
    const db = getDatabase();
    const allowed = ['name', 'quantity', 'unit', 'notes', 'checked', 'sort_order'];
    const columnMap = {
      name: 'name',
      quantity: 'quantity',
      unit: 'unit',
      notes: 'notes',
      checked: 'checked',
      sort_order: 'sort_order',
    };
    const setClauses = [];
    const values = [];
    for (const key of allowed) {
      if (key in fields) {
        setClauses.push(`${columnMap[key]} = ?`);
        values.push(key === 'checked' ? (fields[key] ? 1 : 0) : fields[key]);
      }
    }
    if (setClauses.length === 0) return;
    values.push(id);
    db.runSync(
      `UPDATE ingredients SET ${setClauses.join(', ')} WHERE id = ?`,
      ...values
    );
    logger.info('queries.updateIngredient.success', { id });
  } catch (err) {
    logger.error('queries.updateIngredient.error', { id, error: err.message });
    throw err;
  }
}

export function deleteIngredient(id) {
  logger.info('queries.deleteIngredient', { id });
  try {
    const db = getDatabase();
    db.runSync('DELETE FROM ingredients WHERE id = ?', id);
    logger.info('queries.deleteIngredient.success', { id });
  } catch (err) {
    logger.error('queries.deleteIngredient.error', { id, error: err.message });
    throw err;
  }
}

export function toggleIngredientChecked(id) {
  logger.info('queries.toggleIngredientChecked', { id });
  try {
    const db = getDatabase();
    db.runSync(
      'UPDATE ingredients SET checked = CASE WHEN checked = 0 THEN 1 ELSE 0 END WHERE id = ?',
      id
    );
    logger.info('queries.toggleIngredientChecked.success', { id });
  } catch (err) {
    logger.error('queries.toggleIngredientChecked.error', { id, error: err.message });
    throw err;
  }
}

export function getShoppingListIngredients() {
  logger.info('queries.getShoppingListIngredients', {});
  try {
    const db = getDatabase();
    const rows = db.getAllSync(
      `SELECT i.id, i.recipe_id, i.name, i.quantity, i.unit, i.notes, i.checked, i.in_list, i.sort_order, r.title AS recipe_title
       FROM ingredients i
       JOIN recipes r ON r.id = i.recipe_id
       WHERE i.in_list = 1
       ORDER BY r.title, i.sort_order`
    );
    const items = rows.map((row) => ({
      ...mapIngredientRow(row),
      recipeTitle: row.recipe_title,
    }));
    logger.info('queries.getShoppingListIngredients.success', { count: items.length });
    return items;
  } catch (err) {
    logger.error('queries.getShoppingListIngredients.error', { error: err.message });
    throw err;
  }
}

export function addRecipeToList(recipeId) {
  logger.info('queries.addRecipeToList', { recipeId });
  try {
    const db = getDatabase();
    db.runSync('UPDATE ingredients SET in_list = 1 WHERE recipe_id = ?', recipeId);
    logger.info('queries.addRecipeToList.success', { recipeId });
  } catch (err) {
    logger.error('queries.addRecipeToList.error', { recipeId, error: err.message });
    throw err;
  }
}

export function removeRecipeFromList(recipeId) {
  logger.info('queries.removeRecipeFromList', { recipeId });
  try {
    const db = getDatabase();
    db.runSync('UPDATE ingredients SET in_list = 0, checked = 0 WHERE recipe_id = ?', recipeId);
    logger.info('queries.removeRecipeFromList.success', { recipeId });
  } catch (err) {
    logger.error('queries.removeRecipeFromList.error', { recipeId, error: err.message });
    throw err;
  }
}

export function clearCheckedItems() {
  logger.info('queries.clearCheckedItems', {});
  try {
    const db = getDatabase();
    db.runSync('UPDATE ingredients SET checked = 0 WHERE in_list = 1');
    logger.info('queries.clearCheckedItems.success', {});
  } catch (err) {
    logger.error('queries.clearCheckedItems.error', { error: err.message });
    throw err;
  }
}

export function clearShoppingList() {
  logger.info('queries.clearShoppingList', {});
  try {
    const db = getDatabase();
    db.runSync('UPDATE ingredients SET in_list = 0, checked = 0');
    logger.info('queries.clearShoppingList.success', {});
  } catch (err) {
    logger.error('queries.clearShoppingList.error', { error: err.message });
    throw err;
  }
}

function mapRecipeRow(row) {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    sourceUri: row.source_uri,
    servings: row.servings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIngredientRow(row) {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    notes: row.notes,
    checked: row.checked === 1,
    inList: row.in_list === 1,
    sortOrder: row.sort_order,
  };
}
