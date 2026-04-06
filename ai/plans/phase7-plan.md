# Phase 7 Plan — Walmart Integration

## Intent
Complete the original core loop: shopping list → Walmart cart. This is the differentiating feature of the product and the reason Walmart was chosen as the integration target over generic grocery apps.

## Approach
The Walmart Affiliate API v2 requires RSA-signed auth headers — more complex than a simple API key. Use `node-forge` for RSA signing in React Native (the Node.js `crypto` module is not available in the RN runtime).

Two-step integration: (1) per-ingredient search to find the matching Walmart product ID, then (2) a single "Send to Cart" action that builds the cart URL from all matched IDs.

Cache search results in memory per session. The same ingredient appears in multiple recipes — hitting the API for "flour" three times is wasteful and slow.

## Key Decisions Made
- **Walmart over Instacart/Amazon**: Walmart has a public affiliate API with documented cart URL format. Instacart and Amazon's integrations are either gated or deprecated. Walmart is also a mass-market choice aligned with the target user demographic.
- **`affil.walmart.com/cart/addToCart?items=ID|1` URL format**: The initial implementation used `walmart.com/cart?items=ID` which opened the cart but did NOT add items. Found this bug via the logger (seeing the URL being generated) and fixed after reading Walmart's affiliate docs. The correct format appends `|quantity` to each item ID.
- **Graceful degradation without API key**: If credentials aren't set, the Walmart buttons are still visible but show an alert when tapped. The app doesn't crash. This is important for demo resilience.
- **`node-forge` for RSA signing**: The Walmart API requires RSA-SHA256 signing. React Native doesn't have the Node.js `crypto` module. `node-forge` is a pure JS implementation that works in RN and is already bundled with many Expo projects.
- **Search result is "first match"**: No ranking or relevance scoring. The top Walmart result for "all-purpose flour" is almost always the right product. Acceptable for MVP.

## Risks Identified
- Walmart API auth tokens expire. The current implementation generates a new signature per request. If this causes issues, tokens can be cached with a TTL.
- Some ingredient names are too generic ("salt", "water") and return irrelevant Walmart products. Mitigation: show the matched product name to the user so they can see what will be added before committing.
