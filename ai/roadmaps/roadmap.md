# Recipe Scanner — Roadmap

## Overview

Sprint to a working iOS demo + rubric-ready submission. Each phase has a clear deliverable. Phases are sequential — don't start a phase until the previous one is verified.

**Verify command after each phase:** `./scripts/test.sh`

---

## Phase 1 — Project Setup

**Goal:** Runnable Expo app with all dependencies installed and folder structure in place.

- ✅ Initialize Expo project with `npx create-expo-app .`
- ✅ Install dependencies: `expo-camera`, `expo-image-picker`, `expo-document-picker`, `expo-file-system`, `expo-sqlite`, `uuid`, `@react-navigation/bottom-tabs`
- ✅ Set up Expo Router with three tabs: Scan, Library, Shopping List
- ✅ Create `src/` folder structure: `services/`, `db/`, `utils/`, `components/`
- ✅ Implement `src/utils/logger.js` (structured JSON logger)
- ✅ Create `scripts/build.sh`, `scripts/test.sh`, `scripts/run.sh`
- ✅ Create `.testEnvVars` with placeholder values
- ✅ Create `.gitignore` (covers secrets and library folders; `ai/` is tracked)
- ✅ Create `CLAUDE.md` with pointer to `aiDocs/context.md`
- ✅ Initialize git repo, make first commit: "Phase 1: Project setup and scaffolding"
- ✅ Verify: `./scripts/build.sh` exits 0

---

## Phase 2 — Database + Data Layer

**Goal:** SQLite schema initialized on app start; recipes and ingredients can be saved and retrieved.

- ✅ Implement `src/db/schema.js` — create `recipes` and `ingredients` tables on first run
- ✅ Implement `src/db/queries.js`:
  - ✅ `saveRecipe(recipe)`
  - ✅ `getAllRecipes()`
  - ✅ `getRecipeById(id)`
  - ✅ `deleteRecipe(id)`
  - ✅ `saveIngredients(recipeId, ingredients[])`
  - ✅ `updateIngredient(id, fields)`
  - ✅ `deleteIngredient(id)`
  - ✅ `toggleIngredientChecked(id)`
- ✅ Implement `src/utils/scaler.js` — scale ingredient quantities by multiplier
- ✅ Verify: write a CLI test that inserts a recipe, reads it back, and confirms match
- ✅ Commit: "Phase 2: SQLite schema and data layer"

---

## Phase 3 — GPT-4o Integration

**Goal:** App can take a base64 image or raw text, send to GPT-4o, and return a clean `Ingredient[]`.

- ✅ Implement `src/services/openai.js`:
  - ✅ `parseImageIngredients(base64Image)` — GPT-4o Vision call
  - ✅ `parseTextIngredients(rawText)` — GPT-4o text call
  - ✅ Both return `Ingredient[]` parsed from JSON response
  - ✅ Both log entry, exit, and errors via `logger`
- ✅ Write and test the system prompt — verify it returns valid JSON for at least 3 real recipes
- ✅ Handle GPT-4o errors gracefully (timeout, bad JSON, API error)
- ✅ Verify: run a test script that sends a sample image/text and prints the parsed ingredient list
- ✅ Commit: "Phase 3: GPT-4o ingredient parsing service"

---

## Phase 4 — Import Methods

**Goal:** All four input methods work and produce a structured ingredient list.

- ✅ **Camera scan**: Open camera → capture → base64 → `parseImageIngredients` → ingredient list
- ✅ **Photo library**: Pick from camera roll → base64 → `parseImageIngredients` → ingredient list
- ✅ **URL import**: User pastes URL → `src/services/scraper.js` fetches + strips HTML → `parseTextIngredients` → ingredient list
- ✅ **File import (PDF/DOCX)**: `expo-document-picker` → `src/services/fileParser.js` extracts text → `parseTextIngredients` → ingredient list
- ✅ All four methods land on the same Ingredient Editor screen
- ✅ Show loading spinner during processing
- ✅ Commit: "Phase 4: All import methods connected"

---

## Phase 5 — Ingredient Editor + Recipe Save

**Goal:** User can review, edit, scale, and save a recipe from any import method.

- ✅ Build `IngredientRow` component — shows name, quantity, unit; tap to edit inline
- ✅ Serving size scaler — input field that recalculates all quantities via `scaler.js`
- ✅ Recipe title field — auto-populated from GPT-4o or editable
- ✅ "Save Recipe" button → calls `saveRecipe()` and `saveIngredients()` → navigates to Library
- ✅ Build Library tab — list of saved recipes using `getAllRecipes()`
- ✅ Build Recipe Detail screen — shows ingredients, allows re-editing, "Add to Shopping List" button
- ✅ Commit: "Phase 5: Ingredient editor, scaler, and recipe library"

---

## Phase 6 — Shopping List

**Goal:** Combined shopping list from selected recipes with check-off functionality.

- ✅ Shopping List tab shows all ingredients from all recipes marked "in list"
- ✅ Check-off: tap ingredient to toggle `checked` state via `toggleIngredientChecked()`
- ✅ Visual: checked items are crossed out / grayed
- ✅ "Clear checked" button to reset all checked states
- ✅ Commit: "Phase 6: Shopping list with check-off"

---

## Phase 7 — Walmart Integration

**Goal:** Each ingredient can be searched on Walmart; results sent to cart.

- ✅ Implement `src/services/walmart.js`:
  - ✅ `searchProduct(ingredientName)` — Walmart Open API search, returns top result
  - ✅ `buildCartLink(productIds[])` — generates Walmart cart URL or affiliate link
  - ✅ Log all API calls and responses via `logger`
- ✅ Shopping List screen: "Find on Walmart" button per ingredient (or bulk)
- ✅ Show matched product name + price per ingredient
- ✅ "Send to Walmart" button → calls `buildCartLink()` → opens URL in browser via `Linking.openURL()`
- ✅ Handle Walmart API auth errors and rate limits gracefully
- ✅ Verify: test script that searches for "flour" and "eggs" and prints matched products as JSON
- ✅ Commit: "Phase 7: Walmart product search and cart integration"

---

## Phase 8 — Polish + Demo Prep

**Goal:** App is stable, looks presentable, and the demo flow works end-to-end without intervention.

- ✅ Redesign Home screen — hero section, "Add Recipe" button, modal for import method selection
- ✅ Fix Shopping List UI layout — flexbox refactor, remove duplicate header
- ✅ Fix Walmart cart URL — use `affil.walmart.com/cart/addToCart` format
- ✅ Fix `crypto` module error — use `node-forge` exclusively in React Native
- ✅ Graceful Walmart API key handling — popup alert instead of crash
- ✅ Update `scripts/run.sh` — read private key from file path
- ✅ Write `README.md`: what it does, how to run it, environment variable setup
- ✅ Run full end-to-end flow on a real iPhone — confirm no crashes

---

## Phase 9 — Rubric Compliance + Final Submission

**Goal:** Every rubric criterion is addressed. Process artifacts are complete, living, and visible to graders. Presentation-ready by April 7.

### Casey's Technical Domain

#### 9A — PRD & Document-Driven Development (25 pts)

- ✅ Add version history section to PRD — v1.0 through v1.3 with dates and change descriptions
- ✅ Expand PRD Problem Statement — added "What we learned through building" section with lessons on import methods, Walmart URL format, and UX feedback
- ✅ Verify mvp.md checkboxes are all checked and reflect delivered scope
- ✅ Create per-phase plan docs in `ai/plans/` — 8 files (`phase1-plan.md` through `phase8-plan.md`) with goal, approach, key decisions, and success criteria
- ✅ Update all aiDocs to reflect current project state — context.md focus, architecture.md structure, PRD risks with outcomes
- ✅ Commit plan docs: "Phase 9A: PRD version history, per-phase plans, living docs update"

#### 9B — AI Development Infrastructure (25 pts)

- ✅ Update `context.md` "Current Focus" — changed to Phase 9 rubric compliance
- ✅ Update `architecture.md` line 14 — changed `ai/` from "GITIGNORED" to "TRACKED in git"
- ✅ Update `architecture.md` project structure — reflected Home tab rename, modal import UI
- ✅ Add `.env` to `.gitignore` (rubric explicitly lists it)
- ✅ Verify no secrets committed — checked `git log -p` for `sk-`, clean
- ✅ Converted `CURSOR.md` to `.cursorrules` — enhanced with changelog reference, error handling, EXPO_PUBLIC_ convention; removed from `.gitignore` so graders can see it
- ✅ Confirm `ai/` folder is committed and visible — `git ls-files ai/` shows 10 files (9 plans + roadmap)
- ✅ Commit: "Phase 9B: Convert CURSOR.md to .cursorrules, add .env to gitignore"

#### 9C — Phase-by-Phase Implementation & Working Demo (25 pts)

- ✅ Run end-to-end demo flow on a real iPhone: Home → camera scan → editor → save → library → shopping list → Walmart search → send to cart
- ⬜ Record a short backup demo video in case live demo has issues on presentation day
- ✅ Ensure git history shows incremental phase-by-phase commits (already visible)

#### 9D — Structured Logging & Debugging (25 pts)

- ✅ Verify logger is imported and used in every `src/services/*.js` and `src/db/*.js` file — confirmed: all 6 service/db files import logger, 5 app files import logger, 0 rogue console.log
- ✅ Verify zero `console.log` in production code outside `logger.js` — confirmed clean (only console.log/error in logger.js implementation itself)
- ✅ Verify all CLI test scripts (`scripts/test-*.js`) output JSON to stdout, errors to stderr, and use exit codes 0/1 — confirmed for all 5 scripts
- ✅ Document test-log-fix loops in changelog — added 3 documented loops: crypto module error, Walmart cart URL, better-sqlite3 version mismatch
- ✅ Run `./scripts/test.sh` and confirm exit 0

### Jason's Product Domain

#### 9E — System Understanding (20 pts)

- ✅ Create or update a system diagram — added to `presentation/slides.html` and `presentation/feature-map.md`
- ✅ If you have a midterm diagram, show how it evolved (new components discovered, feedback loops added)
- ✅ Be ready to articulate what you got wrong or didn't see at midterm — what changed through building

#### 9F — Problem Identification (20 pts)

- ✅ Sharpen the problem statement — PRD v1.3 refined statement covers fragmentation, nutrition gap, and cooking guidance gap
- ✅ Document falsification test results — documented in `presentation/product-research.md`
- ✅ If problem statement matured since midterm, show the evolution

#### 9G — Customer Focus (20 pts)

- ✅ Document customer research beyond friends and family — `presentation/product-research.md`
- ✅ Update competitive analysis — Paprika, Mealime, AnyList comparison in `presentation/product-research.md`
- ✅ Document what customers actually told you vs. what you assumed — `presentation/product-research.md`
- ✅ Solution positioning: why this approach, validated by user feedback

#### 9H — Success & Failure Planning (20 pts)

- ✅ Review success metrics from PRD — actual measured results in PRD v1.3 table (times, accuracy %, Walmart confirmation)
- ✅ Report where you actually stand: which criteria met, which fell short, and what you learned
- ✅ Update pivot/continuation plans based on real data

#### 9I — Customer Interaction (20 pts)

- ✅ Document the feedback loop: engage → learn → change → re-engage — `presentation/product-research.md`
- ✅ Point to specific features shaped by customer feedback (URL import prioritized; modal import selector; product preview before cart)
- ✅ Show at least one cycle of: got feedback → changed something → went back to validate

### Presentation Prep

#### 9J — Presentation Materials

- ✅ Build slide deck — `presentation/slides.html` (17 slides)
- ✅ Include system design diagram in slides
- ✅ Include process narrative: how you planned, built, iterated, adapted
- ✅ Plan live demo segment — `presentation/demo-script.md` with timing
- ✅ Prepare honest discussion of what surprised you and what you'd do differently
- ✅ Prepare for Q&A — trade-offs covered in `presentation/executive-summary.md`
- ⬜ Submit peer evaluation form (individual submission — outside repo)

### Final Submission Checklist

- ✅ All aiDocs current and reflecting actual project state
- ✅ `ai/` folder committed with roadmaps, plans, changelogs visible
- ✅ No secrets in repo (`git log -p` clean)
- ✅ README.md accurate and up to date
- ✅ `./scripts/build.sh` exits 0
- ✅ `./scripts/test.sh` exits 0
- ✅ App runs on real iPhone without crashes

---

---

## Post-Phase 9 — Continued Development (Day 10, 2026-04-06)

**Goal:** Add new features (Meal Planner), fix iOS cross-platform issues, improve data handling (fractions), and resolve accumulated bugs.

### Meal Planner
- ✅ Added `meal_plan` table to schema (11 tables total)
- ✅ Implemented meal plan queries: `getMealPlanForWeek`, `addMealPlan`, `removeMealPlan`, `clearMealPlanForWeek`
- ✅ Added `chatMealPlanner` GPT-4o function with library-aware context
- ✅ Built Planner tab with weekly calendar, per-day meal slots, AI chat, manual recipe add
- ✅ Registered as 5th tab (Chat, Recipes, Shopping, Planner, Tracker)

### Fraction Support
- ✅ Changed ingredient quantity column from REAL to TEXT
- ✅ Added `parseFraction()` and `toFractionString()` to scaler.js
- ✅ Updated row mappers and display components

### Shopping List Enhancements
- ✅ Individual ingredient add-to-list from recipes
- ✅ New queries: `addIngredientsToList`, `removeIngredientFromList`
- ✅ Add modal with recipe picker → ingredient picker flow

### Recipe Detail & Editor
- ✅ Added `addIngredient` and `addRecipeStep` queries
- ✅ Moved "Start Cooking" to steps tab only
- ✅ UI layout fixes

### iOS Cross-Platform
- ✅ Replaced hardcoded paddingTop with `useSafeAreaInsets()` on all screens
- ✅ Fixed invisible iOS tab bar — added SafeAreaProvider at root
- ✅ Cross-platform tab bar height calculations
- ✅ Memory leak fixes

### Bug Fix Loops
- ✅ Walmart RSA signing: WebCrypto → dotenv PEM → reverted to node-forge (Expo Go constraint)
- ✅ Image generation: fal.ai FLUX → Gemini → HuggingFace → reverted to DALL-E 3
- ✅ Collection filter UX, refresh counts, safe area in cooking mode

---

## Progress Tracking


| Phase                 | Status              | Commit                                                         |
| --------------------- | ------------------- | -------------------------------------------------------------- |
| 1 — Setup             | ✅ Done (2026-04-01) | initial commit of the recipe app                               |
| 2 — Database          | ✅ Done (2026-04-01) | initial commit of the recipe app                               |
| 3 — GPT-4o            | ✅ Done (2026-04-01) | implement phase 3                                              |
| 4 — Import Methods    | ✅ Done (2026-04-02) | phase 4, import methods                                        |
| 5 — Editor + Library  | ✅ Done (2026-04-02) | phase 5 complete, recipe creation                              |
| 6 — Shopping List     | ✅ Done (2026-04-02) | phase 6: shopping list functionality                           |
| 7 — Walmart           | ✅ Done (2026-04-02) | Phase 7: Walmart product search and cart integration           |
| 8 — Polish            | ✅ Done (2026-04-02) | UI changes and getting the walmart add to cart feature working |
| 9 — Rubric Compliance | ✅ Done (2026-04-06) | presentation/, product-research.md, aiDocs updated            |
| Post-9 — Features     | ✅ Done (2026-04-06) | Meal Planner, fractions, iOS polish, bug fixes                |
