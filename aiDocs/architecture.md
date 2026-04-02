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
├── ai/                            # ← GITIGNORED
│   ├── roadmaps/
│   └── notes/
├── scripts/                       # CLI testing scripts
│   ├── build.sh
│   ├── test.sh
│   └── run.sh
├── app/                           # Expo Router pages
│   ├── (tabs)/
│   │   ├── index.jsx              # Scan / Home tab
│   │   ├── library.jsx            # Saved recipes tab
│   │   └── list.jsx               # Shopping list tab
│   ├── recipe/
│   │   └── [id].jsx               # Recipe detail / edit
│   └── _layout.jsx
├── src/
│   ├── services/
│   │   ├── openai.js              # GPT-4o calls (image + text parsing)
│   │   ├── walmart.js             # Walmart API search + cart link
│   │   ├── scraper.js             # URL recipe scraping
│   │   └── fileParser.js          # PDF / DOCX text extraction
│   ├── db/
│   │   ├── schema.js              # SQLite table definitions
│   │   └── queries.js             # All DB read/write functions
│   ├── utils/
│   │   ├── logger.js              # Structured JSON logger
│   │   └── scaler.js              # Serving size scaling math
│   └── components/
│       ├── IngredientRow.jsx
│       ├── RecipeCard.jsx
│       └── ShoppingItem.jsx
├── .testEnvVars                   # ← GITIGNORED — API keys for testing
├── CLAUDE.md                      # ← GITIGNORED — AI tool instructions
├── .cursorrules                   # ← GITIGNORED — Cursor instructions
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
  quantity: number | null, // e.g. 2
  unit: string | null,     // e.g. "cups"
  notes: string | null,    // e.g. "sifted"
  checked: boolean         // for shopping list check-off
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

## SQLite Schema

```sql
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_uri TEXT,
  servings INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  notes TEXT,
  checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
```

## Service Design

### openai.js
- `parseImageIngredients(base64Image)` — sends image to GPT-4o Vision, returns `Ingredient[]`
- `parseTextIngredients(rawText)` — sends scraped/extracted text to GPT-4o, returns `Ingredient[]`
- All calls include a system prompt that instructs GPT-4o to return only valid JSON

**GPT-4o System Prompt (ingredient extraction):**
```
You are an ingredient extraction assistant. Given a recipe image or text, extract all ingredients and return ONLY a JSON array with no markdown, no explanation. Each item must have: name (string), quantity (number or null), unit (string or null), notes (string or null). If you cannot determine a value, use null.
```

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
export OPENAI_API_KEY="sk-..."
export WALMART_CLIENT_ID="..."
export WALMART_CLIENT_SECRET="..."
export LOG_LEVEL="debug"
```

## Navigation Flow
```
Tab: Scan
  └─ Camera view → Capture → Processing → Ingredient Editor → Save → Library

Tab: Library
  └─ Recipe list → Recipe detail → Edit ingredients → Add to shopping list

Tab: Shopping List
  └─ Combined ingredients → Check off items → Walmart search → Open cart link
```

## Key Technical Decisions
| Decision | Choice | Reason |
|----------|--------|--------|
| OCR method | GPT-4o Vision directly | Eliminates separate OCR step, handles messy cookbook typography |
| Storage | SQLite via expo-sqlite | Relational structure, better than AsyncStorage for recipes+ingredients |
| Navigation | Expo Router | File-based, simpler than React Navigation for this scope |
| Language | JavaScript (not TS) | Faster to write and debug in a 6-day sprint |
| Logging | Custom JSON logger | Structured output AI can parse; zero dependencies |
