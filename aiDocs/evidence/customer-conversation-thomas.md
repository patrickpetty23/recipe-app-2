# Customer Conversation — Thomas

**Date:** April 2026
**App version:** Current (Expo/React Native with Walmart integration)
**Relationship to team:** Not a friend or family member

## Profile

- Married, wife Chris handles most meal planning
- Chris cooks from recipes about 4 times per week
- Recipes come from Chris's sister-in-law (they're doing a diet together)
- Current workflow: write down ingredients on paper, Chris creates a Walmart pickup order online, drives over to get it
- Shops primarily at Walmart; also has Costco membership. New Smith's nearby but not in the habit yet.
- Owns a Skylight calendar that has recipe scanning and grocery list features

## Pre-App Pain Points

- Not knowing if they already have ingredients at home
- Not being sure how much to get — "you thought you had enough sugar in the pantry but forgot"
- Having to go back to the store for forgotten items
- Writing everything down manually is annoying
- Waiting at Walmart pickup
- Unprompted: "It'd be cool if you could just like get a recipe and it would like add everything to your Walmart pick-up order."

## App Walkthrough Observations

### Technical Issues
- First attempt failed — app timed out loading over local network. Required a new QR code to resolve.

### Camera Scan Test (Physical Cookbook)
- Scanned a honey lime chicken enchilada recipe from a physical cookbook
- Recipe was recognized: title, prep time (overnight marinade), cook time (30 minutes)
- **Issues noticed:**
  - Servings defaulted to 1 (should have been higher)
  - Ingredient text was cut off on screen — couldn't see full names
  - "8-10 tortillas" was parsed as quantity "8", unit "-10 each", name "tortillas" — recognized it as "a little funny" but noted he could edit it
  - Generate illustrations feature threw a console error

### Shopping List + Walmart
- Added recipe to shopping list, searched all on Walmart
- Saw prices for each ingredient — "That's cool."
- Total estimated at $32.69
- Sent 9 items to cart — one item out of stock (lime juice), rest added successfully
- **Opened Walmart app and confirmed items were in his cart.** "That's really cool."
- Showed it to wife Chris, who seemed impressed

### Price Accuracy Check
- Compared app prices to actual Walmart cart prices
- Most items were within a few cents (garlic powder off by 8¢, tortillas off by a few cents)
- Total was $38 in cart vs. $32 estimated — gap partly due to missing lime juice and some rounding
- Assessment: individual prices close, but total estimate was noticeably off

### Other Features Explored
- Nutrition information display
- Serving size editor — easily changed servings to 6
- Log meal feature — but it tried to log all 6 servings instead of 1 (bug)
- "Make it lighter" feature — liked the AI suggestions (swap heavy cream for low-fat sour cream, etc.)
- Start cooking step-by-step view with AI illustrations — "kind of cool" but images are "a little crude"

## Walmart Reaction

- **Enthusiastic.** "Oh, that would be awesome. Open Walmart... We got to get Chris to try this."
- "I'm sold."
- Confirmed items appeared in his actual Walmart cart
- Showed the full flow to Chris: "You take a picture of the recipe... view your list... search all the prices on Walmart... add them to Walmart. Isn't that cool?"

## Key Feedback

1. **Deselect items before sending to cart:** "I can see that I can check on it... but it's still the same, send 9 items to Walmart, even after I've selected a few to take off the list." Wants checked-off items excluded from the cart send.
2. **Multiple stores:** Would like Smith's, Costco options. Wherever you can do pickup. "Anywhere where you can just go, wait in your car and have them bring it to you would be the stores to prioritize."
3. **Price comparison across stores:** "Based on your whole cart, you could spend $35 at Walmart versus $38 at Smith's" — wants to choose the cheapest store for the whole order, not per-item.
4. **Manual item addition:** Wants to add non-recipe items (soda, garlic bread) to the shopping list. Ideally via natural language: "I could just kind of describe what I need."
5. **Calorie logging per serving:** Log meal should let you choose how many servings you ate, not log the entire recipe.
6. **Text cutoff:** Ingredient names were cut off on screen — needs wider display or wrapping.

## Would You Use This Regularly?

"Would I use it regularly? I think I would."

## Competitor Mention

- **Skylight calendar** has recipe scanning and grocery list features. Thomas has used it to photograph favorite recipes. But Chris doesn't use it — she does her own meal planning separately. Thomas said this app could "give them a run for their money."

## Key Quotes

- "It'd be cool if you could just like get a recipe and it would like add everything to your Walmart pick-up order." (said BEFORE seeing the app — unprompted validation of core feature)
- "I'm sold."
- "That's really cool. Isn't that cool? Would you use that?" (showing it to Chris)
- "Just give me the best price based on everything that I need."

## Product Implications

- **Thomas + Chris are the ideal target users.** Weekly Walmart pickup, recipe-driven cooking, currently using paper lists. The app directly replaces their existing workflow with less friction.
- **Unprompted feature validation:** Thomas described the exact Walmart cart feature before seeing it. This is strong evidence of real demand.
- **Deselect-before-send is a high-priority UX fix.** Users expect checked-off items (things they already have) to be excluded from the cart. Current behavior sends everything regardless.
- **Store comparison is a natural next step** but adds significant complexity. Thomas's framing ("best price for the whole cart") is the right abstraction — per-item comparison would be overwhelming.
- **The Skylight comparison is worth watching.** If smart home displays add recipe→grocery features, they become indirect competitors. Our advantage: works on the phone you already have, with Walmart integration they don't offer.
