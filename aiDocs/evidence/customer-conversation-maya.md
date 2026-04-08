# Customer Conversation — Maya

**Date:** April 2026
**App version:** Current (Expo/React Native with Walmart integration)
**Relationship to team:** Not a friend or family member

## Profile

- 31, married with two kids (ages 4 and 7)
- Works full-time as a dental hygienist, home by 4pm most days
- Meal preps on Sundays for the week — cooks 4-5 times per week
- 7-year-old was recently diagnosed with a mild gluten sensitivity, so she's adapting recipes
- Current workflow: saves recipes on Pinterest, screenshots them, or texts links to herself. Keeps a running grocery list in Google Keep. Places a Walmart+ delivery order every Sunday morning.
- Has tried MyFitnessPal twice — quit both times because entering each ingredient was "soul-crushing"
- Comfortable with tech, uses her phone for everything, has used ChatGPT for meal ideas before

## Pre-App Pain Points

- Losing track of recipes across Pinterest boards, screenshots, and text messages — "I have like 300 pins and I can never find the one I actually liked"
- Adapting recipes for gluten-free is stressful — she doesn't always know which ingredients contain gluten or what to swap
- Calorie tracking is something she wants to do but can't sustain — manual entry takes too long
- Grocery budgeting is a constant concern — she doesn't know how much a recipe will cost until she's already in the Walmart app adding items one by one
- Doubling or halving recipes is mental math she gets wrong: "Last week I made double the sauce but forgot to double the pasta"

## App Walkthrough Observations

### URL Import Test
- Pasted a Pinterest recipe link for a chicken stir-fry
- Scraper pulled in the recipe on the second attempt — first attempt got stuck on the Pinterest wrapper page. Had to copy the actual recipe site URL from Pinterest.
- "Oh wait, it actually pulled everything in? That's way better than screenshotting it."
- Ingredients, steps, and nutrition all populated correctly
- Noticed prep time said 0 minutes (the source recipe didn't list prep time separately) — "That's a little weird, it says zero prep"

### Camera Scan Test (Phone Screenshot)
- Imported a photo of a handwritten recipe card from her mom — a family lasagna recipe
- Extraction was roughly 85-90% accurate — missed "pinch of nutmeg" entirely, and parsed "2 lbs ricotta" as "2 lbs rice" initially
- She caught the ricotta error immediately: "It says rice... that's ricotta. But I can fix it, right?" Edited it in the recipe editor.
- "The fact that it even read my mom's handwriting is kind of amazing though"

### Serving Size Scaler
- Changed servings from 4 to 8 (she meal preps for the week)
- All ingredient quantities doubled correctly
- "Oh my gosh, this is what I need. I always mess up the math when I double things."

### Nutrition Display
- Checked calorie and macro breakdown after import
- Noticed it showed per-serving values: "So if I eat two servings that's like 860 calories? Okay that's actually really helpful."
- Asked: "Does this save somewhere? Like if I cook this on Sunday can I see what I ate that week?"
- Was shown the Tracker tab — eyes lit up. "Wait, so it counts the calories FOR me when I cook? I don't have to type everything in?"
- This was her strongest positive reaction in the entire session.

### Shopping List + Walmart
- Added both recipes (stir-fry and lasagna) to shopping list
- Noticed duplicate ingredients were merged (onion appeared in both recipes, combined into one line)
- "That's smart, it combined the onions"
- Searched all on Walmart — 16 items returned with prices and images
- Total estimated at $47.82
- Wanted to remove items she already had at home (soy sauce, garlic, olive oil) — was able to deselect them
- Sent remaining 11 items to Walmart cart
- **Did NOT open Walmart app to verify** — said she'd check later. "I'll look when I do my actual order Sunday."
- "I like seeing the prices up front because then I know if the whole meal is worth it or if I should just do something cheaper"

### Cooking Mode
- Entered cooking mode for the stir-fry recipe
- Voice read the first two steps aloud — she paused and smiled
- "Oh that's nice when your hands are covered in raw chicken"
- Swiped through steps easily
- Asked: "Can I say 'next' instead of swiping?" (voice command to advance steps — not currently supported)
- Step illustrations: "These are cute but I don't really need them. The voice part is what matters."

## Walmart Reaction

- **Positive but practical.** Not the "I'm sold" excitement of Thomas — more of a "this saves me 20 minutes on Sunday mornings" reaction.
- "Right now I go recipe by recipe in the Walmart app adding stuff. This just does it all at once."
- Trusted Walmart to pick the right products for pantry staples but expressed hesitation on produce: "I'd probably still pick my own fruit and vegetables in-store. But for like canned stuff and spices? Totally fine."
- Liked seeing the price per item before committing

## Key Feedback

1. **Dietary filters/flags:** "Can it tell me if something has gluten? Or flag ingredients I should swap out?" — Wants the app to know about her family's dietary restrictions and proactively warn or suggest substitutions. This was her #1 request.
2. **Meal prep mode:** Wants to select multiple recipes, combine all ingredients into one shopping list, and scale everything for the week at once. Current flow (add one recipe at a time) works but is clunky for batch planning.
3. **Voice commands in cooking mode:** "Next step" or "repeat that" via voice instead of swiping. Hands are often dirty or wet while cooking.
4. **Pinterest integration:** Importing from Pinterest was a two-step process (had to find the original URL). A direct Pinterest link import would remove friction for her most common recipe source.
5. **Budget visibility:** Wants a running total as she adds/removes recipes from the shopping list — "Show me what dinner costs this week."
6. **Handwriting accuracy:** The handwritten recipe scan was impressive but imperfect. She'd want to double-check every handwritten import. "I'd always have to proofread my mom's recipes."
7. **Prep time default:** When the source recipe doesn't list prep time, showing "0 min" is misleading. Better to show "not specified" or estimate it.

## Would You Use This Regularly?

"Honestly? Yeah. Sunday meal prep is like my whole thing and this would make it so much faster. I'd use it every week."

## Key Quotes

- "I have like 300 pins and I can never find the one I actually liked."
- "The fact that it even read my mom's handwriting is kind of amazing though."
- "Wait, so it counts the calories FOR me when I cook? I don't have to type everything in?"
- "Oh that's nice when your hands are covered in raw chicken." (on voice cooking mode)
- "Can it tell me if something has gluten?"
- "Show me what dinner costs this week."

## Product Implications

- **Dietary restriction support is a major unmet need.** Maya isn't the only parent adapting recipes for allergies or sensitivities. A per-household dietary profile (gluten-free, nut allergy, dairy-free) that flags problematic ingredients and suggests swaps would differentiate Mise from every competitor tested. This extends Kierra's substitution request into a systematic feature.
- **Meal prep is a distinct workflow from single-recipe cooking.** Thomas and Kierra each tested one recipe at a time. Maya's Sunday batch-cooking pattern — multiple recipes, combined list, scaled servings — needs a dedicated "plan your week" flow. The Planner tab is close but doesn't yet connect to batch shopping.
- **Nutrition tracking is confirmed as a must-have, again.** Maya's strongest reaction was discovering that logging a cook automatically tracks calories. This is now the 6th+ user across all rounds to validate nutrition tracking unprompted. The "passive calorie tracking" angle (cook → it's logged, no manual entry) is the real differentiator vs. MyFitnessPal.
- **Pinterest is the #1 recipe source for this demographic** but the current scraper chokes on Pinterest wrapper URLs. Handling `pinterest.com/pin/...` links directly (by extracting the destination URL automatically) would remove a significant friction point.
- **Voice commands in cooking mode are a natural next step.** Maya and Thomas both implicitly wanted hands-free control. Adding "next," "repeat," and "go back" voice commands would complete the hands-free cooking experience that voice narration started.
- **Price visibility drives budget-conscious meal planning.** Unlike Sherrie (who doesn't care about prices) or Thomas (who cares about per-store comparison), Maya wants aggregate cost visibility: "what does this week of food cost me?" This is a new angle on the pricing feature — not per-item accuracy, but weekly budget planning.
- **Handwritten recipe scanning is emotionally resonant but accuracy-dependent.** Maya's reaction to scanning her mom's recipe card was the most emotional moment in the test. Family recipes are high-stakes — errors feel personal. Handwriting accuracy improvements (or a clear "review carefully" prompt after handwritten scans) would protect this moment.
