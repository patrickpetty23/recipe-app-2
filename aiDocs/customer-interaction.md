# Customer Interaction & Feedback Loops (Rubric 9I)

*Covers all feedback-to-feature cycles with observe → change → validate structure, and the full list of features traced to specific user feedback.*

---

## The 5 Core Feedback-to-Feature Cycles

### Cycle 1: "I mostly use recipes from the internet"
**What we observed/heard (Day 4):**
After building the camera scan and showing it to testers, feedback was consistent: "I mostly use recipes from the internet, not cookbooks." URL import felt faster and more natural than camera scan for the majority of users.

**What we changed:**
Promoted URL import to equal priority with camera scan. Home screen "Add Recipe" modal shows URL as the first option. The camera is still there but is no longer the hero path.

**How we validated:**
In Round 2 testing, 3/3 users reached for URL import first without prompting. Usage tracking across 20 sessions confirmed: URL 61%, Camera 28%, Chat 11%. Our original hypothesis — that camera scanning was the primary use case — was falsified by the data.

---

### Cycle 2: "Does it remember how many calories?"
**What we observed/heard (Day 5):**
Two users independently asked this question after completing the recipe save and shopping list flow. Neither was prompted about nutrition. The question emerged spontaneously from two different people in separate sessions.

**What we changed:**
Built the entire Nutrition Tracker feature: `estimateNutrition()` function calling GPT-4o on every save, `recipe_nutrition` table in SQLite, Tracker tab with daily calorie ring and macro progress bars, `logCook()` function, `cook_log` table. None of this existed before these two users asked about it. It became a full tab in the app.

**How we validated:**
In Round 3 testing, 2/3 users tapped "Log Meal" unprompted after finishing the cooking mode demo. Sherrie explicitly asked for calorie counting in Round 4. Thomas explored the tracker and found the log-meal flow. The feature with the most sustained user engagement in testing was not in the original PRD.

---

### Cycle 3: Four-button screen caused 4-second pause
**What we observed/heard (Day 6):**
During Phase 8 testing, a first-time user on the original Scan screen — which had 4 equal-weight import buttons (Camera, Photo, URL, File) — paused for 4 seconds before choosing. When asked, they said: "I wasn't sure which one to use."

**What we changed:**
Replaced the 4-button layout with a single "Add Recipe" button that opens an action sheet modal. The modal is a familiar pattern — users understand it from other apps. One primary action, then a clear choice inside the modal.

**How we validated:**
In all subsequent testing, no user paused at the home screen. First tap was immediate. Thomas navigated the import flow without guidance in Round 4. Kierra imported via URL on her first attempt without hesitation.

---

### Cycle 4: Users needed to see Walmart products before trusting the cart
**What we observed/heard (internal testing, Phase 7):**
The initial Walmart integration sent items to cart directly — tap "Send to Walmart" and the cart was populated. Internal testing revealed discomfort with this: you were sending items to a real Walmart cart without knowing which specific products were being matched.

**What we changed:**
Added per-ingredient product name and price display on the shopping list, shown before the "Send to Walmart" button. Moved product matching from P1 to P0 because it proved essential for user trust. This added an entire display layer between "shopping list" and "send to cart."

**How we validated:**
Thomas saw the product preview, checked prices against his Walmart cart, found them mostly accurate, and confidently sent items to his actual Walmart cart. He then showed the feature to his wife. Kierra also reviewed prices — she was bothered by discrepancies but confirmed the preview itself increased her willingness to try. The preview increases trust; price accuracy is the next gate.

---

### Cycle 5: Sherrie rejected Walmart — Thomas loved it before seeing it
**What we observed/heard (Round 4, April 2026):**
Two users with different shopping behaviors responded to the same feature in opposite ways. Sherrie (in-store shopper): "I don't want that. I just want a list. I'm gonna run around." She wants export to Apple Notes, not a Walmart cart. Thomas (Walmart pickup user): described the exact cart feature before seeing it — "It'd be cool if you could just get a recipe and it would add everything to your Walmart pick-up order" — then used it and said "I'm sold."

**What we changed (identified, not yet built):**
The app needs both exit paths from the shopping list: send to Walmart cart AND export to Notes/Apple Lists. These serve two user segments with different last-mile behaviors. The core value (AI extraction, recipe library, cooking mode) is the same for both.

**How we validated:**
6/7 final testers validated the Walmart cart (Thomas, Kierra conditional, Trevor, Spencer, John, Kelly positive). Sherrie is the clean counter-example that revealed the second segment. The segmentation finding strengthens the product strategy: cart for pickup users, export for in-store users.

---

### Cycle 6: "Can I ask the AI? I don't have rice wine."
**What we observed/heard (Round 4, Kierra):**
While reviewing a recipe in the app, Kierra noticed an ingredient she didn't have and asked: "Can I ask the AI? I don't have rice wine. What's a good substitution?" This was a spontaneous question about a feature that didn't exist as a dedicated UX, though it's technically possible via the Chat tab.

**What we changed (identified, in progress):**
The Chat tab already allows substitution questions in a general way. A dedicated "Ask about this ingredient" action in the recipe detail or shopping list view would surface this capability for users who don't discover it on their own. Kierra's question defines the exact UX gap: the capability exists but isn't discoverable at the moment the user needs it.

**How we validated:**
Thomas also explored "Make it Lighter" — a related AI substitution feature. The pattern is consistent: users want AI assistance at the ingredient level, not just at the recipe level.

---

## 11 Features Traced to Specific Feedback Sources

| Feature / Decision | Who triggered it | What they said or did |
|---|---|---|
| URL import as equal priority | Round 2 testers (3 people) | "I mostly use recipes from the internet" |
| Nutrition Tracker tab | Round 2 (2 users independently) | "Does it remember how many calories?" |
| Voice cooking mode (TTS) | Round 2 (1 user) | "I wish it would just read the steps to me" |
| Single "Add Recipe" button + modal | Day 6 tester | Paused 4 seconds on 4-button screen |
| Walmart product preview with prices | Internal testing | Discomfort sending to cart without seeing products |
| Export-to-Notes exit path (identified) | Sherrie, Round 4 | "I just want a list. I'm gonna run around." |
| Per-serving meal logging fix (identified) | Thomas, Round 4 | "Log Meal" defaulted to all servings, not one |
| NaN quantity display fix (identified) | Kierra, Round 4 | Confused by NaN for unspecified amounts |
| Ingredient substitution UX (identified) | Kierra, Round 4 | "Can I ask the AI? I don't have rice wine." |
| Recipe collections with emoji | Spencer (teammate round) + Sherrie | Independently asked for recipe categories/organization |
| Meal planner (Planner tab) | Kelly + Trevor (teammate round) | Both wanted a way to "reuse" recipes and plan ahead |
