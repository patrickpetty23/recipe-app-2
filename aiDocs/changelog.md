# Changelog

## Rules
- What changed and why — not how
- 1-2 lines per entry
- Most recent at the top

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
