# Phase 6 Plan — Shopping List

## Goal
Combined shopping list from selected recipes with tap-to-check functionality.

## Approach
- Add `in_list` column to ingredients table (migration for existing databases) to track which ingredients are on the shopping list
- Add 5 new query functions: `getShoppingListIngredients`, `addRecipeToList`, `removeRecipeFromList`, `clearCheckedItems`, `clearShoppingList`
- Wire up "Add to Shopping List" / "Remove from Shopping List" toggle on Recipe Detail screen
- Build Shopping List tab (`app/(tabs)/list.jsx`): `SectionList` grouped by recipe title, tap-to-check with strikethrough + gray styling, "Clear Checked" and "Clear List" buttons, empty state
- Write a CLI test covering add to list, check toggle, clear checked, clear list

## Key Decisions
- **`in_list` flag on ingredients, not a separate join table** — simpler schema, fewer queries. Each ingredient either is or isn't on the shopping list.
- **SectionList over FlatList** — groups ingredients by recipe title, so the user knows which recipe each ingredient came from
- **Checked = strikethrough + gray** — visual feedback that's immediately obvious while shopping in a store
- **"Clear Checked" vs "Clear List"** — two separate actions. "Clear Checked" resets check marks (for re-shopping). "Clear List" removes everything (start fresh).

## Success Criteria
- `node scripts/test-shopping-list.js` exits 0 with all 13 assertions passing
- Add recipe to list → items appear → check items → clear checked → clear list
