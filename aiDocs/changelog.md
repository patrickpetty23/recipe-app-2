# Changelog

## Rules
- What changed and why — not how
- 1-2 lines per entry
- Most recent at the top

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
