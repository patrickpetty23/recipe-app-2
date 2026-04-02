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
      'SELECT id, recipe_id, name, quantity, unit, notes, checked, sort_order FROM ingredients WHERE recipe_id = ? ORDER BY sort_order',
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
    sortOrder: row.sort_order,
  };
}
