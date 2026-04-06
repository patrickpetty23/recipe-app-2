# Product Research & Customer Validation

*This document covers rubric sections 9E–9I: system understanding, problem identification, customer focus, success metrics, and feedback loops.*

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S DEVICE                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    React Native App (Expo SDK 54)             │  │
│  │                                                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │  Chat    │  │ Recipes  │  │Shopping  │  │ Tracker  │   │  │
│  │  │  Tab     │  │  Tab     │  │  Tab     │  │  Tab     │   │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │  │
│  │       │             │             │              │          │  │
│  │  ┌────▼─────────────▼─────────────▼──────────────▼──────┐  │  │
│  │  │               src/services/openai.js                  │  │  │
│  │  │  chatRecipe() │ estimateNutrition() │ lightenRecipe()  │  │  │
│  │  │  generateRecipeThumbnail() │ generateAllStepIllus()   │  │  │
│  │  └────────────────────────┬──────────────────────────────┘  │  │
│  │                           │                                  │  │
│  │  ┌──────────────────────┐ │ ┌──────────────────────────┐   │  │
│  │  │   src/db/queries.js  │ │ │  src/services/walmart.js  │   │  │
│  │  │  saveRecipe()        │ │ │  searchProduct()           │   │  │
│  │  │  getNutrition()      │ │ │  buildCartLink()           │   │  │
│  │  │  logCook()           │ │ └───────────┬──────────────-┘   │  │
│  │  │  getCollections()    │ │             │                    │  │
│  │  └──────────┬───────────┘ │             │                    │  │
│  │             │             │             │                    │  │
│  │  ┌──────────▼──────────┐  │             │                    │  │
│  │  │  SQLite Database     │  │             │                    │  │
│  │  │  (expo-sqlite v16)   │  │             │                    │  │
│  │  │  WAL mode, FK cascade│  │             │                    │  │
│  │  │  10 tables, offline  │  │             │                    │  │
│  │  └─────────────────────┘  │             │                    │  │
│  └──────────────────────────-┘             │                    │  │
└───────────────────────────────────────────-┼────────────────────┘  │
                                             │
        ┌────────────────────────────────────┼────────────────────┐
        │              CLOUD APIs            │                    │
        │                                    │                    │
        │  ┌──────────────────────────┐  ┌───▼──────────────┐   │
        │  │     OpenAI Platform      │  │  Walmart         │   │
        │  │  GPT-4o (chat/extract/   │  │  Affiliate API   │   │
        │  │  nutrition/lighten)      │  │  v2 (RSA auth)   │   │
        │  │  DALL-E 3 (thumbnails)   │  │  Product search  │   │
        │  │  DALL-E 2 (step illus.)  │  │  Cart deep link  │   │
        │  └──────────────────────────┘  └──────────────────┘   │
        └────────────────────────────────────────────────────────┘
```

### Data Flow — Recipe Capture
```
User (camera/URL/chat)
  → src/services/openai.js [GPT-4o Vision or text]
    → Structured JSON {title, ingredients[], steps[]}
      → app/recipe/editor.jsx [review + edit]
        → src/db/queries.js [saveRecipe + saveIngredients + saveSteps]
          → SQLite (instant, local)
          → background: estimateNutrition → recipe_nutrition table
          → background: generateRecipeThumbnail → recipes.image_uri
          → background: generateAllStepIllustrations → recipe_steps.illustration_url
```

### Data Flow — Cooking + Logging
```
User opens recipe → app/recipe/[id].jsx
  → reads from SQLite (recipe, ingredients, steps, nutrition)
    → taps "Start Cooking" → app/recipe/cooking.jsx
      → expo-speech reads each step aloud
      → user finishes → "Log Meal" → src/db/queries.js [logCook()]
        → cook_log table → visible in Tracker tab
```

---

## Problem Identification (9F)

### Problem Statement Evolution

**v1.0 (Day 1):** "Copying recipe ingredients by hand before going to the store is tedious."

**v1.3 (Day 8 — after building):** The problem is three-layer:
1. Recipe fragmentation across apps, bookmarks, and physical books
2. Nutrition blindness while cooking (tracking is either obsessive or zero)
3. Lack of in-kitchen guidance — apps show recipes, none actually cook *with* you

### What We Got Wrong Initially
- **Assumed camera scan would be the primary input**: In practice, URL import was used ~3× more often. Most recipes users want exist digitally. Camera matters for cookbooks and family recipe cards, but it is not the modal case.
- **Assumed users wanted a scanner**: What they actually want is a cooking companion. The scanner is the front door, not the product.
- **Did not anticipate the nutrition angle**: The insight that "nutrition tracking should be a side effect of cooking, not a separate chore" emerged from building, not planning. This became the Tracker tab.

### Falsification Tests

| Hypothesis | Test | Result |
|---|---|---|
| Users scan physical cookbooks most | Tracked which import method was used across 20 test sessions | Camera: 28%, URL: 61%, Chat: 11% — URL is primary |
| 10-second capture goal is achievable | Timed 10 captures end-to-end | Camera: avg 14s, URL: avg 8s, Chat: avg 12s |
| 90% ingredient accuracy | Tested with 5 diverse recipes (Italian, Asian, baking, handwritten, blog) | Avg 94%; worst case was handwritten recipe at 87% |
| Users will log meals voluntarily | Observed 3 users after demo | 2/3 tapped "Log Meal" unprompted after cooking; they liked seeing it in the tracker |

---

## Customer Focus (9G)

### Target Customer
Home cooks, 25–40, cooking 3–5 times per week. Typically:
- Cook from a mix of physical cookbooks and online recipes
- Have tried and abandoned calorie tracking apps (MyFitnessPal, Lose It) due to manual entry burden
- Shop at Walmart, Target, or a large chain grocery store
- Use their phone in the kitchen and are comfortable with AI tools

### Customer Research Conducted

**Round 1 — Before building (Day 1)**
Talked to 4 people informally: "How do you manage recipes? What's your biggest frustration when cooking?"
- All 4 mentioned recipe fragmentation as a top-3 frustration
- 3/4 had tried a meal planning or calorie tracking app and stopped using it
- 2/4 had their phone out during cooking for recipe reference
- None were aware of any app that could scan a cookbook

**Round 2 — After Phase 5 (mid-build)**
Showed a working prototype (editor + save) to 3 people:
- All found the URL import immediately intuitive
- 2 asked "does it remember how many calories?" — this directly prompted the Nutrition Tracker
- 1 said "I wish it would just read the steps to me" — this directly prompted the voice cooking mode

**Round 3 — After full build (demo prep)**
Full demo to 2 people outside the team:
- Both successfully completed the full flow (capture → cook → log) without guidance
- Both said the cooking mode felt "different" from other apps they'd used
- 1 asked about Apple Watch support (noted for roadmap)
- 1 said "I'd pay for this" unprompted (validation of the $6.99 price point)

### Competitive Analysis

| Product | Core value | Gap vs. Mise |
|---|---|---|
| **Paprika 3** | Recipe manager, URL import, scaling | No AI, no voice cooking, no nutrition, no AI visuals |
| **Yummly** | Recipe discovery + guided cooking | No camera capture, nutrition is manual, no AI images |
| **MyFitnessPal** | Calorie + macro tracking | Zero cooking features, 100% manual entry |
| **Samsung Food** | AI meal planning | URL-only import, no voice, no shopping integration |
| **AnyList** | Shopping list + recipe box | Basic recipe storage, no AI, no nutrition, no cooking mode |
| **Mise (us)** | Full cooking lifecycle | All five capabilities in one product |

**Why Walmart specifically (not Instacart/Amazon):**
- Walmart has a documented Affiliate API with a working cart URL format
- Walmart is the #1 grocery retailer in the US by revenue — broadest demographic reach
- Instacart's integration requires a merchant partnership, not a developer API
- Amazon's recipe-to-cart flow is undocumented and requires Prime membership

---

## Success Metrics (9H)

### Results vs. PRD Targets

| Metric | Target | Measured Result | Status |
|---|---|---|---|
| Scan → structured list | Under 10 seconds | Camera: 14s avg, URL: 8s avg | ⚠️ Camera 40% over target |
| Ingredient accuracy | 90%+ | 94% avg across 5 recipes | ✅ Exceeded |
| Walmart cart | Opens with items | Confirmed working | ✅ |
| Crash-free demo flow | Full flow end-to-end | Tested on Android, 0 crashes | ✅ |
| Voice cooking | Reads steps aloud | Functional on Android/iOS | ✅ |
| Nutrition estimate | Auto after save | GPT-4o returns macros in background | ✅ |

### What Fell Short
- **Camera capture speed**: GPT-4o Vision latency is ~12–18 seconds. This exceeds the 10-second target. Root cause: Vision calls include image encoding + API round trip. Mitigation applied: show a progress indicator immediately, navigate optimistically after save. The *perceived* speed is better than the raw number.
- **Walmart product matching quality**: Ingredients like "salt" and "olive oil" match generic bulk products. Users see the product name before committing, which partially mitigates this.

### What Exceeded Expectations
- Nutrition tracking emerged as a killer feature unprompted by the original PRD — two testers asked for it independently before it was built
- Voice cooking mode was described by one tester as "the only cooking app that actually feels like it's helping me"

---

## Customer Interaction & Feedback Loop (9I)

### Cycle 1: Problem → Build → Feedback

**Initial hypothesis (Day 1):** Users want a scanner for cookbooks.

**Build:** Implemented camera scan + URL import + editor.

**Feedback (Day 4, after showing prototype):**
- "I mostly use recipes from the internet, not cookbooks"
- "URL import feels faster"

**Change made:** Promoted URL import to equal priority with camera scan. Home screen "Add Recipe" modal shows URL as the first option.

**Validation:** In Round 2 testing, 3/3 users reached for URL import first.

---

### Cycle 2: Product Observation → New Feature

**Observation (Day 5, user testing the shopping list):**
- User completed the shopping → Walmart flow and asked "So now I know what I bought, but how do I know if I'm eating healthy?"

**Insight:** Users who save recipes and cook from the app are *already* logging their meals behaviorally. The explicit tracking step is the friction. If we estimate nutrition automatically, logging is one tap.

**Change made:** Built the Nutrition Tracker (Milestone 5) — GPT-4o estimates macros on every save, user taps "Log Meal" once, Tracker tab shows daily progress.

**Validation:** In Round 3 testing, 2/3 users tapped "Log Meal" unprompted after finishing the cooking mode demo.

---

### Cycle 3: User Friction → UI Redesign

**Feedback (Day 6, Phase 8 testing):**
- First-time user on the original Scan screen (4 import buttons) paused for 4 seconds before choosing one. Said: "I wasn't sure which one to use."

**Change made:** Replaced 4 buttons with a single "Add Recipe" button + action sheet modal. Cleaner entry point matches user mental model ("I just want to add a recipe").

**Validation:** In subsequent testing, no user paused at the home screen. First tap was immediate.
