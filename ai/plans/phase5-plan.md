# Phase 5 Plan — Ingredient Editor + Recipe Save

## Goal
User can review, edit, scale, and save a recipe from any import method. Saved recipes appear in a library and can be reopened.

## Approach
- Wire up the editor screen (`app/recipe/editor.jsx`): editable rows for each ingredient (qty, unit, name), editable recipe title, serving size scaler using `scaler.js`
- "Save Recipe" generates a UUID, calls `saveRecipe()` + `saveIngredients()`, shows loading state, navigates to Library on success
- Build Library tab (`app/(tabs)/library.jsx`): FlatList of saved recipes loaded via `getAllRecipes()` on screen focus, empty state when no recipes
- Build Recipe Detail screen (`app/recipe/[id].jsx`): loads recipe by ID, shows editable ingredient rows, serving size scaler, "Add to Shopping List" button (stub for Phase 6), "Delete Recipe" with confirmation dialog
- Write a CLI test that creates a recipe, reads it back, updates an ingredient, deletes the recipe, and verifies cleanup

## Key Decisions
- **Inline editing over a separate edit modal** — tap a field to edit it directly in the row. Faster for the user, simpler to implement.
- **useFocusEffect for library refresh** — reload the recipe list every time the Library tab gains focus, so new saves appear immediately without manual refresh
- **UUID generation at save time** — not at import time. The editor is a transient state; the recipe only gets an ID when the user commits to saving.
- **Cascade delete** — deleting a recipe deletes its ingredients. The foreign key constraint handles this in SQLite.

## Success Criteria
- `node scripts/test-save-flow.js` exits 0 with all 15 assertions passing
- Full flow: import → edit → save → appears in library → open detail → edit ingredient → delete recipe
