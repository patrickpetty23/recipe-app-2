# Customer Interaction — Recipe Scanner

## Midterm Interaction Evidence

We conducted 3 dry runs + 3 user sessions in February 2026 using a Keynote mockup, then early builds.

| ID | Profile | Time to List | Key Feedback | Product Change |
|---|---|---|---|---|
| DR-1 | Internal (cookbook photo) | 24s | Fraction OCR normalization issue | Added unicode fraction normalization in parser |
| DR-2 | Internal (social screenshot) | 31s | Non-ingredient text leaked into list | Strengthened blocked-token filtering |
| DR-3 | Internal (blurry photo) | fail | Error guidance needed | Added clearer no-text retry messaging |
| U1 | Roommate, cooks 4x/week, TikTok/YouTube | 1m 56s | "Faster than Notes, but I need to double-check fractions" | Added visible confidence + kept raw OCR lines in editor |
| U2 | Roommate, cooks 3x/week, Instagram/Pinterest | 2m 18s | "Import flow is great. Biggest pain is junk text from screenshots" | Tightened non-ingredient filtering, highlighted dropped lines |
| U3 | Roommate, ELS student from Peru, cooks 4x/week | 2m 04s | "Checklist persistence is the killer feature. Keep it offline and simple" | Prioritized list persistence and recipe re-generate in library |

**What this gave us:** Directional signal on speed, trust, and the specific parsing failures that matter most (fractions, junk text, blurry photos). Each session produced a concrete product change.

**Limitation:** All external sessions were roommates. Feedback was real and actionable, but the sample is biased.

---

## Feedback Loops: Midterm → Final

The rubric requires **engage → learn → change → re-engage** cycles. Below are loops that span from midterm research through the final build.

### Loop 1: Screenshot Noise → Parser Filtering → URL Import

- **Engage (midterm):** U1 and U2 both flagged junk text from social media screenshots — captions, overlay text, and non-ingredient content leaking into the parsed list.
- **Learn:** Screenshot parsing is inherently noisy. Social media images have layers of text that aren't ingredients. This was the #1 frustration across midterm interviews.
- **Change:** Tightened non-ingredient filtering in the parser (Phase 3). But more importantly, added URL import as an alternative input method (Phase 4) — scraping a recipe page produces much cleaner text than OCR on a screenshot.
- **Re-engage:** In final interviews, Kierra and Sherrie both used URL import without prompting — they gravitated to the cleaner path naturally. Kierra specifically called out the Pinterest ad-scrolling problem as something the app solved: "it's super annoying on Pinterest because there's so many ads... I have to scroll all the way to the bottom." Screenshot noise was not mentioned as an issue by any final participant, suggesting the combination of better filtering + URL import as the default effectively resolved it.

### Loop 2: Trust & Editing → Structured Editor

- **Engage (midterm falsification test):** Planted 2 errors in a mockup scan result. No participant caught both. Users don't systematically check AI output.
- **Learn:** An open edit field isn't enough — users need structure to notice errors. They scan through the lens of what they're already worried about.
- **Change:** Built the editor with separate tappable fields for name, quantity, and unit (Phase 5) rather than a single text blob. This makes misparses more visible — a wrong quantity stands out when it's in its own field.
- **Re-engage:** Thomas noticed the "8-10 tortillas" parsing issue (quantity "8", unit "-10 each") in the structured editor and said "that's a little funny" but immediately noted he could edit it. Kierra spotted NaN values for unspecified quantities. Both users caught issues *because* the structured fields made them visible — a wrong unit in its own column stands out more than a wrong unit buried in a sentence. Neither accepted the list blindly, which is a meaningful improvement over the midterm falsification test where Participant A accepted without checking.

### Loop 3: Import UX Confusion → Modal Redesign

- **Engage:** During internal testing and early user demos, the original Scan tab had 4 visible buttons (Camera, Photo, URL, File) presented simultaneously.
- **Learn:** Testers hesitated — they didn't know which button to press first. The choice overload created friction at the very first step of the app experience.
- **Change:** Redesigned from 4 visible buttons on a "Scan" tab to single "Add Recipe" button with modal selector (Phase 8). One clear action, then a familiar modal pattern for choosing the method.
- **Re-engage:** In final interviews, no user expressed confusion about how to import a recipe. Thomas navigated the onboarding text and import flow without guidance. Kierra successfully imported via URL on her first attempt. The modal pattern eliminated the first-use confusion that the 4-button layout caused.

### Loop 4: Walmart Product Trust

- **Engage:** During development testing, the initial Walmart integration sent items to cart directly. Internal testing revealed discomfort with a "black box" action — you'd tap "Send to Walmart" with no visibility into what products were being added.
- **Learn:** Users need to see matched product names and prices before trusting a bulk cart action. The trust barrier isn't the ingredient list — it's the product matching step. "Am I getting the right brand? The right size?"
- **Change:** Added per-ingredient Walmart product name and price display on the shopping list, shown before the "Send to Walmart" button (Phase 7). Moved product matching from P1 to P0 because it proved essential for trust.
- **Re-engage:** Thomas saw prices, checked them against his actual Walmart cart, and found them mostly accurate (within cents on most items). This gave him enough confidence to send items to cart and show the feature to his wife. Kierra also reviewed prices but was bothered by discrepancies — she said she'd "prefer no price if it's going to change." The preview increases willingness to act, but price accuracy is the next trust gate.

### Loop 5: Deselect Before Cart Send (From Final Interviews)

- **Engage:** Thomas tested the full shopping list → Walmart flow. He checked off items he already had at home, expecting those to be excluded from the cart send.
- **Learn:** "I can see that I can check on it... but it's still the same, send 9 items to Walmart, even after I've selected a few to take off the list." Checked-off items should be excluded from the cart send — users expect the checkmark to mean "I have this, skip it."
- **Change:** This is a high-priority UX fix identified from the interview. The send-to-cart action should respect the checked state and only send unchecked items.
- **Re-engage:** Pending — fix needs to be implemented and re-tested with a user.

### Loop 6: User Segmentation Discovery (From Final Interviews)

- **Engage:** Showed the app to Sherrie (in-store shopper) and Thomas (Walmart pickup user) in separate sessions.
- **Learn:** These two users want fundamentally different things from the same app. Thomas wants the full pipeline: recipe → list → Walmart cart. Sherrie wants only recipe → list, exported to her own tools. The Walmart integration is our differentiator for one segment and irrelevant to another.
- **Change:** This insight reshapes how we position the app. The Walmart integration is not the universal value prop — it's the value prop for pickup/delivery users. The universal value is recipe → structured list. Export (to Notes, Apple Lists, etc.) needs to be a first-class path alongside send-to-cart.
- **Re-engage:** Teammate's 4 interviews (Trevor, Spencer, John, Kelly) all validated Walmart integration — consistent with Thomas. 6/7 final users love the cart feature, confirming it's a strong differentiator for the majority segment.

### Loop 7: Shopping List UI Cleanup (From Teammate Interviews)

- **Engage:** Trevor tested the shopping list and said the UI was cluttered — too many buttons.
- **Learn:** The shopping list had accumulated buttons (search per item, search all, clear checked, clear all, add from recipe) and felt overwhelming.
- **Change:** Simplified the shopping list page — reduced button count, cleaner layout.
- **Re-engage:** Shipped the cleanup. Subsequent testers (Spencer, John, Kelly) did not flag the same issue.

### Loop 8: Recipe Organization → Collections (From Teammate + Final Interviews)

- **Engage:** Spencer wanted to be able to favorite recipes or add them to categories like "lunch" or "Italian." Sherrie's #1 frustration was recipe organization — wanted auto-categorization.
- **Learn:** Two independent users from different interview rounds flagged the same gap: recipes need organization beyond a flat list. This isn't a power-user feature — it's a basic expectation.
- **Change:** Built the collections feature with emoji folders. Users can create collections (e.g., "Italian", "Quick Meals") and assign recipes.
- **Re-engage:** Feature shipped and available for testing.

### Loop 9: Recipe Reuse → Calendar/Meal Planning (From Teammate Interviews)

- **Engage:** Both Kelly and Trevor independently said they wanted a way to "reuse" a recipe or have a button to cook it again.
- **Learn:** Users don't just want a recipe library — they want to plan when to cook what. The gap between "saved recipe" and "this week's meals" is real.
- **Change:** Built a calendar/meal planning feature where users can add recipes to their week and meal prep.
- **Re-engage:** Feature shipped and available for testing.

---

## Features Shaped by Customer Feedback

| Feature / Decision | Feedback Source | What Triggered It |
|---|---|---|
| Unicode fraction normalization | DR-1 (internal dry run) | Fractions displayed as garbled text |
| Non-ingredient text filtering | U1, U2 (midterm interviews) | Junk text from social screenshots in parsed list |
| No-text retry messaging | DR-3 (internal dry run) | Blurry photo failed silently |
| Checklist persistence in library | U3 (midterm interview) | "Keep it offline and simple" — list disappearing was a dealbreaker |
| URL import as input method | U1, U2 pain point + building experience | Screenshot noise made URL a cleaner alternative |
| Structured per-field editor | Midterm falsification test | Users don't catch errors in unstructured text |
| Modal import selector | Internal testing + early user demos | 4-button layout confused testers — didn't know which to press |
| Walmart product preview with prices | Internal testing | Users hesitated to send to cart without seeing matches — moved from P1 to P0 |
| Serving size scaler prominence | User testing (Thomas, Kierra) | Users immediately tried adjusting servings — it's a core feature, not a bonus |
| Conversational chat interface | Building experience + user testing | Replaced button-driven import with a chat tab — more natural for sending photos, URLs, and questions in one place |
| Nutrition estimation + Tracker tab | User testing (Sherrie, Thomas) | Sherrie wanted calorie counting; Thomas explored the log-meal and nutrition features. Auto-estimating macros on save makes tracking a side effect of cooking, not a separate chore |
| Cooking mode with TTS | Building experience + user demo | Full-screen step-by-step with text-to-speech. Thomas explored start-cooking flow. Keeps the app useful during the meal, not just during planning |
| DALL-E 3 thumbnails + step illustrations | Building experience | Recipe thumbnails make the library visually browsable; step illustrations make cooking mode feel guided. Thomas: "kind of cool" but "a little crude" |
| "Make it Lighter" AI substitutions | User testing (Thomas, Kierra) | Thomas explored it — liked the suggestions (swap heavy cream for low-fat sour cream). Kierra wanted substitutions for unavailable ingredients. Both validated the concept |
| Recipe collections with emoji | Building experience | Sherrie's #1 frustration was recipe organization. Collections with emoji folders address this directly |
| Deselect items before cart send | Thomas (final interview) | Checked-off items still sent to Walmart — expected them to be excluded |
| User segmentation: cart vs. export | Sherrie vs. Thomas (final interviews) | Discovered two distinct user types with opposing needs from the same app |
| Shopping list UI simplification | Trevor (teammate interview) | Shopping list was "cluttered" with too many buttons → simplified |
| Collections with emoji folders | Spencer (teammate) + Sherrie (final) | Both independently wanted recipe organization/categories |
| Calendar/meal planning | Kelly + Trevor (teammate interviews) | Both wanted to "reuse" recipes / plan when to cook again |
| "Make it Lighter" rename needed | Spencer (teammate interview) | Didn't understand what the button meant at first glance |

---

## Driving vs. Being Driven

**Following the customer:**
Midterm users told us screenshot noise was the biggest pain point. We responded by improving filtering AND adding URL import as a cleaner alternative. In the final round, Sherrie asked for calorie counting — we'd already built the Nutrition Tracker because two earlier testers asked the same question independently. Thomas wanted to deselect items before cart send — a direct feature request we haven't implemented yet but have documented as a priority.

**Leading with a design decision:**
We kept all input methods (camera, photo, URL, file, chat) even though URL/chat is preferred. Dropping camera would simplify the app but would abandon the cookbook-scanning use case — Thomas used it successfully on a real cookbook. We also built Cooking Mode with TTS before anyone asked for it, betting that an app helping users *during* the meal (not just before it) would differentiate us from every competitor. Thomas explored it in his session and navigated the full step-by-step flow. Similarly, DALL-E 3 illustrations were a design bet — they make the app feel more polished and guided, even though Thomas noted they're "a little crude."

---

## What Still Needs to Be Done

- [x] Confirm which changes came from real user feedback vs. self-observed (Loop 3, Loop 4, bottom of features table)
- [x] Fill in re-engage results from final interviews (Loops 1-4)
- [x] Complete Loop 5 with new feedback from final interviews
- [x] Update features table with any new changes from final round
- [ ] Implement deselect-before-cart-send fix (Loop 5) and re-test with a user if time permits
- [ ] Add additional interview sessions if conducted before presentation
