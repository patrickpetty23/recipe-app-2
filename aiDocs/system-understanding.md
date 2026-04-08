# System Understanding (Rubric 9E)

*Covers ecosystem elements, architecture diagram, data flows, leverage points, and how the system evolved from midterm to final delivery.*

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
│  │  │  logCook()           │ │ └───────────┬───────────────┘   │  │
│  │  │  getCollections()    │ │             │                    │  │
│  │  └──────────┬───────────┘ │             │                    │  │
│  │             │             │             │                    │  │
│  │  ┌──────────▼──────────┐  │             │                    │  │
│  │  │  SQLite Database     │  │             │                    │  │
│  │  │  (expo-sqlite v16)   │  │             │                    │  │
│  │  │  WAL mode, FK cascade│  │             │                    │  │
│  │  │  10 tables, offline  │  │             │                    │  │
│  │  └─────────────────────┘  │             │                    │  │
│  └───────────────────────────┘             │                    │  │
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

---

## Data Flow — Recipe Capture

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

## Data Flow — Cooking + Logging

```
User opens recipe → app/recipe/[id].jsx
  → reads from SQLite (recipe, ingredients, steps, nutrition)
    → taps "Start Cooking" → app/recipe/cooking.jsx
      → expo-speech reads each step aloud
      → user finishes → "Log Meal" → src/db/queries.js [logCook()]
        → cook_log table → visible in Tracker tab
```

---

## Ecosystem Elements and Relationships

| Element | Role | Relationship to app |
|---|---|---|
| React Native (Expo SDK 54) | Cross-platform UI runtime | Hosts all screens and navigation |
| GPT-4o | Intelligence layer | Recipe extraction, chat, nutrition estimation, recipe lightening |
| DALL-E 3 | Visual generation | Recipe thumbnail per saved recipe |
| DALL-E 2 | Step illustration | One illustration per cooking step |
| expo-sqlite v16 | Offline persistence | All recipes, ingredients, steps, nutrition, cook log stored locally |
| expo-speech | Voice output | Text-to-speech for each cooking step |
| Walmart Affiliate API v2 | Commerce layer | Product search + cart deep link per ingredient |
| expo-camera | Image capture | Camera scan input method for physical recipes |

---

## Goal of the Larger System

Mise participates in a larger ecosystem: the daily cycle of "what do I eat → how do I get ingredients → how do I cook it → what did I eat today?" Every competitor in the space addresses one segment of that cycle. The goal of Mise as a system is to close the loop — a single product that moves from recipe discovery all the way through to nutrition logging, without requiring the user to leave the app or enter data manually at any point.

The central leverage insight: if a user already cooks from the app, the nutrition log is a side effect. The system earns the tracking behavior without asking for it.

---

## The Four Leverage Points

1. **GPT-4o as the intelligence layer.** Every friction point in the cooking workflow — finding a recipe, capturing it, understanding its nutrition, getting guidance — is addressed by a single API. Adding a new capability is an additional system prompt, not a new service.

2. **SQLite offline persistence.** All data lives on the device. No login, no server, no latency on reads. The app works in a kitchen with bad Wi-Fi. This also means zero ongoing backend cost per user.

3. **Non-blocking AI pipeline.** When a user saves a recipe, the app navigates away immediately. Nutrition estimation, thumbnail generation, and step illustrations run in the background. The user never stares at a spinner; the AI results appear when they return to the recipe. This is the single largest perceived-speed improvement in the app.

4. **Cooking as the logging trigger.** Users do not need to open a tracker app after eating. They cook in the app. When they finish cooking, one tap logs the meal. The tracker fills itself. The system converts cooking behavior into health data without adding a new behavior.

---

## How the System Evolved: Midterm → Final

### What the system looked like at midterm

```
┌──────────────────────────────────────────────────────┐
│                    USER'S DEVICE                      │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │  Scan Tab  │  │ Recipes Tab│  │Shopping Tab │    │
│  │ (4 buttons:│  │            │  │  (list only,│    │
│  │  camera,   │  │            │  │  no Walmart │    │
│  │  photo,    │  │            │  │  preview)   │    │
│  │  URL, file)│  │            │  │             │    │
│  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘    │
│        │               │               │            │
│  ┌─────▼───────────────▼───────────────▼──────┐    │
│  │          src/services/openai.js              │    │
│  │  chatRecipe() │ generateRecipeThumbnail()    │    │
│  └──────────────────────┬──────────────────────┘    │
│                         │                            │
│  ┌──────────────────────▼──────┐                    │
│  │  SQLite Database             │                    │
│  │  6 tables (recipes,          │                    │
│  │  ingredients, steps,         │                    │
│  │  collections, settings,      │                    │
│  │  recipe_tags)                │                    │
│  └─────────────────────────────┘                    │
└──────────────────────────────────────────────────────┘
                         │
        ┌────────────────▼───────────────────┐
        │           CLOUD APIs               │
        │  ┌──────────────────────────┐      │
        │  │     OpenAI Platform      │      │
        │  │  GPT-4o (chat/extract)   │      │
        │  │  DALL-E 3 (thumbnails)   │      │
        │  └──────────────────────────┘      │
        └────────────────────────────────────┘
```

**What was missing at midterm:** No Tracker tab. No Planner tab. No voice cooking mode. No Walmart API integration. No nutrition estimation. No step illustrations. No cook logging. The shopping tab was a plain checklist with no product search or prices. The Scan tab had 4 equal-weight buttons that caused decision paralysis. The database had 6 tables. The only cloud dependency was GPT-4o for extraction and DALL-E 3 for thumbnails.

### What changed (and why)

Five feedback loops discovered through building changed the architecture significantly between midterm and final delivery.

**Loop 1 — Camera was not the primary input.**
At midterm, camera scan was the hero feature. URL import was a fallback. Post-midterm testing showed URL import was used 3× more often (61% vs. 28%). The home screen was redesigned to treat URL import as equal priority.

**Loop 2 — Nutrition tracking was not in the original PRD.**
Two testers independently asked "does it remember how many calories?" after using the shopping flow. This prompted the Nutrition Tracker (Tracker tab, `estimateNutrition()` call, `recipe_nutrition` table, `cook_log` table). None of this existed at midterm.

**Loop 3 — Four import buttons caused decision paralysis.**
A user paused for 4 seconds on the original scan screen, which had 4 equal-weight buttons. This prompted a UI redesign: single "Add Recipe" button + action sheet modal.

**Loop 4 — Walmart price transparency was a trust gate.**
Internal testing found that sending items to a Walmart cart without a preview felt risky. A per-ingredient product name and price display was added before the send action. `searchProduct()` in `walmart.js` was promoted from P1 to P0.

**Loop 5 — User segmentation split the shopping exit path.**
Round 4 testing revealed two distinct user types: pickup/delivery shoppers who want the Walmart pipeline, and in-store shoppers who want export to Notes/Lists. The system currently only serves one of these. Export-to-Notes is identified as the required next build.

---

## What We Got Wrong at Midterm

| Assumption at midterm | What we found | Impact |
|---|---|---|
| Camera scan is the primary input method | URL import was used 61% of the time vs. camera at 28% | Reprioritized UI hierarchy |
| Users want a recipe scanner | Users want a cooking companion; the scanner is the front door | Reframed the product positioning |
| Nutrition tracking belongs in a separate app | Users expected nutrition to come from the cooking flow automatically | Built Tracker tab from scratch post-midterm |
| One shopping exit path is sufficient | Users split on Walmart vs. export-to-Notes preference | Export-to-Notes identified as required next iteration |
