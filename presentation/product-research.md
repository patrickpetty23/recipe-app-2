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

**Round 4 — Final user tests (April 2026)**
Hands-on sessions with 3 users outside the team's friend circle. Kierra and Thomas tested the current app with Walmart integration; Sherrie tested an earlier version.

- **Kierra** (cooks frequently, shops Walmart/Sam's/Smith's): Loved instant ingredient extraction from URL ("super annoying on Pinterest with all the ads"). Confused by NaN quantities. Wanted ingredient substitutions and multiple grocery stores. Would use regularly.
- **Sherrie** (experienced cook, 3-4x/week, uses Recipe Keeper): Does NOT want Walmart cart integration — shops in-person, picks own produce. Wants export to Apple Notes/Lists. Wants calorie counting integration. "I just want a list."
- **Thomas** (wife Chris cooks 4x/week, weekly Walmart pickup): Camera-scanned a cookbook — worked with minor parsing edge cases. **Enthusiastically validated Walmart cart.** Described the feature unprompted before seeing it: "It'd be cool if you could just get a recipe and it would add everything to your Walmart pick-up order." Sent items to actual Walmart cart. "I'm sold."

**Key finding:** Users split into two types. Pickup/delivery shoppers (Thomas) want the full pipeline to Walmart cart. In-store shoppers (Sherrie) want recipe→list exported to their own tools. Both types value the AI extraction; they diverge at the shopping step.

### Competitive Analysis

| Product | Core value | Gap vs. Mise |
|---|---|---|
| **Paprika 3** | Recipe manager, URL import, scaling | No AI, no voice cooking, no nutrition, no AI visuals |
| **Yummly** | Recipe discovery + guided cooking | No camera capture, nutrition is manual, no AI images |
| **MyFitnessPal** | Calorie + macro tracking | Zero cooking features, 100% manual entry |
| **Samsung Food** | AI meal planning | URL-only import, no voice, no shopping integration |
| **AnyList** | Shopping list + recipe box | Basic recipe storage, no AI, no nutrition, no cooking mode |
| **Skylight** | Smart calendar with recipe scanning + grocery list | Recipe capture, countertop display | No AI parsing, no nutrition, no Walmart cart, no cooking mode. Different form factor (countertop vs. phone). Surfaced by Thomas during testing. |
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
- **Walmart price accuracy**: Thomas compared app estimates vs. actual Walmart cart — individual items were within cents, but the total was off by ~$6 ($32 estimated vs. $38 actual). Kierra said she'd "prefer no price if it's going to change." Price display needs an "estimated" label or better accuracy.
- **Per-serving meal logging**: Thomas found the "Log Meal" button tried to log all 6 servings instead of 1. The tracker is only useful if logging is per-serving.
- **NaN quantity display**: Kierra encountered NaN values for ingredients without specified quantities. Needs a default display (e.g., "to taste" or blank) instead of NaN.

### What Exceeded Expectations
- Nutrition tracking emerged as a killer feature unprompted by the original PRD — Sherrie explicitly asked for calorie counting, Thomas explored the tracker. Two earlier testers asked for it independently before it was built.
- Voice cooking mode was described by one tester as "the only cooking app that actually feels like it's helping me." Thomas navigated the full cooking flow in his session.
- Thomas validated the Walmart cart feature **unprompted** — he described the exact feature before seeing the app: "It'd be cool if you could just get a recipe and it would add everything to your Walmart pick-up order."
- DALL-E illustrations make the app feel more polished than expected for a class project. Thomas: "kind of cool."

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

---

### Cycle 4: Walmart Trust Gate → Price Preview

**Observation (Phase 7 testing):** Internal testing revealed discomfort sending items to a Walmart cart without seeing what products were matched.

**Change made:** Added per-ingredient product name and price display before the "Send to Walmart" button. Moved product matching from P1 to P0.

**Validation (Round 4):** Thomas reviewed prices, found them mostly accurate (within cents), and confidently sent items to his actual Walmart cart. Kierra reviewed prices but was bothered by discrepancies — "I would prefer no price if it's going to change." Price preview increases trust for most users, but accuracy is the next gate.

---

### Cycle 5: User Segmentation Discovery

**Feedback (Round 4):** Sherrie explicitly rejected the Walmart cart concept. Thomas enthusiastically validated it unprompted.

**Insight:** The app serves two user types with different endpoints. The Walmart integration is a strong differentiator for pickup/delivery users but irrelevant to in-store shoppers. Export-to-Notes is the equivalent "last mile" for the other segment.

**Change identified:** The app needs both exit paths: send to Walmart cart AND export list to external apps (Notes, Apple Lists, etc.).
