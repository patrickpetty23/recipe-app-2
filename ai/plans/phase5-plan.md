# Phase 5 Plan — Ingredient Editor + Recipe Save

## Intent
Give users the ability to review, correct, and save what the AI extracted. The editor is the moment of truth — if the AI got something wrong, this is where the user fixes it. The save flow must be fast and reliable.

## Approach
The editor displays parsed ingredients in editable rows. Each row shows quantity, unit, and name — the three fields users most commonly need to correct. Tap a row to edit inline. No modal, no separate edit screen — inline editing is faster.

The serving size scaler multiplies all quantities by `currentServings / originalServings`. It uses `scaler.js` from Phase 2. Update is instant — no save required.

Save generates a UUID for the recipe, writes to SQLite, and navigates to the Library. The UUID is generated at save time (not earlier) so we don't persist partial recipes.

## Key Decisions Made
- **Inline editing over modal**: Modals add taps. Users making small corrections (changing "2 cups" to "1.5 cups") want to tap the field, type, and move on. A full edit modal is overkill.
- **Serving scaler in editor, not separate screen**: Scaling before saving means the saved recipe reflects the user's actual serving preference. Re-scaling after save is also supported in the detail screen.
- **Navigate to Library on save, not back to Home**: The user just created a recipe. The logical next step is to see it in their library, not to be dropped back at the scan screen.
- **Error handling on save**: If SQLite write fails, show an Alert with the error. Don't lose the data — the editor state is still populated and the user can retry.
- **Auto-populate recipe title from GPT-4o**: The title field is pre-filled from parsing. User can edit it. This is better than "Untitled Recipe #3" as the default.

## Risks Identified
- Long ingredient lists (20+ items) on a small screen need good scroll performance. FlatList is the right choice over ScrollView + map.
- Serving scaler with null quantities: some ingredients don't have quantities (e.g., "salt to taste"). `scaler.js` must handle nulls gracefully — return null, not NaN.
