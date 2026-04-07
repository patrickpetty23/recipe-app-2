# Customer Conversation — Kierra

**Date:** April 2026
**App version:** Current (Expo/React Native with Walmart integration)
**Relationship to team:** Not a friend or family member

## Profile

- Married, cooks frequently for household
- Doesn't use recipes often — prefers cooking from memory
- When she does use a recipe, it's usually because she's craving something specific or found something that looks "extra delicious"
- Shops at Walmart, Sam's Club, and Smith's
- Never writes a grocery list — shops from memory starting at the vegetable section
- Occasionally forgets items at the store

## Pre-App Pain Points

- Doesn't find the grocery process particularly annoying — but acknowledged she sometimes forgets things
- Rarely writes lists; relies on memory and familiarity with the store layout

## App Walkthrough Observations

- Found and imported a recipe via URL successfully
- **Loved the instant ingredient extraction:** "I like that it just instantly pulled up the ingredients because it's super annoying on Pinterest because there's so many ads... I have to scroll all the way to the bottom to find the entire recipe."
- Encountered a technical issue mid-test (likely a navigation error), had to cancel and retry
- Explored recipe features: serving size scaler, nutrition info, start cooking flow
- Noticed NaN values for quantities that weren't specified in the original recipe — found this confusing
- Tested the Walmart integration: searched all items, saw prices, added to cart

## Walmart Reaction

- **Would trust Walmart to pick the right products:** "I think so... as long as it's just working a little bit better and more accurate numbers."
- **Price accuracy matters:** When prices changed between the app estimate and the actual Walmart cart, she was bothered. "I like the price, but of course, I would prefer no price if it's going to change."
- Preferred accurate prices or no prices over inaccurate estimates

## Key Feedback

1. **Ingredient substitutions:** "If I don't have rice wine, can I ask the AI? What's a good substitution or can I make it without it?" — This was her #1 feature request.
2. **Multiple grocery stores:** For international/Asian food, she wouldn't go to Walmart. Wanted H Mart and other international stores as options. "I wouldn't really be probably going to Walmart to get ingredients. I'd be going other places."
3. **Store comparison:** Would like to see different price ranges across stores and pick the best option.
4. **NaN values:** Quantities showing "NaN" for unspecified amounts was confusing and needs a better default.

## Would You Use This Regularly?

"Yeah, I'd use it. Regularly. Actually, regularly."

## Key Quotes

- "I like that it just instantly pulled up the ingredients because it's super annoying on Pinterest because there's so many ads."
- "I would prefer no price if it's going to change."
- "If it could give me substitutions... Can I ask the AI?"

## Product Implications

- Substitution suggestions are a high-value feature for users cooking international/unfamiliar recipes
- Price accuracy is a trust issue — showing wrong prices is worse than showing no prices
- Walmart-only integration limits value for users who shop at specialty or international stores
- NaN display is a polish issue that undermines trust in the parsing quality
