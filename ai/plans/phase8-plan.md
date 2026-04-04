# Phase 8 Plan — Polish + Demo Prep

## Goal
App is stable, looks presentable, and the demo flow works end-to-end without intervention.

## Approach
- Redesign Home screen: replace the four-button Scan tab with a clean Home page featuring a single "Add Recipe" button that opens a modal for import method selection — addresses UX feedback that four buttons confused first-time users
- Fix Shopping List UI: replace absolute positioning with flexbox layout, remove duplicate header from Expo Router
- Fix Walmart cart URL: discovered `walmart.com/cart?items=` doesn't actually add items; switch to `affil.walmart.com/cart/addToCart?items=ID|QTY` format
- Fix `crypto` module error: remove Node.js `crypto` fallback entirely, rely on `node-forge` exclusively
- Update `scripts/run.sh` to support reading Walmart private key from a file path (multi-line PEM keys are unwieldy inline in `.testEnvVars`)
- Write README with setup instructions
- Test full end-to-end flow on real iPhone

## Key Decisions
- **Modal over separate screen for import selection** — keeps the user on the Home tab, feels lighter than navigating to a new screen. The modal slides up from the bottom with clear icons for each import method.
- **Flexbox over absolute positioning for Shopping List** — the original layout used hardcoded `bottom` values that broke when the Walmart bar was hidden. Flexbox makes the layout responsive to content.
- **`affil.walmart.com` cart URL** — the standard `walmart.com/cart?items=` URL just navigates to the cart page without adding items. The affiliate URL format with `|QTY` suffix per item actually triggers the add-to-cart action.
- **Private key file path** — storing a multi-line RSA private key inline in a shell env file is fragile. Reading from a file path at runtime is cleaner.

## Success Criteria
- Full flow on real iPhone: Home → Add Recipe → camera/URL → editor → save → library → shopping list → Walmart → no crashes
- README accurate and complete
- All existing test scripts still pass
