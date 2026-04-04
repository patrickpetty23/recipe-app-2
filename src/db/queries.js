import { getDatabase } from './schema';
import { logger } from '../utils/logger';

// ── Recipes ───────────────────────────────────────────────────────────────────

export function saveRecipe(recipe) {
  logger.info('queries.saveRecipe', { id: recipe.id, title: recipe.title });
  try {
    const db = getDatabase();
    db.runSync(
      `INSERT INTO recipes
         (id, title, source_type, source_uri, source_url, image_uri,
          servings, instructions, prep_time, cook_time, cuisine,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      recipe.id,
      recipe.title,
      recipe.sourceType,
      recipe.sourceUri ?? null,
      recipe.sourceUrl ?? null,
      recipe.imageUri ?? null,
      recipe.servings,
      recipe.instructions ?? null,
      recipe.prepTime ?? null,
      recipe.cookTime ?? null,
      recipe.cuisine ?? null,
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
      `SELECT r.id, r.title, r.source_type, r.source_uri, r.source_url,
              r.image_uri, r.servings, r.instructions, r.prep_time,
              r.cook_time, r.cuisine, r.created_at, r.updated_at,
              COUNT(i.id) AS ingredient_count
       FROM recipes r
       LEFT JOIN ingredients i ON i.recipe_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`
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
      `SELECT id, title, source_type, source_uri, source_url, image_uri,
              servings, instructions, prep_time, cook_time, cuisine,
              created_at, updated_at
       FROM recipes WHERE id = ?`,
      id
    );
    if (!row) {
      logger.info('queries.getRecipeById.notFound', { id });
      return null;
    }
    const recipe = mapRecipeRow(row);
    recipe.ingredients = db
      .getAllSync(
        `SELECT id, recipe_id, name, quantity, unit, notes,
                checked, in_list, sort_order
         FROM ingredients WHERE recipe_id = ? ORDER BY sort_order`,
        id
      )
      .map(mapIngredientRow);
    recipe.steps = db
      .getAllSync(
        `SELECT id, recipe_id, step_number, instruction, illustration_url
         FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number`,
        id
      )
      .map(mapStepRow);
    logger.info('queries.getRecipeById.success', {
      id,
      ingredientCount: recipe.ingredients.length,
      stepCount: recipe.steps.length,
    });
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
    const columnMap = {
      title: 'title',
      servings: 'servings',
      instructions: 'instructions',
      prepTime: 'prep_time',
      cookTime: 'cook_time',
      cuisine: 'cuisine',
      sourceUrl: 'source_url',
    };
    const setClauses = [];
    const values = [];
    for (const [key, col] of Object.entries(columnMap)) {
      if (key in fields) {
        setClauses.push(`${col} = ?`);
        values.push(fields[key]);
      }
    }
    if (setClauses.length === 0) return;
    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    db.runSync(`UPDATE recipes SET ${setClauses.join(', ')} WHERE id = ?`, ...values);
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
    // FK cascade handles ingredients, recipe_steps, recipe_collections
    db.runSync('DELETE FROM recipes WHERE id = ?', id);
    logger.info('queries.deleteRecipe.success', { id });
  } catch (err) {
    logger.error('queries.deleteRecipe.error', { id, error: err.message });
    throw err;
  }
}

// ── Ingredients ───────────────────────────────────────────────────────────────

export function saveIngredients(recipeId, ingredients) {
  logger.info('queries.saveIngredients', { recipeId, count: ingredients.length });
  try {
    const db = getDatabase();
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      db.runSync(
        `INSERT INTO ingredients
           (id, recipe_id, name, quantity, unit, notes, checked, sort_order)
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
    for (const [key, col] of Object.entries(columnMap)) {
      if (key in fields) {
        setClauses.push(`${col} = ?`);
        values.push(key === 'checked' ? (fields[key] ? 1 : 0) : fields[key]);
      }
    }
    if (setClauses.length === 0) return;
    values.push(id);
    db.runSync(`UPDATE ingredients SET ${setClauses.join(', ')} WHERE id = ?`, ...values);
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

// ── Shopping list ─────────────────────────────────────────────────────────────

export function getShoppingListIngredients() {
  logger.info('queries.getShoppingListIngredients', {});
  try {
    const db = getDatabase();
    const rows = db.getAllSync(
      `SELECT i.id, i.recipe_id, i.name, i.quantity, i.unit, i.notes,
              i.checked, i.in_list, i.sort_order, r.title AS recipe_title
       FROM ingredients i
       JOIN recipes r ON r.id = i.recipe_id
       WHERE i.in_list = 1
       ORDER BY r.title, i.sort_order`
    );
    const items = rows.map((row) => ({ ...mapIngredientRow(row), recipeTitle: row.recipe_title }));
    logger.info('queries.getShoppingListIngredients.success', { count: items.length });
    return items;
  } catch (err) {
    logger.error('queries.getShoppingListIngredients.error', { error: err.message });
    throw err;
  }
}

export function removeIngredientFromList(id) {
  logger.info('queries.removeIngredientFromList', { id });
  try {
    const db = getDatabase();
    db.runSync('UPDATE ingredients SET in_list = 0, checked = 0 WHERE id = ?', id);
    logger.info('queries.removeIngredientFromList.success', { id });
  } catch (err) {
    logger.error('queries.removeIngredientFromList.error', { id, error: err.message });
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

// ── Recipe steps ──────────────────────────────────────────────────────────────

export function getRecipeSteps(recipeId) {
  logger.info('queries.getRecipeSteps', { recipeId });
  try {
    const db = getDatabase();
    const rows = db.getAllSync(
      `SELECT id, recipe_id, step_number, instruction, illustration_url
       FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number`,
      recipeId
    );
    const steps = rows.map(mapStepRow);
    logger.info('queries.getRecipeSteps.success', { recipeId, count: steps.length });
    return steps;
  } catch (err) {
    logger.error('queries.getRecipeSteps.error', { recipeId, error: err.message });
    throw err;
  }
}

export function saveRecipeSteps(recipeId, steps) {
  logger.info('queries.saveRecipeSteps', { recipeId, count: steps.length });
  try {
    const db = getDatabase();
    for (const step of steps) {
      db.runSync(
        `INSERT INTO recipe_steps (id, recipe_id, step_number, instruction, illustration_url)
         VALUES (?, ?, ?, ?, ?)`,
        step.id,
        recipeId,
        step.stepNumber,
        step.instruction,
        step.illustrationUrl ?? null
      );
    }
    logger.info('queries.saveRecipeSteps.success', { recipeId, count: steps.length });
  } catch (err) {
    logger.error('queries.saveRecipeSteps.error', { recipeId, error: err.message });
    throw err;
  }
}

export function deleteRecipeSteps(recipeId) {
  logger.info('queries.deleteRecipeSteps', { recipeId });
  try {
    const db = getDatabase();
    db.runSync('DELETE FROM recipe_steps WHERE recipe_id = ?', recipeId);
    logger.info('queries.deleteRecipeSteps.success', { recipeId });
  } catch (err) {
    logger.error('queries.deleteRecipeSteps.error', { recipeId, error: err.message });
    throw err;
  }
}

export function updateStepIllustration(stepId, illustrationUrl) {
  logger.info('queries.updateStepIllustration', { stepId });
  try {
    const db = getDatabase();
    db.runSync(
      'UPDATE recipe_steps SET illustration_url = ? WHERE id = ?',
      illustrationUrl,
      stepId
    );
    logger.info('queries.updateStepIllustration.success', { stepId });
  } catch (err) {
    logger.error('queries.updateStepIllustration.error', { stepId, error: err.message });
    throw err;
  }
}

// ── Collections ───────────────────────────────────────────────────────────────

export function getCollections() {
  logger.info('queries.getCollections', {});
  try {
    const db = getDatabase();
    const rows = db.getAllSync(
      `SELECT c.id, c.name, c.emoji, c.created_at,
              COUNT(rc.recipe_id) AS recipe_count
       FROM collections c
       LEFT JOIN recipe_collections rc ON rc.collection_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );
    const collections = rows.map(mapCollectionRow);
    logger.info('queries.getCollections.success', { count: collections.length });
    return collections;
  } catch (err) {
    logger.error('queries.getCollections.error', { error: err.message });
    throw err;
  }
}

export function createCollection(collection) {
  logger.info('queries.createCollection', { id: collection.id, name: collection.name });
  try {
    const db = getDatabase();
    db.runSync(
      `INSERT INTO collections (id, name, emoji, created_at) VALUES (?, ?, ?, ?)`,
      collection.id,
      collection.name,
      collection.emoji ?? '📁',
      collection.createdAt
    );
    logger.info('queries.createCollection.success', { id: collection.id });
  } catch (err) {
    logger.error('queries.createCollection.error', { id: collection.id, error: err.message });
    throw err;
  }
}

export function updateCollection(id, fields) {
  logger.info('queries.updateCollection', { id });
  try {
    const db = getDatabase();
    const setClauses = [];
    const values = [];
    if ('name' in fields) { setClauses.push('name = ?'); values.push(fields.name); }
    if ('emoji' in fields) { setClauses.push('emoji = ?'); values.push(fields.emoji); }
    if (setClauses.length === 0) return;
    values.push(id);
    db.runSync(`UPDATE collections SET ${setClauses.join(', ')} WHERE id = ?`, ...values);
    logger.info('queries.updateCollection.success', { id });
  } catch (err) {
    logger.error('queries.updateCollection.error', { id, error: err.message });
    throw err;
  }
}

export function deleteCollection(id) {
  logger.info('queries.deleteCollection', { id });
  try {
    const db = getDatabase();
    // FK cascade removes recipe_collections rows
    db.runSync('DELETE FROM collections WHERE id = ?', id);
    logger.info('queries.deleteCollection.success', { id });
  } catch (err) {
    logger.error('queries.deleteCollection.error', { id, error: err.message });
    throw err;
  }
}

export function addRecipeToCollection(recipeId, collectionId) {
  logger.info('queries.addRecipeToCollection', { recipeId, collectionId });
  try {
    const db = getDatabase();
    db.runSync(
      `INSERT OR IGNORE INTO recipe_collections (recipe_id, collection_id) VALUES (?, ?)`,
      recipeId,
      collectionId
    );
    logger.info('queries.addRecipeToCollection.success', { recipeId, collectionId });
  } catch (err) {
    logger.error('queries.addRecipeToCollection.error', { recipeId, collectionId, error: err.message });
    throw err;
  }
}

export function removeRecipeFromCollection(recipeId, collectionId) {
  logger.info('queries.removeRecipeFromCollection', { recipeId, collectionId });
  try {
    const db = getDatabase();
    db.runSync(
      'DELETE FROM recipe_collections WHERE recipe_id = ? AND collection_id = ?',
      recipeId,
      collectionId
    );
    logger.info('queries.removeRecipeFromCollection.success', { recipeId, collectionId });
  } catch (err) {
    logger.error('queries.removeRecipeFromCollection.error', { recipeId, collectionId, error: err.message });
    throw err;
  }
}

export function getCollectionRecipes(collectionId) {
  logger.info('queries.getCollectionRecipes', { collectionId });
  try {
    const db = getDatabase();
    const rows = db.getAllSync(
      `SELECT r.id, r.title, r.source_type, r.source_uri, r.source_url,
              r.image_uri, r.servings, r.instructions, r.prep_time,
              r.cook_time, r.cuisine, r.created_at, r.updated_at,
              COUNT(i.id) AS ingredient_count
       FROM recipes r
       JOIN recipe_collections rc ON rc.recipe_id = r.id
       LEFT JOIN ingredients i ON i.recipe_id = r.id
       WHERE rc.collection_id = ?
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      collectionId
    );
    const recipes = rows.map(mapRecipeRow);
    logger.info('queries.getCollectionRecipes.success', { collectionId, count: recipes.length });
    return recipes;
  } catch (err) {
    logger.error('queries.getCollectionRecipes.error', { collectionId, error: err.message });
    throw err;
  }
}

export function getRecipeCollections(recipeId) {
  logger.info('queries.getRecipeCollections', { recipeId });
  try {
    const db = getDatabase();
    const rows = db.getAllSync(
      `SELECT c.id, c.name, c.emoji, c.created_at, 0 AS recipe_count
       FROM collections c
       JOIN recipe_collections rc ON rc.collection_id = c.id
       WHERE rc.recipe_id = ?
       ORDER BY c.created_at DESC`,
      recipeId
    );
    const collections = rows.map(mapCollectionRow);
    logger.info('queries.getRecipeCollections.success', { recipeId, count: collections.length });
    return collections;
  } catch (err) {
    logger.error('queries.getRecipeCollections.error', { recipeId, error: err.message });
    throw err;
  }
}

// ── Chat messages ─────────────────────────────────────────────────────────────

export function getChatMessages(recipeId = null) {
  logger.info('queries.getChatMessages', { recipeId });
  try {
    const db = getDatabase();
    const rows =
      recipeId === null
        ? db.getAllSync(
            `SELECT id, role, content, image_uri, created_at, recipe_id
             FROM chat_messages WHERE recipe_id IS NULL ORDER BY created_at ASC`
          )
        : db.getAllSync(
            `SELECT id, role, content, image_uri, created_at, recipe_id
             FROM chat_messages WHERE recipe_id = ? ORDER BY created_at ASC`,
            recipeId
          );
    const messages = rows.map(mapChatMessageRow);
    logger.info('queries.getChatMessages.success', { recipeId, count: messages.length });
    return messages;
  } catch (err) {
    logger.error('queries.getChatMessages.error', { recipeId, error: err.message });
    throw err;
  }
}

export function saveChatMessage(message) {
  logger.info('queries.saveChatMessage', { id: message.id, role: message.role });
  try {
    const db = getDatabase();
    db.runSync(
      `INSERT INTO chat_messages (id, role, content, image_uri, created_at, recipe_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      message.id,
      message.role,
      message.content,
      message.imageUri ?? null,
      message.createdAt,
      message.recipeId ?? null
    );
    logger.info('queries.saveChatMessage.success', { id: message.id });
  } catch (err) {
    logger.error('queries.saveChatMessage.error', { id: message.id, error: err.message });
    throw err;
  }
}

export function deleteChatMessages(recipeId = null) {
  logger.info('queries.deleteChatMessages', { recipeId });
  try {
    const db = getDatabase();
    if (recipeId === null) {
      db.runSync('DELETE FROM chat_messages WHERE recipe_id IS NULL');
    } else {
      db.runSync('DELETE FROM chat_messages WHERE recipe_id = ?', recipeId);
    }
    logger.info('queries.deleteChatMessages.success', { recipeId });
  } catch (err) {
    logger.error('queries.deleteChatMessages.error', { recipeId, error: err.message });
    throw err;
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function getSetting(key) {
  logger.info('queries.getSetting', { key });
  try {
    const db = getDatabase();
    const row = db.getFirstSync('SELECT value FROM app_settings WHERE key = ?', key);
    logger.info('queries.getSetting.success', { key, found: !!row });
    return row ? row.value : null;
  } catch (err) {
    logger.error('queries.getSetting.error', { key, error: err.message });
    throw err;
  }
}

export function setSetting(key, value) {
  logger.info('queries.setSetting', { key });
  try {
    const db = getDatabase();
    db.runSync(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      key,
      String(value)
    );
    logger.info('queries.setSetting.success', { key });
  } catch (err) {
    logger.error('queries.setSetting.error', { key, error: err.message });
    throw err;
  }
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapRecipeRow(row) {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    sourceUri: row.source_uri ?? null,
    sourceUrl: row.source_url ?? null,
    imageUri: row.image_uri ?? null,
    servings: row.servings,
    instructions: row.instructions ?? null,
    prepTime: row.prep_time ?? null,
    cookTime: row.cook_time ?? null,
    cuisine: row.cuisine ?? null,
    ingredientCount: row.ingredient_count ?? 0,
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

function mapStepRow(row) {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    stepNumber: row.step_number,
    instruction: row.instruction,
    illustrationUrl: row.illustration_url ?? null,
  };
}

function mapCollectionRow(row) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    recipeCount: row.recipe_count ?? 0,
    createdAt: row.created_at,
  };
}

function mapChatMessageRow(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    imageUri: row.image_uri ?? null,
    createdAt: row.created_at,
    recipeId: row.recipe_id ?? null,
  };
}
