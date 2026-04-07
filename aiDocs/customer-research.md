# Customer Focus — Recipe Scanner

## Midterm Customer Definition

**Primary segment:** iPhone users who cook multiple times weekly, mix physical cookbooks with screenshot-based recipes, want less planning overhead before grocery trips.

**Secondary segment:** Students and young professionals batch-cooking from social media recipes.

**Midterm positioning:** "For home cooks who save recipes in messy formats, Recipe Scanner is the fastest path from recipe image to editable shopping checklist, without forcing full manual entry."

**Midterm differentiation:** Camera/screenshot ingestion as first-class input, ingredient-specific parsing (not generic OCR), immediate editability, offline-first, AI meal identification from food photos.

**Midterm research:** 3 roommate interviews (convenience sample, ages 22-24). All were social-recipe heavy (TikTok, Instagram, Pinterest). Key finding: screenshot-first reliability was the highest-leverage requirement, not camera cookbook scanning.

---

## How Our Customer Understanding Evolved

### What the midterm got right
- Screenshot/digital recipes are the dominant source format — validated through building
- Fast correction matters more than perfect parsing — validated by the editor becoming the trust-building step
- Minimal setup and short time-to-value are essential — validated by URL import being preferred for its speed

### What changed through building
1. **Input sources are broader than screenshots — and the interface became conversational.** We added URL import, PDF/DOCX import, and plain-text description. More importantly, all input methods converge through a **Chat tab** — a conversational AI interface where users send messages, photos, URLs, or files. This replaced the original button-driven import flow and turned out to be more natural. Users can also ask general cooking questions (e.g., substitution suggestions) in the same interface.
2. **Walmart integration became the core differentiator.** At midterm, our differentiation was "AI parsing + editability." After building, the unique value is the full pipeline: any recipe source → structured list → Walmart cart. No competitor does this.
3. **The app grew beyond recipe-to-list into a cooking lifecycle tool.** Users asked about calories unprompted, wanted the app to help them cook (not just plan), and expected AI-generated visuals. We added: nutrition estimation (GPT-4o auto-estimates macros on save), a Nutrition Tracker tab with daily calorie/macro tracking, a full-screen Cooking Mode with text-to-speech and countdown timers, DALL-E 3 recipe thumbnails and step illustrations, "Make it Lighter" AI substitution suggestions, meal logging, and recipe collections with emoji organization.
4. **The customer profile needs to include "shops at Walmart" — but not exclusively.** Our midterm segment was generic "iPhone users who cook." The Walmart integration narrows this for the cart feature, but the broader cooking lifecycle features (nutrition tracking, cooking mode, recipe library) have value for all home cooks, including users like Sherrie who don't want cart integration.
5. **"Offline-first" mattered less than expected.** The app requires API calls to GPT-4o, DALL-E 3, and Walmart anyway. Offline mode only applies to the library, shopping list, and cooking mode, which is useful but not the main value proposition.

### Updated customer definition

**Primary segment:** iPhone users who cook from recipes 3+ times per week and do their grocery shopping at Walmart (pickup or delivery). They want a single tool that handles the full cooking lifecycle: recipe capture → structured list → Walmart cart → cooking guidance → nutrition tracking. Thomas and his wife Chris are the archetype — weekly Walmart pickup, recipe-driven cooking, currently using paper lists.

**Secondary segment:** Home cooks who value recipe organization, cooking guidance, and nutrition tracking but don't use Walmart cart integration. They benefit from the AI extraction, recipe library with collections, cooking mode with TTS, and nutrition tracker. Sherrie represents this segment — she wants the recipe→list flow exported to her own tools, plus calorie tracking.

**Tertiary segment:** Students and young adults who find recipes on social media and want a faster way to build grocery lists — the chat-based import flow has standalone value even without the full lifecycle features.

---

## Customer Research — Final Round

### Midterm interviews (February 2026, friends/family)

These were conducted with roommates during the mockup phase. They gave us directional signal but are a biased sample.

| ID | Profile | Key Insight | Product Change |
|---|---|---|---|
| U1 | Roommate, undergrad, TikTok/YouTube recipes, cooks 4x/week | Speed + review before save matters most. Fraction OCR was an issue. | Added fraction normalization in parser |
| U2 | Roommate, undergrad, Instagram/Pinterest recipes, cooks 3x/week | Import flow is high value. Junk text from social screenshots is the biggest pain. | Tightened non-ingredient filtering |
| U3 | Roommate, ELS student from Peru, cooks 4x/week from screenshots/notes | Checklist persistence is the killer feature. Offline and simple. | Prioritized list persistence and library re-generate |

**Limitation:** All three are roommates, ages 22-24, similar cooking habits. The rubric requires interviews beyond this circle.

### Final interviews (April 2026, beyond friends/family)

Seven interviews conducted across two team members with people outside the team's immediate friend circle. Participants represent different cooking profiles and shopping habits, giving us signal across user types.

**Note:** Sherrie's session used an earlier version of the app (before Walmart integration and major UI changes). All other participants tested the current Expo/React Native app with full Walmart cart integration.

### Interview Results

#### Interview 1 — Kierra
- **Who:** Married, cooks frequently for household, shops at Walmart/Sam's Club/Smith's
- **Current method:** Shops from memory — never writes lists, starts at the vegetable section and knows what she needs. Uses recipes rarely, only for something new or a specific craving.
- **Pain point:** Occasionally forgets items. For international recipes, ingredients aren't at Walmart.
- **App reaction:** Loved the instant ingredient extraction from URL — "it's super annoying on Pinterest because there's so many ads." Confused by NaN values for unspecified quantities.
- **Import choice:** URL import
- **Walmart reaction:** Would trust it if prices are accurate. Preferred no price over an inaccurate price estimate.
- **Key quote:** "If it could give me substitutions... Can I ask the AI? I don't have rice wine. What's a good substitution?"
- **Surprise:** Her #1 request was ingredient substitutions, not a feature we had considered prioritizing. Also: Walmart-only integration is limiting for international cuisine.

#### Interview 2 — Sherrie (earlier app version)
- **Who:** Experienced home cook, cooks from recipes 3-4x/week, uses Recipe Keeper app, shops at Smith's/Walmart/Sam's Club
- **Current method:** Saves recipes in Recipe Keeper, opens app at the store and shops from it. No written list.
- **Pain point:** Recipe organization — wants automatic categorization. Calorie transfer from Recipe Keeper to Lose It is broken and manual.
- **App reaction:** Appreciated automatic ingredient extraction. Immediately asked about calorie information.
- **Import choice:** URL import (link was pre-saved)
- **Walmart reaction:** **Does not want cart integration.** Shops in-person, picks her own produce, hunts for deals. "I just want a list. 'Cause I'm gonna run around."
- **Key quote:** "That would be so cool if it was on my notes?" — wants export to Apple Notes/Lists.
- **Surprise:** Represents a completely different user type. The cart integration — our core differentiator — has zero value for her. Her value is purely recipe→list, and she wants it exported out of our app.

#### Interview 3 — Thomas
- **Who:** Married, wife Chris cooks 4x/week from recipes (sister-in-law shares them for a shared diet). Shops primarily at Walmart pickup.
- **Current method:** Write ingredients on paper → Chris creates Walmart pickup order online → drives to get it.
- **Pain point:** Not knowing if they have ingredients at home, writing everything down manually, going back for forgotten items.
- **App reaction:** Camera-scanned a physical cookbook (honey lime chicken enchiladas). Parsing worked but had edge cases: servings defaulted to 1, text cutoff, "8-10 tortillas" parsed oddly. Easily edited corrections.
- **Import choice:** Camera scan of physical cookbook (was given both options)
- **Walmart reaction:** **Enthusiastic.** "I'm sold." Sent items to Walmart cart, confirmed they appeared in his actual Walmart app. Showed the whole flow to his wife Chris.
- **Key quote:** "It'd be cool if you could just like get a recipe and it would like add everything to your Walmart pick-up order." — said BEFORE seeing the app had this feature.
- **Surprise:** Unprompted validation — Thomas described the exact Walmart cart feature before seeing it. Also mentioned Skylight calendar as a competitor with recipe scanning.

#### Interviews 4-7 — Teammate Round (Trevor, Spencer, John, Kelly)

These four interviews were conducted by a teammate. All tested the current app with Walmart integration. Full write-ups pending; spark notes below. Detailed notes in `aiDocs/evidence/customer-conversation-teammate-round.md`.

- **Trevor:** Liked concept, loved Walmart integration. Found shopping list UI cluttered (too many buttons) → we simplified it. Wanted a way to re-cook recipes → drove calendar/meal planning feature.
- **Spencer:** Liked concept, loved Walmart integration. Wanted recipe categories/favorites like "lunch" or "Italian" → directly drove the collections feature. Loved "Make it Lighter" but didn't understand what the button meant at first → rename needed.
- **John:** Liked concept, loved Walmart integration. Mentioned calorie tracking as important. Loved "Make it Lighter" substitution feature.
- **Kelly:** Liked concept, loved Walmart integration. Wanted to reuse/re-cook recipes → contributed to calendar/meal planning feature. Mentioned calorie tracking.

**Cross-round patterns:** All 4 validated the Walmart integration (contrast with Sherrie who rejected it — the split is consistent with pickup vs. in-store shoppers). All 4 mentioned calorie tracking, reinforcing the Nutrition Tracker as a must-have. Spencer's category request aligned with Sherrie's organization frustration — both are served by the collections feature.

---

## Patterns Across All Interviews (Midterm + Final)

### Themes that held up from midterm
1. **Speed of import is the hook.** Every user who saw the instant ingredient extraction reacted positively. This validated the midterm finding that speed matters more than perfection.
2. **Fast correction > perfect parsing.** Kierra hit NaN values, Thomas hit parsing quirks — both were fine with editing. Confirms the midterm thesis that the editor is the trust-building step.
3. **URL/digital import is preferred over camera.** Kierra and Sherrie both used URL import. Thomas used camera (he had a physical cookbook) — confirming camera still has value for its intended use case, but URL is the default choice when both are available.

### New themes from final interviews (7 participants across 2 interviewers)
1. **Walmart integration is broadly validated.** 6 of 7 final participants loved the Walmart integration (Thomas, Kierra, Trevor, Spencer, John, Kelly). Only Sherrie rejected it — she prefers in-store shopping. The split is consistent: pickup/delivery shoppers want the full pipeline, in-store shoppers want just the list.
2. **Calorie tracking is a must-have, not a nice-to-have.** All 4 of the teammate's interviewees mentioned calorie tracking. Sherrie asked for it. Thomas explored the tracker. This independently validates the Nutrition Tracker as a core feature — 5+ users across both rounds flagged it.
3. **Recipe organization and reuse drive retention.** Spencer wanted categories ("lunch", "Italian") → collections feature. Kelly and Trevor wanted to re-cook recipes → calendar/meal planning. Sherrie wanted auto-categorization. Organization isn't a polish feature — it's what makes users come back.
4. **"Make it Lighter" resonates but needs better labeling.** All 4 teammate interviewees loved the concept. Spencer didn't understand what the button meant at first glance → rename needed for discoverability.
5. **Price accuracy is a trust gate.** Both Kierra and Thomas noticed price discrepancies between the app estimate and the actual Walmart cart. Kierra explicitly said she'd prefer no price over a wrong price.
6. **UI polish has direct impact.** Trevor flagged the shopping list as "cluttered" → we simplified it. This is a concrete example of feedback driving a shipped change.
7. **Multi-store support is expected.** Multiple participants shop at multiple stores. Thomas framed it as "give me the best price for the whole cart." Kierra wanted international stores (H Mart).
8. **Export/integration matters for the non-Walmart segment.** Sherrie wants Notes export. The app can't be an island for users who don't use Walmart cart.
9. **Physical cookbook scanning works but has rough edges.** Thomas was the first to test camera scan on an actual cookbook. It worked but revealed parsing issues (quantity ranges, text cutoff) that URL import avoids.

---

## Assumptions vs. Reality

| What We Assumed | Midterm Evidence | Final Evidence |
|---|---|---|
| Camera scanning is the primary input | Midterm users preferred screenshots over camera | **Partially confirmed.** URL import is still preferred when available (Kierra, Sherrie). But Thomas used camera on a real cookbook and it worked — camera has clear value for physical recipe sources. URL is default; camera is the cookbook-specific path. |
| Users want one-tap Walmart cart | Not tested at midterm | **Strongly validated.** 6 of 7 final users loved it (Thomas unprompted, Kierra conditional, Trevor, Spencer, John, Kelly all positive). Only Sherrie rejected it (in-store shopper). Strong differentiator for the pickup/delivery segment. |
| The main pain is retyping ingredients | All 3 midterm users confirmed this | **Confirmed for recipe-driven cooks.** Thomas's current workflow (paper list → Walmart website) is exactly this. Kierra appreciated skipping Pinterest ad scrolling to get to ingredients. Sherrie uses Recipe Keeper which already handles this — her pain is organization and calories, not extraction. |
| iPhone + Walmart is the right audience | Not tested (all midterm users were convenience sample) | **Partially confirmed.** All three shop at Walmart among other stores. Thomas is the strongest fit (weekly Walmart pickup). Kierra shops at Walmart but also needs international stores. Sherrie shops at Walmart but doesn't want cart integration. The sweet spot is: cooks who do Walmart pickup/delivery regularly. |
| Social media recipes are the main source | All 3 midterm users were social-recipe heavy | **Not universal.** Thomas gets recipes from family sharing (sister-in-law). Sherrie uses Recipe Keeper with saved recipes. Kierra occasionally finds recipes online. Social media is one source among many — the app needs to handle family-shared recipes, URLs, and cookbooks, not just social screenshots. |

---

## Competitive Analysis

| App | What It Does | Strengths | Gap vs. Recipe Scanner |
|-----|-------------|-----------|------------------------|
| **Paprika** ($5) | Manual recipe import, meal planning, grocery list | Full-featured, established, cross-platform | No AI parsing — users manually copy/paste. No store integration. |
| **Mealime** (free/$6mo) | Meal planning with built-in recipes, auto grocery list | Polished UX, curated library, dietary filters | Only their recipes — can't import cookbooks or arbitrary URLs. No store integration. |
| **AnyList** (free/$12yr) | Shared grocery lists, recipe URL import | Good sharing, basic recipe import | No AI parsing of images. No scanning. No store integration. |
| **Yummly** (free, Walmart-owned) | Recipe discovery, smart shopping list, Walmart integration | Walmart-backed, large recipe database | Only recipes in their database. Can't scan a cookbook or import arbitrary URLs. Walled garden. |
| **Recipe Scanner (ours)** | AI scan of any recipe → structured list → Walmart cart | Works with ANY source (camera, URL, PDF, photo). AI parsing. Direct Walmart cart. | New/unproven, no user base, Walmart-only, no meal planning. |

**Our positioning (updated from midterm):** At midterm we positioned on "fastest path from recipe image to editable checklist." After building, our positioning is sharper: **the only app that takes any recipe from any source and turns it into a Walmart shopping cart in under a minute.** The differentiator isn't just AI parsing — it's the full pipeline from discovery to cart.

**Post-interview update:** Thomas validated this positioning unprompted — he described the exact feature before seeing it. Kierra validated it conditionally (needs accurate prices and more stores). Sherrie did NOT validate it — she represents users who want recipe→list only, not list→cart. Positioning holds for the Walmart pickup/delivery segment but not universally.

**New competitor surfaced:** Thomas mentioned **Skylight** (smart home calendar with recipe scanning and grocery list features). It's an indirect competitor — different form factor (countertop display vs. phone app), but similar recipe→list flow. Our advantages: portability, Walmart cart integration, AI parsing quality.

---

## What Still Needs to Be Done

- [x] Conduct 3-5 interviews beyond friends/family — 3 completed (Kierra, Sherrie, Thomas)
- [x] Fill in interview results and assumptions vs. reality table
- [x] Update competitive analysis if interviewees mention apps we missed — added Skylight
- [x] Write "Patterns Across All Interviews" synthesis
- [ ] Conduct additional interviews if time permits before presentation (April 7)
