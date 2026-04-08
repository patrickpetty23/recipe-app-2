# Changelog

## Rules
- What changed and why — not how
- 1-2 lines per entry
- Most recent at the top

---

## Day 10 — Meal Planner, iOS Polish, Bug Fixes (2026-04-06)

### Meal Planner Tab
- Added `meal_plan` table to SQLite schema (11 tables total) with recipe linkage, per-meal macros, date/type columns, and index on `planned_date`
- Implemented 4 new meal plan queries: `getMealPlanForWeek`, `addMealPlan`, `removeMealPlan`, `clearMealPlanForWeek`
- Added `chatMealPlanner` in openai.js — GPT-4o-powered conversational meal planning that knows the user's recipe library, dietary preferences, and current week's plan
- Built Planner tab (`app/(tabs)/planner.jsx`) — weekly calendar view, per-day meal slots (breakfast/lunch/dinner/snack), AI chat to auto-fill the week, manual add from recipe library, calorie/macro summaries per day
- Tab bar now has 5 tabs: Chat, Recipes, Shopping, Planner, Tracker

### Fraction Support
- Changed ingredient `quantity` column from `REAL` to `TEXT` in schema to store fractions natively (e.g. "3/4", "1 1/2")
- Added `parseFraction()` and `toFractionString()` to `src/utils/scaler.js` — handles mixed numbers, simple fractions, and decimals; displays user-friendly fractions (½, ¾, etc.)
- `mapIngredientRow` in queries.js now uses `parseFraction` for consistent numeric handling

### Shopping List Enhancements
- Added individual ingredient add-to-list — users can now add specific ingredients from a recipe, not just entire recipes
- New queries: `addIngredientsToList`, `removeIngredientFromList`
- Shopping list UI expanded with add modal (pick recipe → pick ingredients), swipe-to-delete individual items

### Recipe Detail & Editor Fixes
- Added `addIngredient` and `addRecipeStep` query functions — users can add new ingredients and steps directly from the recipe detail screen
- Removed "Start Cooking" button from ingredients tab (moved to steps tab only)
- UI fixes on recipe detail page layout and styling

### iOS Cross-Platform Polish
- Replaced all hardcoded `paddingTop` values with `useSafeAreaInsets()` across every screen
- Fixed iOS tab bar invisible bug — added `SafeAreaProvider` at root `_layout.jsx`
- Consistent cross-platform tab bar and header sizing with platform-specific height calculations
- Fixed memory leak in component cleanup

### Walmart Signing Fix Loop
- Attempted WebCrypto (`crypto.subtle`) for RSA signing → failed: unavailable in Expo Go runtime
- Attempted dotenv quoted multiline PEM with robust `\n` handling → partial fix
- Reverted to `node-forge` as the sole RSA signing implementation — confirmed working in Expo Go on both iOS and Android

### Image Generation Fix Loop
- Attempted fal.ai FLUX for step illustrations → reverted (external dependency)
- Attempted Gemini 2.0 Flash (free tier) → model name issues
- Attempted HuggingFace FLUX.1-schnell (free tier) → reverted
- Settled back on DALL-E 3 for all image generation (thumbnails 1792×1024, step illustrations 1024×1024)

### Collections & UI
- Cleaned up collections creation modal UI
- Fixed collection filter UX and refresh counts

---

## Day 9 — Final Rubric Compliance + Docs (Phase 9 continued)
- Updated all aiDocs to reflect current project state (context.md, architecture.md, prd.md)
- Added version history to PRD with three tracked revisions and updated success metrics from measured results
- Created ai/plans/ folder with 8 per-phase plan documents (phase1 through phase8)
- Created presentation/ folder: 17-slide HTML deck, demo script with timing, executive summary, feature map
- Added system architecture diagram to presentation materials
- Created product-research.md documenting customer research, competitive analysis, success metrics, and feedback loop
- Fixed .gitignore to properly exclude .env files (previous entry had typo: .testEnvVars vs .envTestVars)
- Resolved 4 bugs found in static analysis: PanResponder stale closure in cooking mode, TTS re-enable bug, OpenAI null-safety, unused import
- Added auto-generation pipeline: DALL-E 3 thumbnail + DALL-E 2 parallel step illustrations fire on every recipe save
- Tagged release: git tag v1.0-demo

---

## Day 8 — Android Polish (feature/android-polish branch)

### Milestone 5 — Nutrition Tracking + Voice Cooking + Timers
- Added recipe_nutrition and cook_log tables to SQLite schema; added nutrition and cook-log queries
- Implemented GPT-4o nutrition estimation (estimateNutrition) and recipe lightening (lightenRecipe) in openai.js
- Recipe detail: AI nutrition panel with calorie number, animated macro bars (Protein/Carbs/Fat), "Log Meal" button, "Make it Lighter" button
- Editor: auto-estimates nutrition in background (non-blocking) on every save
- Cooking mode: TTS step narration via expo-speech (rate 0.85 Android), in-app countdown timer with MM:SS ring, voice alert on timer completion
- New Tracker tab: daily calorie ring, macro progress bars vs goals, today's meals log with delete, recent history, editable goals modal
- Registered Tracker as 4th tab with fitness icon

### Milestone 4 — Editor Redesign + Collections + Warm Theme
- Editor: image preview at top, editable step cards, per-step illustration button, "Generate All Illustrations" batch action
- Library: horizontal Collections row (emoji + name cards), "Create Collection" modal, long-press recipe to add to collection
- Warm colour theme applied across all screens: #FF6B35 orange, #FFF8F0 cream, consistent throughout

### Milestone 3 — Recipe Detail Redesign + Cooking Mode
- Recipe detail: hero image with LinearGradient overlay, sticky metadata bar, ingredient/steps tabs, portion scaler
- Cooking mode: full-screen dark UI, swipe gesture navigation, progress dots, screen-stays-on (expo-keep-awake)
- Per-step illustration generation button (DALL-E 3)

### Milestone 1–2 — Schema + Chat Tab
- Replaced original Scan tab with iMessage-style chat interface (Chat tab)
- GPT-4o routing: recipe type → save to library; answer type → show as message
- Extended schema: image_uri, source_url, prep_time, cook_time, cuisine, recipe_steps, collections, chat_messages, app_settings

---

## Day 7 — Rubric Audit + Process Artifacts (Phase 9)
- Ran full rubric audit against Casey's and Jason's grading criteria — identified 5 critical gaps
- Removed `ai/` from `.gitignore` so graders can see roadmaps, plans, and changelogs
- Updated changelog to reflect all post-Phase 7 work that was missing
- Added Phase 9 rubric-crushing checklist to roadmap covering all remaining deliverables

### Bug Found via Logs and Fixed (test-log-fix loop)
- **Bug**: Walmart "Send to Cart" opened cart page but items were not added.
- **How found**: `logger.info('walmart.buildCartLink', { url })` showed the URL being generated as `walmart.com/cart?items=ID` — search confirmed this format only navigates to cart, does not add items.
- **Fix**: Changed to `affil.walmart.com/cart/addToCart?items=ID|1` format per Walmart Affiliate API docs.
- **Validation**: Re-tested with flour and eggs; both appeared pre-added in Walmart cart. Log showed `{"action":"walmart.buildCartLink","url":"https://affil.walmart.com/cart/addToCart?items=..."}` ✅

---

## Test-Log-Fix Loops

These are concrete examples of the test → read logs → diagnose → fix cycle used throughout development.

### Loop 1: `Can't resolve 'crypto'` (Phase 7 → Phase 8)
- **Test:** App crashed on launch after implementing Walmart integration
- **Log/Error:** Metro bundler error: `Can't resolve 'crypto' in src/services/walmart.js` — React Native cannot bundle Node.js built-in modules
- **Diagnosis:** `walmart.js` had a conditional branch `if (typeof window === 'undefined') { const crypto = require('crypto'); ... }` for Node.js environments. Even though the code path was guarded, Metro's static analysis still tried to resolve the `require('crypto')` call.
- **Fix:** Removed the Node.js `crypto` branch entirely. Made `node-forge` the sole RSA signing implementation for React Native. CLI test scripts (`scripts/test-walmart.js`) continue to use Node.js `crypto` directly since they run in Node, not React Native.
- **Verification:** App launches cleanly; `./scripts/test.sh` exits 0

### Loop 2: Walmart cart URL doesn't add items (Phase 7 → Phase 8)
- **Test:** User tapped "Send to Walmart" — browser opened Walmart.com but cart was empty
- **Log:** `logger.info('walmart.buildCartLink.success', { url })` showed the generated URL was `https://www.walmart.com/cart?items=ID1,ID2`
- **Diagnosis:** The `walmart.com/cart?items=` URL format only navigates to the cart page — it does not trigger an add-to-cart action. Walmart's actual add-to-cart URL uses a different domain and format.
- **Fix:** Changed `buildCartLink` to generate `https://affil.walmart.com/cart/addToCart?items=ID|1,ID|1` — the affiliate URL format with `|QTY` suffix per item that actually adds items to the cart.
- **Verification:** Tapping "Send to Walmart" now opens browser with items in the cart

### Loop 3: `better-sqlite3` version mismatch (Phase 2)
- **Test:** `./scripts/test.sh` failed during CI test run
- **Log/Error:** `ERR_DLOPEN_FAILED` — native module compiled against a different Node.js version
- **Diagnosis:** `better-sqlite3` is a native C++ addon that must be compiled for the specific Node.js version. Switching Node versions (e.g., via nvm) invalidates the compiled binary.
- **Fix:** Ran `npm rebuild better-sqlite3` to recompile against the current Node.js version
- **Verification:** `node scripts/test-db.js` exits 0 with all 27 assertions passing

---

## Day 6 — Home Page Redesign + Polish (Phase 8)
- Redesigned Scan tab into a Home page with hero section, recipe count stat card, and a single "Add Recipe" button — cleaner entry point for new users
- Added modal popup for import method selection (camera, photos, URL, PDF/DOCX) — replaces the four separate buttons that cluttered the old Scan screen
- Updated tab bar: renamed "Scan" to "Home", changed icon from camera to home, hidden default header
- Fixed Shopping List UI layout — replaced fragile absolute positioning with flexbox column layout; removed duplicate header caused by Expo Router default header overlapping custom header
- Fixed Walmart "Send to Cart" URL — changed from `walmart.com/cart?items=` (which only navigated to cart) to `affil.walmart.com/cart/addToCart?items=ID|1` (which actually adds items)
- Fixed `Can't resolve 'crypto'` error — removed Node.js `crypto` fallback from `walmart.js`, now uses `node-forge` exclusively in React Native
- Added graceful Walmart API key handling — app no longer crashes when key is missing; buttons remain visible and show a popup alert if tapped without credentials configured
- Updated `scripts/run.sh` to read Walmart private key from a file path (`WALMART_PRIVATE_KEY_PATH`) instead of requiring the full PEM inline in `.testEnvVars`

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
