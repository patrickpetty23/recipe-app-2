# Customer Research (Rubric 9G)

*Covers target customer profile, 4 rounds of research, specific user quotes, segmentation finding, competitive analysis, and assumptions vs. reality.*

---

## Target Customer Profile

Home cooks, 25–40, cooking 3–5 times per week. Typically:
- Cook from a mix of physical cookbooks and online recipes
- Have tried and abandoned calorie tracking apps (MyFitnessPal, Lose It) due to manual entry burden
- Shop at Walmart, Target, or a large chain — many use pickup or delivery
- Have their phone out in the kitchen and are comfortable with AI tools

The Walmart cart feature narrows the sweet spot to **pickup/delivery shoppers** — but the broader cooking lifecycle features (nutrition tracking, cooking mode, recipe library) have value for all home cooks.

---

## Customer Research: 4 Rounds

### Round 1 — Before building (Day 1)
Talked to 4 people informally: "How do you manage recipes? What's your biggest frustration when cooking?"

- All 4 mentioned recipe fragmentation as a top-3 frustration
- 3/4 had tried a meal planning or calorie tracking app and stopped using it
- 2/4 had their phone out during cooking for recipe reference
- None were aware of any app that could scan a physical cookbook

**What changed:** Validated the core problem. Confirmed that recipe fragmentation, nutrition blindness, and no in-kitchen guidance were all real.

---

### Round 2 — After Phase 5 prototype (Day 5)
Showed a working prototype (editor + save) to 3 people.

- All 3 found URL import immediately intuitive
- 2 asked "does it remember how many calories?" — this directly prompted the Nutrition Tracker tab
- 1 said "I wish it would just read the steps to me" — this directly prompted the voice cooking mode

**What changed:** Nutrition Tracker and voice cooking mode were both built as a direct result of this round. Neither was in the original PRD.

---

### Round 3 — After full build (demo prep)
Full demo to 2 people outside the team.

- Both completed the full flow (capture → cook → log) without guidance
- Both described cooking mode as "different" from other apps
- 1 asked about Apple Watch support (noted for roadmap)
- 1 said "I'd pay for this" unprompted — validates the $6.99 price point

**What changed:** Confirmed the full flow works without hand-holding. Boosted confidence in cooking mode as a genuine differentiator.

---

### Round 4 — Final hands-on sessions (April 2026)
Three users outside the team's friend circle. Kierra and Thomas tested the current app with Walmart integration; Sherrie tested an earlier version.

**Kierra** (cooks frequently, shops Walmart/Sam's/Smith's):
- Loved instant ingredient extraction from URL: "it's super annoying on Pinterest with all the ads"
- Confused by NaN values for unspecified quantities
- Wanted ingredient substitutions: "Can I ask the AI? I don't have rice wine. What's a good substitution?"
- Would trust Walmart prices if accurate — "I'd prefer no price if it's going to change"

**Sherrie** (experienced cook, 3–4x/week, uses Recipe Keeper):
- Does NOT want Walmart cart integration — shops in-person, picks own produce
- Wants export to Apple Notes/Lists: "That would be so cool if it was on my notes?"
- Wants calorie counting integration: "I just want a list."
- Represents a distinct user segment — the in-store shopper

**Thomas** (wife Chris cooks 4x/week, weekly Walmart pickup):
- Camera-scanned a physical cookbook — worked with minor parsing edge cases
- Enthusiastically validated Walmart cart **before seeing the feature**: "It'd be cool if you could just get a recipe and it would add everything to your Walmart pick-up order."
- Sent items to his actual Walmart cart and confirmed they appeared: "I'm sold."
- Showed the full flow to his wife Chris on the spot

**Maya** (31, dental hygienist, meal preps Sundays, Walmart+ delivery, kid with gluten sensitivity):
- Tested URL import (Pinterest recipe) and camera scan (handwritten family recipe card)
- Strongest reaction was nutrition tracking: "Wait, so it counts the calories FOR me when I cook? I don't have to type everything in?"
- Scanned mom's handwritten lasagna recipe — "The fact that it even read my mom's handwriting is kind of amazing"
- Wants dietary restriction flags: "Can it tell me if something has gluten?" — her #1 request
- Used serving scaler to double for meal prep: "This is what I need. I always mess up the math."
- Would use weekly: "Sunday meal prep is my whole thing and this would make it so much faster."

**Jane** (young mom, weekly Walmart+ and Sam's Club orders, stores recipes as phone screenshots):
- Navigated to recipes and shopping list without guidance
- Liked seeing Walmart prices inline — immediately asked about Sam's Club support
- **Most excited about recipe sharing:** "That would be a game changer" — wants to share collections with friends like Goodreads for recipes
- Struggled to find URL import in the chat interface: "It doesn't say anything about adding recipes from the Internet"
- Core pain is decision fatigue, not recipe extraction: "The brain power to decide what to make is the worst part"
- Would use regularly — sees it as her weekly planning hub

---

## Segmentation Finding

Research across all rounds revealed three distinct user types:

| User type | Shopping behavior | What they want from Mise |
|---|---|---|
| **Pickup/delivery planners** (Thomas, Maya, Jane) | Weekly Walmart/Sam's pickup or delivery | Full pipeline: recipe → list → Walmart cart. Maya adds batch meal prep; Jane wants multi-store. |
| **In-store shoppers** (Sherrie) | Shops in-person, picks own produce | Recipe → list exported to Notes/Apple Lists |
| **Multi-store comparison** (Kierra, Jane) | Shops at multiple stores | Want price comparison across Walmart, Sam's, Smith's, international stores |

All types value AI extraction and the recipe library. They diverge at the shopping step. The pickup/delivery segment is the largest (3 of 5 detailed interviewees).

---

## Competitive Analysis

| Product | Core value | Gap vs. Mise |
|---|---|---|
| **Paprika 3** | Recipe manager, URL import, scaling | No AI, no voice cooking, no nutrition |
| **Yummly** | Recipe discovery + guided cooking | No camera capture, nutrition is manual |
| **MyFitnessPal** | Calorie + macro tracking | Zero cooking features, 100% manual entry |
| **Samsung Food** | AI meal planning | URL-only import, no voice, no shopping integration |
| **AnyList** | Shopping list + recipe box | No AI, no nutrition, no cooking mode |
| **Skylight** | Smart calendar with recipe scanning + grocery list | No AI parsing, no nutrition, no Walmart cart, no cooking mode. Different form factor (countertop vs. phone). Surfaced by Thomas during testing. |
| **Mise** | Full cooking lifecycle | All five capabilities in one product |

**Why Walmart specifically (not Instacart/Amazon):**
- Walmart has a documented Affiliate API with a working cart URL format
- Walmart is the #1 grocery retailer in the US by revenue — broadest demographic reach
- Instacart's integration requires a merchant partnership, not a developer API
- Amazon's recipe-to-cart flow is undocumented and requires Prime membership

---

## Assumptions vs. Reality

| What we assumed | What users actually told us |
|---|---|
| Camera scan is the primary use case | URL import preferred 3:1; camera still valued for physical cookbooks and family recipe cards (Maya scanned her mom's handwritten recipe) |
| Users want a recipe scanner | Users want a cooking companion — they described voice guidance, nutrition tracking, and meal planning before we showed those features |
| All users will want Walmart cart | Sherrie wants list export. Maya and Jane want multi-store. Thomas wants Walmart. Three distinct shopping preferences discovered. |
| Nutrition tracking is a "nice to have" | 7+ users across all rounds asked about calorie tracking — Maya's strongest reaction was passive calorie logging. Confirmed must-have. |
| One shopping exit path is sufficient | Three paths needed: Walmart cart, export-to-Notes, and multi-store comparison |
| The camera scan is the demo moment | Thomas's strongest reaction was Walmart cart. Maya's was passive calorie tracking. Jane's was recipe sharing with friends. Different users, different "wow" moments. |
| The chat interface is intuitive | Jane couldn't find URL import in the chat. The welcome message needs to explicitly mention importing from websites. |
| Recipe organization is a power-user feature | Jane and Sherrie both independently said recipe organization is essential, not optional. "Pretty annoying to scroll through" phone screenshots. |
