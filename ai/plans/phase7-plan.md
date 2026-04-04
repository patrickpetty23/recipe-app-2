# Phase 7 Plan — Walmart Integration

## Goal
Each ingredient on the shopping list can be searched on Walmart. Matched products show name + price. A "Send to Walmart" button opens a cart with all matched items.

## Approach
- Implement `src/services/walmart.js`:
  - `searchProduct(ingredientName)` — hits Walmart Affiliate Product API v2 with RSA-SHA256 signed auth headers, returns top match as `WalmartProduct`
  - `buildCartLink(itemIds[])` — generates Walmart affiliate cart URL from item IDs
  - `isWalmartConfigured()` — checks if API credentials are present
  - In-memory cache to avoid duplicate API calls for the same ingredient per session
- Use `node-forge` for RSA signing since Node.js `crypto` module is unavailable in React Native
- Shopping List screen gets per-ingredient "Find on Walmart" button, inline product match display, and "Send to Walmart" bottom bar
- Write a CLI test that searches for real ingredients and builds a cart URL

## Key Decisions
- **`node-forge` over `crypto`** — React Native doesn't bundle Node.js built-in modules. `node-forge` provides RSA-SHA256 signing that works in the React Native JavaScript runtime.
- **Affiliate Product API v2** — requires consumer ID + RSA-signed headers (timestamp, consumer ID, key version). More complex auth than a simple API key, but it's what Walmart provides for product search.
- **In-memory cache** — if the user taps "Find on Walmart" for flour, then navigates away and back, we don't re-hit the API. Cache resets on app restart, which is fine for a session.
- **Graceful degradation** — if Walmart API credentials aren't configured, buttons remain visible but show a popup alert explaining the key is needed. App doesn't crash.

## Success Criteria
- `node scripts/test-walmart.js` exits 0 (requires valid Walmart API credentials)
- Per-ingredient Walmart search shows product name + price
- "Send to Walmart" opens browser with items in cart
