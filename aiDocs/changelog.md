# Changelog

## Rules
- What changed and why — not how
- 1-2 lines per entry
- Most recent at the top

---

## Day 5 — Walmart Integration (Phase 7)
- Implemented `src/services/walmart.js` — `searchProduct` hits Walmart Affiliate API v2 with RSA-signed auth headers, returns top `WalmartProduct` match; `buildCartLink` constructs Walmart cart URL from item IDs; in-memory cache prevents duplicate API calls per session
- Updated Shopping List tab with per-ingredient "Find on Walmart" button — shows matched product name and price inline, loading indicator during search, "No match found" for empty results
- Added "Send to Walmart" button at bottom of Shopping List — collects matched item IDs, calls `buildCartLink`, opens URL via `Linking.openURL()`
- Uses `node-forge` (already bundled with Expo) for RSA signing in React Native; Node.js `crypto` module for CLI test
- Added `scripts/test-walmart.js` CLI test — searches "all-purpose flour" and "large eggs", prints matched products, builds cart URL (requires Walmart API credentials in `.testEnvVars`)

---

## Day 4–5 — Shopping List (Phase 6)
- Added `in_list` column to ingredients table with migration for existing databases — tracks which ingredients are on the shopping list
- Added 5 new query functions: `getShoppingListIngredients`, `addRecipeToList`, `removeRecipeFromList`, `clearCheckedItems`, `clearShoppingList` — all with structured logging
- Wired up "Add to Shopping List" / "Remove from Shopping List" toggle on Recipe Detail screen — persists `in_list` state, button label reflects current state
- Built Shopping List tab (`app/(tabs)/list.jsx`) — `SectionList` grouped by recipe title, tap-to-check with strikethrough + gray styling, "Clear Checked" and "Clear List" buttons, empty state when no recipes added
- Added `scripts/test-shopping-list.js` CLI test — 13 assertions covering add to list, check toggle, clear checked, clear list (all pass)

---

## Day 4 — Ingredient Editor + Recipe Save (Phase 5)
- Wired up "Save Recipe" in `app/recipe/editor.jsx` — generates UUID, calls `saveRecipe()` + `saveIngredients()`, shows loading state on save button, navigates to Library on success with Alert
- Built Library tab (`app/(tabs)/library.jsx`) — loads all recipes via `getAllRecipes()` on focus, displays FlatList with title/source/date, tapping navigates to detail screen, shows empty state when no recipes exist
- Built Recipe Detail screen (`app/recipe/[id].jsx`) — loads recipe by ID, editable ingredient rows that persist changes via `updateIngredient()`, serving size scaler, "Add to Shopping List" stub, and "Delete Recipe" with confirmation
- Added `scripts/test-save-flow.js` CLI test — creates recipe with 3 ingredients, reads back and verifies all fields, updates ingredient name, deletes recipe and confirms removal (15 assertions, all pass)

---

## Day 3 — Import Methods (Phase 4)
- Rebuilt Scan tab (`app/(tabs)/index.jsx`) with four import methods: camera capture, photo library, URL paste, and PDF/DOCX file picker — all with loading spinners and error alerts
- Implemented `src/services/scraper.js` — fetches URL, strips script/style/nav/header/footer tags via regex, returns cleaned text for GPT-4o
- Implemented `src/services/fileParser.js` — `parsePdf` extracts text from PDF binary via parenthesis-operator regex; `parseDocx` uses JSZip to unzip and extract text from `word/document.xml`
- Created `app/recipe/editor.jsx` — displays parsed ingredients in editable rows (qty, unit, name), editable recipe title, serving size scaler wired to `scaler.js`, save stub (Phase 5), and discard/back button
- All four import paths navigate to the same editor screen via Expo Router with JSON-serialized params

---

## Day 2–3 — GPT-4o Integration (Phase 3)
- Implemented `src/services/openai.js` with `parseImageIngredients` (Vision API) and `parseTextIngredients` — both use the system prompt from architecture.md and return parsed `Ingredient[]`
- Handles timeout (AbortController at 30s), auth errors (401), malformed JSON (fence-stripping + validation), and generic API failures — all logged before re-throwing
- Added `scripts/test-openai.js` CLI test — sends a 7-ingredient sample recipe to GPT-4o, validates non-empty array response; confirmed working with live API

---

## Day 2 — Database + Data Layer (Phase 2)
- Implemented `src/db/schema.js` — initializes SQLite via expo-sqlite with `recipes` and `ingredients` tables (WAL mode, foreign keys enabled)
- Implemented `src/db/queries.js` — 8 CRUD functions (saveRecipe, getAllRecipes, getRecipeById, deleteRecipe, saveIngredients, updateIngredient, deleteIngredient, toggleIngredientChecked) all with structured logging on entry/exit/error
- Implemented `src/utils/scaler.js` — scales ingredient quantities by a multiplier, null quantities stay null
- Added `scripts/test-db.js` CLI test — 27 assertions covering insert, read, update, toggle, delete, cascade, and scaler logic; uses better-sqlite3 (devDep) for Node.js-compatible testing
- Added `"test"` npm script so `./scripts/test.sh` and `node scripts/test-db.js` both pass cleanly

---

## Day 1 — Project Init
- Created full aiDocs suite: context, PRD, MVP, architecture, coding-style, changelog
- Defined tech stack: React Native (Expo), GPT-4o Vision, Walmart Open API, expo-sqlite
- Decided to use GPT-4o Vision directly for OCR instead of a separate OCR library — eliminates a dependency and handles messy cookbook fonts better
- Scoped MVP to 6-day sprint with Walmart integration as the core differentiator
