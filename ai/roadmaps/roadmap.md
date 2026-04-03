# Recipe Scanner — Roadmap

> **demo-no-api branch** — Walmart integration uses GPT-4o item ID resolution, no Walmart API credentials required.

## Overview
6-day sprint to a working iOS demo. Each day has a clear deliverable. Phases are sequential — don't start a phase until the previous one is verified.

**Verify command after each phase:** `./scripts/test.sh`

---

## Phase 1 — Project Setup (Day 1)
**Goal:** Runnable Expo app with all dependencies installed and folder structure in place.

- [x] Initialize Expo project with `npx create-expo-app .`
- [x] Install dependencies: `expo-camera`, `expo-image-picker`, `expo-document-picker`, `expo-file-system`, `expo-sqlite`, `uuid`, `@react-navigation/bottom-tabs`
- [x] Set up Expo Router with three tabs: Scan, Library, Shopping List
- [x] Create `src/` folder structure: `services/`, `db/`, `utils/`, `components/`
- [x] Implement `src/utils/logger.js` (structured JSON logger)
- [x] Create `scripts/build.sh`, `scripts/test.sh`, `scripts/run.sh`
- [x] Create `.testEnvVars` with placeholder values
- [x] Create `.gitignore` (includes `ai/`, `CLAUDE.md`, `.cursorrules`, `.testEnvVars`, `node_modules/`)
- [x] Create `CLAUDE.md` with pointer to `aiDocs/context.md`
- [x] Initialize git repo, make first commit: "Phase 1: Project setup and scaffolding"
- [x] Verify: `./scripts/build.sh` exits 0

---

## Phase 2 — Database + Data Layer (Day 2)
**Goal:** SQLite schema initialized on app start; recipes and ingredients can be saved and retrieved.

- [x] Implement `src/db/schema.js` — create `recipes` and `ingredients` tables on first run
- [x] Implement `src/db/queries.js`:
  - [x] `saveRecipe(recipe)`
  - [x] `getAllRecipes()`
  - [x] `getRecipeById(id)`
  - [x] `deleteRecipe(id)`
  - [x] `saveIngredients(recipeId, ingredients[])`
  - [x] `updateIngredient(id, fields)`
  - [x] `deleteIngredient(id)`
  - [x] `toggleIngredientChecked(id)`
- [x] Implement `src/utils/scaler.js` — scale ingredient quantities by multiplier
- [x] Verify: write a CLI test that inserts a recipe, reads it back, and confirms match
- [x] Commit: "Phase 2: SQLite schema and data layer"

---

## Phase 3 — GPT-4o Integration (Day 2–3)
**Goal:** App can take a base64 image or raw text, send to GPT-4o, and return a clean `Ingredient[]`.

- [x] Implement `src/services/openai.js`:
  - [x] `parseImageIngredients(base64Image)` — GPT-4o Vision call
  - [x] `parseTextIngredients(rawText)` — GPT-4o text call
  - [x] Both return `Ingredient[]` parsed from JSON response
  - [x] Both log entry, exit, and errors via `logger`
- [x] Write and test the system prompt — verify it returns valid JSON for at least 3 real recipes
- [x] Handle GPT-4o errors gracefully (timeout, bad JSON, API error)
- [x] Verify: run a test script that sends a sample image/text and prints the parsed ingredient list
- [x] Commit: "Phase 3: GPT-4o ingredient parsing service"

---

## Phase 4 — Import Methods (Day 3)
**Goal:** All four input methods work and produce a structured ingredient list.

- [x] **Camera scan**: Open camera → capture → base64 → `parseImageIngredients` → ingredient list
- [x] **Photo library**: Pick from camera roll → base64 → `parseImageIngredients` → ingredient list
- [x] **URL import**: User pastes URL → `src/services/scraper.js` fetches + strips HTML → `parseTextIngredients` → ingredient list
- [x] **File import (PDF/DOCX)**: `expo-document-picker` → `src/services/fileParser.js` extracts text → `parseTextIngredients` → ingredient list
- [x] All four methods land on the same Ingredient Editor screen
- [x] Show loading spinner during processing
- [x] Commit: "Phase 4: All import methods connected"

---

## Phase 5 — Ingredient Editor + Recipe Save (Day 4)
**Goal:** User can review, edit, scale, and save a recipe from any import method.

- [x] Build `IngredientRow` component — shows name, quantity, unit; tap to edit inline
- [x] Serving size scaler — input field that recalculates all quantities via `scaler.js`
- [x] Recipe title field — auto-populated from GPT-4o or editable
- [x] "Save Recipe" button → calls `saveRecipe()` and `saveIngredients()` → navigates to Library
- [x] Build Library tab — list of saved recipes using `getAllRecipes()`
- [x] Build Recipe Detail screen — shows ingredients, allows re-editing, "Add to Shopping List" button
- [x] Commit: "Phase 5: Ingredient editor, scaler, and recipe library"

---

## Phase 6 — Shopping List (Day 4–5)
**Goal:** Combined shopping list from selected recipes with check-off functionality.

- [x] Shopping List tab shows all ingredients from all recipes marked "in list"
- [x] Check-off: tap ingredient to toggle `checked` state via `toggleIngredientChecked()`
- [x] Visual: checked items are crossed out / grayed
- [x] "Clear checked" button to reset all checked states
- [x] Commit: "Phase 6: Shopping list with check-off"

---

## Phase 7 — Walmart Integration (Day 5)
**Goal:** Each ingredient can be searched on Walmart; results sent to cart.

- [x] Implement `src/services/walmart.js`:
  - [x] `searchProduct(ingredientName)` — Walmart Open API search, returns top result
  - [x] `buildCartLink(productIds[])` — generates Walmart cart URL or affiliate link
  - [x] Log all API calls and responses via `logger`
- [x] Shopping List screen: "Find on Walmart" button per ingredient (or bulk)
- [x] Show matched product name + price per ingredient
- [x] "Send to Walmart" button → calls `buildCartLink()` → opens URL in browser via `Linking.openURL()`
- [x] Handle Walmart API auth errors and rate limits gracefully
- [x] Verify: test script that searches for "flour" and "eggs" and prints matched products as JSON
- [x] Commit: "Phase 7: Walmart product search and cart integration"

---

## Phase 8 — Polish + Demo Prep (Day 6)
**Goal:** App is stable, looks presentable, and the demo flow works end-to-end without intervention.

- [ ] Run full end-to-end flow: scan → edit → save → shopping list → Walmart → confirm no crashes
- [ ] Fix any UI rough edges (spacing, truncation, loading states)
- [ ] Add empty states for Library and Shopping List tabs (plain text is fine)
- [ ] Test on a real iPhone — not just simulator
- [ ] Write `README.md`: what it does, how to run it, environment variable setup
- [ ] Update `aiDocs/changelog.md` with final decisions
- [ ] Final commit: "Phase 8: Demo polish and README"
- [ ] Tag release: `git tag v1.0-demo`

---

## Progress Tracking

| Phase | Status | Commit |
|-------|--------|--------|
| 1 — Setup | ✅ Done | Phase 1: Project setup and scaffolding |
| 2 — Database | ✅ Done (2026-04-01) | Phase 2: SQLite schema and data layer |
| 3 — GPT-4o | ✅ Done (2026-04-02) | Phase 3: GPT-4o ingredient parsing service |
| 4 — Import Methods | ✅ Done (2026-04-02) | Phase 4: All import methods connected |
| 5 — Editor + Library | ✅ Done (2026-04-02) | Phase 5: Ingredient editor, scaler, and recipe library |
| 6 — Shopping List | ✅ Done (2026-04-02) | Phase 6: Shopping list with check-off |
| 7 — Walmart | ✅ Done (2026-04-02) | Phase 7: Walmart product search and cart integration |
| 8 — Polish | ⬜ Not started | — |
