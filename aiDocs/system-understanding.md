# System Understanding — Recipe Scanner

## System Diagram (Final)

```
                        ┌─────────────────────────────────────────────┐
                        │              RECIPE SOURCES                  │
                        │                                             │
                        │  Cookbook   Phone     Recipe   PDF/   Plain  │
                        │  (Camera)  Gallery   Website  DOCX   Text   │
                        └────┬─────────┬─────────┬───────┬──────┬────┘
                             │         │         │       │      │
                             ▼         ▼         ▼       ▼      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    iPHONE APP (React Native / Expo SDK 54)                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        CHAT TAB (Primary Interface)                     │ │
│  │                                                                         │ │
│  │  Conversational AI assistant — user sends text, photos, URLs, or files  │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐  │ │
│  │  │ Camera/Photo │  │ URL (scraped │  │ PDF/DOCX   │  │ Plain text / │  │ │
│  │  │ ──▶ base64   │  │ via scraper) │  │ (parsed    │  │ conversation │  │ │
│  │  │ ──▶ GPT-4o   │  │ ──▶ GPT-4o   │  │ locally)   │  │ ──▶ GPT-4o   │  │ │
│  │  │    Vision    │  │    Text      │  │ ──▶ GPT-4o  │  │    Text      │  │ │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  └──────┬───────┘  │ │
│  │         └─────────────────┴────────────────┴────────────────┘           │ │
│  │                                    │                                     │ │
│  │                    Structured JSON {title, ingredients[], steps[]}       │ │
│  │                    displayed as RecipeCard in chat                       │ │
│  └────────────────────────────────────┬────────────────────────────────────┘ │
│                                       │ "Save to Recipe Book"                │
│                                       ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        EDITOR SCREEN                                    │ │
│  │  - Review/edit parsed ingredients (name, qty, unit per row)             │ │
│  │  - Edit recipe steps (add, remove, reorder)                             │ │
│  │  - Set title, servings, prep time, cook time, cuisine                   │ │
│  │  - On save: triggers background AI tasks ──┐                            │ │
│  └──────────────────────────┬─────────────────┼────────────────────────────┘ │
│                             │                 │                               │
│                             │    ┌────────────▼────────────────┐             │
│                             │    │  BACKGROUND AI (on save)     │             │
│                             │    │  - estimateNutrition()       │             │
│                             │    │    ──▶ GPT-4o ──▶ macros     │             │
│                             │    │  - generateRecipeThumbnail() │             │
│                             │    │    ──▶ DALL-E 3 ──▶ image    │             │
│                             │    └─────────────────────────────┘             │
│                             ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    SQLite (Local DB — 9 tables)                      │    │
│  │                                                                     │    │
│  │  recipes ─────────┬── ingredients (FK, cascade, in_list flag)       │    │
│  │                   ├── recipe_steps (step_number, illustration_url)  │    │
│  │                   ├── recipe_nutrition (calories, protein, carbs,   │    │
│  │                   │                     fat, fiber per serving)     │    │
│  │                   └── recipe_collections (junction to collections)  │    │
│  │  collections (name, emoji)                                          │    │
│  │  cook_log (recipe_id, servings, calories, macros, cooked_at)       │    │
│  │  chat_messages (role, content, image_uri)                           │    │
│  │  app_settings (key-value: daily goals, onboarding state)           │    │
│  └───────────┬──────────────┬──────────────┬──────────────┬───────────┘    │
│              │              │              │              │                  │
│              ▼              ▼              ▼              ▼                  │
│  ┌───────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────┐       │
│  │ RECIPES TAB   │ │ SHOPPING TAB │ │ TRACKER TAB│ │ RECIPE DETAIL│       │
│  │               │ │              │ │            │ │              │       │
│  │ - All saved   │ │ - Merged     │ │ - Daily    │ │ - Ingredients│       │
│  │   recipes     │ │   ingredient │ │   calorie  │ │   / Steps    │       │
│  │ - Search +    │ │   list       │ │   ring     │ │   tabs       │       │
│  │   sort        │ │ - Check-off  │ │ - Macro    │ │ - Servings   │       │
│  │ - Collections │ │ - Walmart    │ │   progress │ │   scaler     │       │
│  │   (emoji      │ │   search +   │ │   bars     │ │ - Log Meal   │       │
│  │   folders)    │ │   prices     │ │ - Today's  │ │ - Make It    │       │
│  │ - Swipe to    │ │ - Send to    │ │   meal log │ │   Lighter    │       │
│  │   delete      │ │   Walmart    │ │ - Editable │ │ - DALL-E     │       │
│  │ - DALL-E      │ │   cart       │ │   daily    │ │   step illus.│       │
│  │   thumbnails  │ │ - Add from   │ │   goals    │ │ - Share      │       │
│  └───────────────┘ │   recipe     │ │ - History  │ │ - Cooking    │       │
│                     │   picker     │ └────────────┘ │   Mode ──────┤       │
│                     └──────────────┘                └──────────────┘       │
│                            │                               │               │
│                            ▼                               ▼               │
│  ┌───────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │      WALMART INTEGRATION          │  │      COOKING MODE            │  │
│  │                                   │  │                              │  │
│  │  Per-ingredient:                  │  │  - Full-screen dark UI       │  │
│  │    name ──▶ Walmart API ──▶       │  │  - Step-by-step navigation   │  │
│  │    product name + price           │  │  - DALL-E illustrations      │  │
│  │                                   │  │  - Text-to-speech (TTS)      │  │
│  │  Bulk action:                     │  │  - Countdown timer           │  │
│  │    matched IDs ──▶                │  │  - Swipe gestures            │  │
│  │    affil.walmart.com/cart/        │  │  - Haptic feedback           │  │
│  │    addToCart ──▶ opens browser    │  │  - Screen stays awake        │  │
│  └───────────────────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────────────────────┐
        │                 EXTERNAL SERVICES                     │
        │                                                      │
        │  ┌────────────────────────┐  ┌─────────────────────┐ │
        │  │ OpenAI Platform        │  │ Walmart Affiliate   │ │
        │  │                        │  │ API v2              │ │
        │  │ GPT-4o:                │  │                     │ │
        │  │  - Vision (images)     │  │ - Product search    │ │
        │  │  - Text (chat/parse)   │  │ - RSA-signed auth   │ │
        │  │  - Nutrition estimate  │  │   (node-forge)      │ │
        │  │  - Lighten recipe      │  │ - In-memory cache   │ │
        │  │                        │  │ - Cart deep link    │ │
        │  │ DALL-E 3:              │  └─────────────────────┘ │
        │  │  - Recipe thumbnails   │                          │
        │  │  - Step illustrations  │  ┌─────────────────────┐ │
        │  │                        │  │ Recipe Websites      │ │
        │  │ expo-speech (TTS):     │  │ (fetch + regex       │ │
        │  │  - Cooking mode voice  │  │  strip via scraper)  │ │
        │  └────────────────────────┘  └─────────────────────┘ │
        └──────────────────────────────────────────────────────┘
```

## Midterm System Diagram (For Reference)

At midterm, our understanding of the system looked like this:

```text
Recipe Sources
(cookbooks, social screenshots, blogs)
            |
            v
      User Capture Step
 (camera or photo library import)
            |
            v
      Recipe Scanner App
  OCR -> Parser -> Edit -> Shopping
            |
            v
      Grocery Execution
   (in-store checklist usage)
            |
            v
     User Outcomes Loop
  time saved, fewer missed items,
  confidence to reuse app weekly
```

**Midterm leverage points:**
1. Improve parser precision on common ingredient formats
2. Keep edit mode extremely fast and low-friction
3. Persist history so recurring users avoid rescanning
4. Keep offline flow reliable to reduce adoption friction

**Midterm thesis:** "The app does not need perfect OCR to win. It needs good-enough first extraction, fast correction, and reliable checklist output."

---

## How the System Evolved from Midterm

### What the midterm diagram got right

The midterm thesis — good-enough extraction + fast correction + reliable output — held up completely. That instinct was correct and guided good decisions throughout development. The linear flow (source → capture → parse → edit → shop) is still the core user journey.

The leverage points were also directionally correct: parser precision, fast editing, persistent history, and offline reliability all turned out to matter. We validated every one of them.

### What the midterm diagram missed

The midterm diagram was a **vertical pipeline** — one input at the top, one output at the bottom, no branches. Building revealed the real system is **wider and more interconnected** than that. Here's what changed:

**1. Recipe sources expanded from 2 to 4 input paths**

The midterm diagram showed "camera or photo library import" as the capture step. We originally designed around camera scanning as the primary input — cookbooks and social screenshots. Building revealed that users interact with recipes from multiple sources. URL import turned out to be the preferred method for most testers because it's faster and doesn't require good lighting or a steady hand. We added a URL scraper (`scraper.js`) and a file parser for PDF/DOCX (`fileParser.js`), turning one input path into four parallel paths that all converge on the same editor.

The Home screen itself had to be redesigned. Our first version had four separate buttons on a "Scan" tab. Users found this confusing — they didn't know which button to press. We replaced it with a single "Add Recipe" button that opens a modal, which is a UX pattern users already understand from other apps.

**2. GPT-4o became the system backbone, not just an OCR step**

The midterm diagram had "OCR → Parser" as a single box inside the app. In practice, GPT-4o became the universal parser for *every* input method — not just images. URL-scraped HTML, PDF-extracted text, and camera images all go through GPT-4o for structured ingredient extraction. It handles messy HTML, inconsistent formatting, and even partial recipe text gracefully. The midterm treated AI as a narrow OCR step; the final system treats it as the central intelligence layer that normalizes all input into structured data.

**3. "Grocery Execution" became Walmart integration — with hidden complexity**

The midterm diagram had a vague "Grocery Execution (in-store checklist usage)" box. The final system replaces this with a concrete Walmart integration that turned out to be three layers deeper than expected:

- **Authentication**: The Walmart Affiliate API requires RSA-signed request headers. React Native doesn't have access to Node.js's `crypto` module, so we had to use `node-forge` for signing — a debugging session that cost significant time (documented in changelog as Test-Log-Fix Loop #1).
- **Cart URL format**: The documented `walmart.com/cart?items=` URL doesn't actually add items to a cart. We discovered through testing that the working format is `affil.walmart.com/cart/addToCart?items=ID|QTY` — completely undocumented in Walmart's official API docs (Test-Log-Fix Loop #2).
- **User trust**: Users didn't want a "black box" send-to-cart. They needed to see matched product names and prices before trusting the bulk action. This added an entire display layer between "shopping list" and "send to cart" that the midterm didn't anticipate.

**4. The editor's role was bigger than expected**

The midterm correctly identified "keep edit mode extremely fast and low-friction" as a leverage point. But we underestimated *why*. We originally treated the editor as a simple review screen — a formality before saving. Through user testing, we learned the editor is where users decide whether to trust the app. If GPT-4o misparses an ingredient (e.g., "1 cup flour" becomes "1 flour cup"), the editor is where the user catches it. Making the editor fast and intuitive became a higher priority than we expected — it's not just a correction tool, it's the trust-building moment.

**5. The input interface became conversational, not button-driven**

The midterm assumed a traditional scan-then-review flow: tap a button, pick an input method, get results. The final app replaced this with a **Chat tab** — a conversational AI interface where users send messages, photos, URLs, or files and get recipe cards back in a chat thread. This was a fundamental UX shift we didn't anticipate. The chat pattern handles all input methods through a single natural interface, and it also lets users ask cooking questions that aren't recipe imports (e.g., "what can I substitute for rice wine?"). The chat became the front door to the entire app.

**6. The app grew beyond recipe-to-list into a cooking lifecycle tool**

The midterm system ended at "Grocery Execution." Building and user feedback revealed three additional system layers we didn't plan for:

- **Nutrition tracking**: Users asked "how do I know if I'm eating healthy?" after saving recipes. We added `estimateNutrition()` via GPT-4o, which auto-estimates calories/protein/carbs/fat/fiber per serving on save. This feeds a **Tracker tab** with a daily calorie ring and macro progress bars. The insight: nutrition tracking should be a side effect of cooking, not a separate chore.
- **Cooking mode**: A full-screen step-by-step cooking interface with text-to-speech (expo-speech reads each step aloud), countdown timers, swipe navigation, and DALL-E 3 step illustrations. Users wanted the app to cook *with* them, not just help them plan.
- **Meal logging**: A "Log Meal" button records what was cooked (servings + macros) to a `cook_log` table, visible in the Tracker tab. This closes the loop from recipe → cook → track.
- **"Make it Lighter"**: An AI-powered feature (`lightenRecipe()`) that suggests healthier ingredient substitutions and shows calorie savings. Thomas explored this during testing and found the suggestions reasonable (e.g., swap heavy cream for low-fat sour cream).

**7. DALL-E 3 became a visual layer across the app**

Not anticipated at midterm at all. We added AI-generated images in two places:
- **Recipe thumbnails** (`generateRecipeThumbnail()`) — generated on save via DALL-E 3, displayed in the library as hero images. Makes the recipe library visually browsable rather than a plain text list.
- **Step illustrations** (`generateStepIllustration()`) — generated per cooking step, shown in cooking mode and recipe detail. Thomas called them "kind of cool" but noted they're "a little crude." These run in parallel via `Promise.allSettled` so failures don't block the save.

**8. The database grew from 2 tables to 9**

The midterm assumed `recipes` and `ingredients`. The final system has 9 tables: `recipes`, `ingredients`, `recipe_steps`, `recipe_nutrition`, `collections`, `recipe_collections`, `cook_log`, `chat_messages`, and `app_settings`. Each table emerged from a feature need we didn't anticipate — steps needed their own table for illustration URLs, nutrition needed per-serving storage, collections needed a junction table for many-to-many, and the tracker needed a cook log.

**9. The "User Outcomes Loop" became concrete feedback loops**

The midterm diagram had an abstract "User Outcomes Loop" at the bottom — time saved, fewer missed items, confidence to reuse. Building revealed specific, concrete feedback loops we didn't anticipate:

- The database needed an `in_list` flag bridging saved recipes and the shopping list — an ingredient can exist in a recipe but not be on the current list. This was a system relationship we didn't see until we built both features.
- Users accumulate recipes across multiple sessions and expect the shopping list to merge them. We designed for single-recipe flows at midterm.
- The serving size scaler turned out to be a core feature, not a nice-to-have — users immediately tried adjusting servings, which ripples through quantities on the shopping list.
- The **cook → log → track** loop creates a reason to return daily, not just when planning a grocery trip. This was the biggest system expansion we didn't see at midterm.

### Leverage points: midterm vs. final

| Midterm Leverage Point | Still Valid? | What We'd Say Now |
|---|---|---|
| "Improve parser precision on common ingredient formats" | Yes, but reframed | GPT-4o handles precision well enough. The real leverage is supporting *multiple input formats* (URL, PDF, photo), not just tuning one parser. |
| "Keep edit mode extremely fast and low-friction" | Yes — validated and elevated | Correct instinct, but the reason is deeper than we thought. The editor isn't just for corrections — it's the trust-building moment that determines whether users save or abandon. |
| "Persist history so recurring users avoid rescanning" | Yes — validated | SQLite library works exactly as intended. Added `in_list` flag to bridge recipes and shopping list, which we didn't anticipate. |
| "Keep offline flow reliable to reduce adoption friction" | Yes — validated | Local-only SQLite confirmed as the right call. No user asked for cloud sync. |

| New Leverage Point (Discovered Through Building) | Why We Didn't See It at Midterm |
|---|---|
| URL import as the preferred input method | We assumed cookbooks were the primary source. Users actually find recipes online first. |
| Walmart product preview before cart send | We assumed users would trust a bulk action. They need to see names and prices first. |
| Serving size scaler as a core feature | We listed it as P0 but thought of it as a bonus. Users reach for it immediately. |
| Conversational chat interface as the primary input | We designed button-driven import flows. Chat turned out to be more natural — users describe what they want, attach photos, or paste URLs in one unified interface. |
| Nutrition tracking as a side effect of cooking | We scoped the app to recipe→list. Users asked about calories unprompted, revealing that tracking should be automatic, not a separate chore. |
| Cooking mode with TTS as a retention driver | We stopped at "shopping list." Users wanted the app to help them *cook*, not just plan. Step-by-step voice guidance creates a reason to keep the app open during the meal. |
| DALL-E illustrations as a trust and engagement signal | We didn't plan any visual generation. Thumbnails make the library browsable; step illustrations make cooking mode feel guided rather than text-heavy. |

### Feedback loops discovered

1. **Parse → Edit → Re-parse loop**: Users sometimes paste a URL, get a partial result, then re-import or manually fix. The system needs to support both AI-assisted and manual correction paths.
2. **Shop → Discover → Return loop**: While checking Walmart prices, users sometimes realize an ingredient is too expensive and want to go back to the recipe to find a substitute. Kierra explicitly asked for substitution suggestions ("Can I ask the AI? I don't have rice wine. What's a good substitution?"). We didn't build this path, but it's a clear next iteration.
3. **Multi-recipe accumulation**: Users don't just scan one recipe — they scan several throughout the week and expect the shopping list to accumulate. The `in_list` flag per ingredient enables this, but we originally designed for single-recipe flows.
4. **Cart review → Deselect loop**: Thomas expected checked-off items (things he already has) to be excluded from the Walmart cart send. The system currently sends everything regardless, breaking the user's mental model of "checked = I have it, skip it."
5. **User segmentation fork**: Final interviews revealed the system serves two distinct user types with different endpoints. Pickup/delivery users (Thomas) want the full pipeline ending at Walmart cart. In-store shoppers (Sherrie) want the pipeline to end at an exported list. The system needs both exit paths, not just one.
