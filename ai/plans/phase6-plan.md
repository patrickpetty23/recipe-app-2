# Phase 6 Plan — Shopping List

## Intent
Turn saved recipes into an actionable shopping list. This is the first feature where multiple recipes interact — the shopping list is the aggregate of ingredients across everything the user wants to cook this week.

## Approach
Add an `in_list` boolean column to ingredients (with a migration for existing rows). "Add to Shopping List" from any recipe detail toggles all its ingredients into the list view. The shopping list tab pulls all `in_list = 1` ingredients grouped by recipe.

Check-off state is stored in the existing `checked` column. Checking off an item visually crosses it out and dims it. "Clear Checked" resets all checked items. "Clear List" removes everything.

## Key Decisions Made
- **Per-ingredient `in_list` flag over a separate shopping_list table**: A separate table would require syncing when recipes are edited. An `in_list` column on the ingredient stays in sync automatically — editing an ingredient name is immediately reflected in the shopping list.
- **Grouped by recipe (SectionList) over flat list**: When shopping, users think in terms of "what do I need for the pasta" vs "what do I need for the cake." Grouping by recipe is more useful than alphabetical.
- **Check-off state not synced back to recipe**: Checking off "flour" in the shopping list doesn't affect the ingredient in the recipe detail. They're separate concerns — the recipe is a template, the list is an instance.
- **"Clear Checked" separate from "Clear List"**: Users may want to reset their shopping trip (uncheck everything) vs. clear the whole list for next week. Both operations are one tap.
- **Migration guard for `in_list` column**: `ALTER TABLE ingredients ADD COLUMN in_list INTEGER NOT NULL DEFAULT 0` must be wrapped in a try/catch — if the column already exists, SQLite throws. Use `IF NOT EXISTS` semantics by catching the error.

## Risks Identified
- An ingredient added to the list from a recipe, then the recipe deleted: the `ON DELETE CASCADE` handles this — the ingredient row is deleted and disappears from the list automatically.
- Long shopping lists from multiple recipes may scroll slowly. Use FlatList inside each SectionList section.
