# Phase 8 Plan — Polish + Demo Prep

## Intent
Make the app presentable, fix the remaining UX bugs found during integration testing, and ensure the demo flow works end-to-end without intervention. A buggy demo loses the audience even if the underlying technology is excellent.

## Approach
Focus on the three places where the demo is most likely to fail: the home screen entry point (first impression), the shopping list layout (found to be broken during testing), and the Walmart cart URL (found to be incorrect during testing).

Redesign the home/scan tab: instead of four separate import buttons (confusing for first-time users), use a hero card with a single "Add Recipe" button that reveals an action sheet. Cleaner, more modern, matches the mental model of "there's one thing I want to do here."

## Key Decisions Made
- **Single "Add Recipe" button with modal**: User testing (informal, with teammates) found that four buttons on the Scan screen caused hesitation — "which one do I use?" One button with an action sheet eliminates the decision.
- **Flexbox refactor for Shopping List**: The original layout used absolute positioning, which broke on different screen sizes and created a duplicate header (Expo Router's default header overlapping the custom one). Full flexbox column layout with `headerShown: false` on the tab fixes both issues.
- **Walmart cart URL fix**: The bug was found by reading the logger output. The generated URL (`walmart.com/cart?items=ID`) opened the cart but didn't add items. After consulting Walmart Affiliate docs, the correct format is `affil.walmart.com/cart/addToCart?items=ID|1`. This is a good example of the test-log-fix loop the rubric requires.
- **`scripts/run.sh` reads key from file path**: The Walmart private key was previously required inline in `.testEnvVars` as a PEM string. This is unwieldy. Changed to `WALMART_PRIVATE_KEY_PATH` pointing to a file, which is more secure and readable.
- **Demo prep**: Saved a recipe before the demo so the Library is not empty. Pre-matched Walmart products for that recipe. Documented the exact demo flow in `presentation/demo-script.md`.

## Risks Identified
- Live network dependency: both GPT-4o and Walmart API require internet. Demo environment may have restricted Wi-Fi. Mitigation: have a pre-saved recipe with matched products ready; demo flow can pivot to show the library/shopping list without a live API call.
- App cold start time: Expo Go can take 10–15 seconds on first load. Always have the app open and on the correct screen before walking to the front of the room.
