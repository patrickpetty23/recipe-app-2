# Recipe Scanner — Architecture

## Project Structure

```
recipe-scanner/
├── aiDocs/                        # ← TRACKED in git
│   ├── context.md
│   ├── prd.md
│   ├── mvp.md
│   ├── architecture.md
│   ├── coding-style.md
│   └── changelog.md
├── ai/                            # ← TRACKED in git
│   ├── roadmaps/
│   └── plans/
├── scripts/                       # CLI testing scripts
│   ├── build.sh
│   ├── test.sh
│   └── run.sh
├── app/                           # Expo Router pages
│   ├── (tabs)/
│   │   ├── _layout.jsx            # Tab bar config (Chat, Recipes, Shopping, Planner, Tracker)
│   │   ├── index.jsx              # Chat tab — iMessage-style AI cooking assistant
│   │   ├── library.jsx            # Recipes tab — library + collections
│   │   ├── list.jsx               # Shopping list tab — check-off + Walmart + individual item add
│   │   ├── planner.jsx            # Meal Planner tab — weekly calendar, AI meal suggestions
│   │   └── tracker.jsx            # Nutrition Tracker tab — daily macros + cook log
│   ├── recipe/
│   │   ├── [id].jsx               # Recipe detail — hero, nutrition, tabs, cooking
│   │   ├── cooking.jsx            # Cooking mode — TTS, swipe steps, timers
│   │   └── editor.jsx             # Recipe editor — ingredients, steps, illustrations
│   ├── onboarding.jsx             # First-launch onboarding screen (sets hasSeenOnboarding)
│   └── _layout.jsx
├── src/
│   ├── services/
│   │   ├── openai.js              # GPT-4o (chat, extraction, nutrition, lighten, meal plan) + DALL-E 3
│   │   ├── walmart.js             # Walmart API search + cart link
│   │   ├── scraper.js             # URL recipe scraping
│   │   └── fileParser.js          # PDF / DOCX text extraction
│   ├── db/
│   │   ├── schema.js              # SQLite schema + migrations (11 tables)
│   │   └── queries.js             # All DB read/write functions
│   ├── utils/
│   │   ├── logger.js              # Structured JSON logger
│   │   └── scaler.js              # Serving size scaling, fraction parsing + display
│   └── components/
│       ├── EmptyState.jsx
│       ├── SkeletonLoader.jsx
│       ├── SwipeableRow.jsx
│       └── WalmartProductCard.jsx
├── presentation/                  # Capstone presentation materials
│   ├── slides.html                # 17-slide HTML deck
│   ├── demo-script.md
│   ├── executive-summary.md
│   └── feature-map.md
├── .testEnvVars                   # ← GITIGNORED — API keys for testing
├── .cursorrules                   # ← TRACKED in git — Cursor behavioral guidance
├── .gitignore
├── app.json
├── package.json
└── README.md
```

## Data Models

### Recipe
```js
{
  id: string,              // UUID
  title: string,
  sourceType: "camera" | "photo" | "url" | "file",
  sourceUri: string | null,
  servings: number,        // base servings from recipe
  ingredients: Ingredient[],
  createdAt: string,       // ISO timestamp
  updatedAt: string
}
```

### Ingredient
```js
{
  id: string,              // UUID
  recipeId: string,
  name: string,            // e.g. "all-purpose flour"
  quantity: string | null, // stored as text to preserve fractions ("3/4", "1 1/2"); parsed via parseFraction()
  unit: string | null,     // e.g. "cups"
  notes: string | null,    // e.g. "sifted"
  checked: boolean,        // for shopping list check-off
  inList: boolean,         // whether ingredient is on the shopping list
  sortOrder: number        // display order within recipe
}
```

### WalmartProduct (ephemeral, not persisted)
```js
{
  itemId: string,
  name: string,
  price: number,
  thumbnailUrl: string,
  productUrl: string
}
```

### MealPlan
```js
{
  id: string,              // UUID
  recipeId: string | null, // linked recipe (SET NULL on delete)
  recipeTitle: string,
  recipeImageUri: string | null,
  plannedDate: string,     // 'YYYY-MM-DD'
  mealType: string,        // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  servings: number,
  calories: number | null,
  protein: number | null,
  carbs: number | null,
  fat: number | null,
  notes: string | null,
  createdAt: string
}
```

## SQLite Schema

```sql
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_uri TEXT,
  source_url TEXT,
  image_uri TEXT,                  -- AI-generated food photo (DALL-E 3)
  servings INTEGER NOT NULL DEFAULT 1,
  instructions TEXT,
  prep_time TEXT,
  cook_time TEXT,
  cuisine TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  notes TEXT,
  checked INTEGER NOT NULL DEFAULT 0,
  in_list INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE recipe_steps (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  illustration_url TEXT,           -- DALL-E 3 generated step illustration
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE recipe_nutrition (
  recipe_id TEXT PRIMARY KEY,
  calories_per_serving INTEGER,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  fiber_g REAL,
  estimated_at TEXT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE cook_log (
  id TEXT PRIMARY KEY,
  recipe_id TEXT,
  recipe_title TEXT NOT NULL,
  servings REAL NOT NULL DEFAULT 1,
  calories INTEGER,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  cooked_at TEXT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📁',
  created_at TEXT NOT NULL
);

CREATE TABLE recipe_collections (
  recipe_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  PRIMARY KEY (recipe_id, collection_id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  image_uri TEXT,
  created_at TEXT NOT NULL,
  recipe_id TEXT
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE meal_plan (
  id TEXT PRIMARY KEY,
  recipe_id TEXT,
  recipe_title TEXT NOT NULL,
  recipe_image_uri TEXT,
  planned_date TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  servings REAL NOT NULL DEFAULT 1,
  calories INTEGER,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
);
```

## Service Design

### openai.js
- `parseRecipeFromImage(base64Image)` — sends image to GPT-4o Vision, returns full recipe object (title, ingredients, steps, metadata)
- `parseRecipeFromText(rawText)` — sends scraped/extracted text to GPT-4o, returns full recipe object
- `processChat(messages, imageBase64?)` — freeform cooking assistant chat; returns `{type: 'recipe'|'answer', message, recipe?}`
- `estimateNutrition(ingredients, servings)` — GPT-4o estimates calories/protein/carbs/fat/fiber per serving
- `lightenRecipe(recipe)` — GPT-4o suggests healthier substitutions, returns lightened recipe + change list
- `generateRecipeThumbnail(title, cuisine, ingredients)` — DALL-E 3 food photo at 1792×1024
- `generateStepIllustration(stepText, recipeTitle, allSteps, ingredients)` — DALL-E 3 cookbook illustration at 1024×1024
- `generateAllStepIllustrations(steps, recipeTitle, ingredients)` — fires all step illustrations in parallel via `Promise.allSettled`
- `chatMealPlanner({messages, prefs, recipeLibrary, weekStart, weekEnd, currentPlan})` — GPT-4o meal planning chat; returns `{type: 'answer'|'meal_plan', message, items?}`
- All calls include structured system prompts that instruct GPT-4o to return only valid JSON
- JSON mode (`response_format: {type: 'json_object'}`) used where supported
- JSON fence-stripping handles GPT responses wrapped in ```json blocks

### walmart.js
- `searchProduct(ingredientName)` — hits Walmart Open API, returns top `WalmartProduct` match
- `buildCartLink(products)` — generates Walmart affiliate/deep link URL with item IDs
- Results are cached in memory per session to avoid redundant API calls

### scraper.js
- `scrapeRecipeUrl(url)` — fetches HTML, strips nav/ads/boilerplate, returns raw recipe text
- Uses `fetch()` + basic DOM parsing (via regex or cheerio-lite approach)
- Passes result to `openai.parseTextIngredients()`

### fileParser.js
- `parsePdf(fileUri)` — extracts text from PDF using expo-file-system + a PDF text lib
- `parseDocx(fileUri)` — extracts text from DOCX
- Passes result to `openai.parseTextIngredients()`

## Structured Logging

All logging uses `src/utils/logger.js` — never `console.log` in production code.

```js
// logger.js
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const levels = { error: 0, warn: 1, info: 2, debug: 3 };

function log(level, action, data = {}) {
  if (levels[level] > levels[LOG_LEVEL]) return;
  const entry = {
    level,
    action,
    timestamp: new Date().toISOString(),
    ...data
  };
  const output = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info:  (action, data) => log('info',  action, data),
  debug: (action, data) => log('debug', action, data),
  warn:  (action, data) => log('warn',  action, data),
  error: (action, data) => log('error', action, data),
};
```

**Usage:**
```js
logger.info('openai.parseImage', { imageSize: base64.length, model: 'gpt-4o' });
logger.error('walmart.searchProduct', { ingredient: name, error: err.message });
```

## CLI Scripts

### scripts/build.sh
```bash
#!/bin/bash
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
  echo '{"status":"fail","step":"npm install"}' >&2
  exit 1
fi
echo '{"status":"pass","step":"build"}'
exit 0
```

### scripts/test.sh
```bash
#!/bin/bash
source .testEnvVars 2>/dev/null

echo "Running tests..."
npm test -- --watchAll=false 2>&1
if [ $? -ne 0 ]; then
  echo '{"status":"fail","step":"tests"}' >&2
  exit 1
fi
echo '{"status":"pass","tests":"all"}'
exit 0
```

### scripts/run.sh
```bash
#!/bin/bash
echo "Starting Expo dev server..."
npx expo start --ios
```

## Environment Variables (.testEnvVars)
```bash
export EXPO_PUBLIC_OPENAI_API_KEY="sk-..."
export EXPO_PUBLIC_WALMART_CLIENT_ID="..."
export EXPO_PUBLIC_WALMART_KEY_VERSION="1"
export EXPO_PUBLIC_WALMART_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
export LOG_LEVEL="debug"
```

## Navigation Flow
```
Onboarding (first launch only)
  └─ Welcome → finish → Chat tab

Tab: Chat
  └─ iMessage UI → camera/URL/text → GPT-4o → recipe card → Save → Library

Tab: Recipes (Library)
  └─ Recipe grid (AI thumbnails) → Recipe Detail → Cooking Mode
                                 → Editor (edit/illustrate steps)
                                 → Add ingredients / steps inline
                                 → Log Meal → Tracker

Tab: Shopping List
  └─ Combined ingredients (merged by name+unit) → add individual items modal
     → check off → Walmart search → Open cart link

Tab: Planner
  └─ Weekly calendar → per-day meal slots (breakfast/lunch/dinner/snack)
     → AI chat to auto-fill week → manual add from recipe library
     → daily calorie/macro summary

Tab: Tracker
  └─ Calorie ring + macros → Today's meals → Recent history → Edit goals
```

## Key Technical Decisions
| Decision | Choice | Reason |
|----------|--------|--------|
| OCR method | GPT-4o Vision directly | Eliminates separate OCR step, handles messy cookbook typography |
| Storage | SQLite via expo-sqlite v16 | Relational structure, offline-first, WAL mode for performance |
| Navigation | Expo Router v6 | File-based routing across 8 screens (5 tabs + 3 recipe screens) |
| Language | JavaScript (not TS) | Faster to write and debug in sprint conditions |
| Logging | Custom JSON logger | Structured output, zero dependencies, AI-parseable |
| AI pipeline | Non-blocking background | Save is instant; nutrition/thumbnail/illustrations complete async |
| Image generation | DALL-E 3 for all images | DALL-E 3 quality for hero thumbnails (1792×1024) and step illustrations (1024×1024) |
| Quantity storage | TEXT column + parseFraction | Preserves fractions ("3/4", "1 1/2") for display; parsed to numbers for math |
| Safe area | useSafeAreaInsets | Consistent layout across iOS notch/Dynamic Island and Android nav bars |
| TTS | expo-speech | Native platform TTS, no API cost, works offline |
| Cross-platform | React Native + Expo | Single codebase verified on both iOS and Android |
