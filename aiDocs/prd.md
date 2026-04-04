# Recipe Scanner — Product Requirements Document

## Version History
| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-04-01 | Initial PRD — problem statement, user stories, feature tiers, risks |
| v1.1 | 2026-04-02 | Refined Walmart integration approach after discovering affiliate cart URL format differs from documentation; added Walmart product matching to P0 (moved from P1) since it proved essential for user trust before sending to cart |
| v1.2 | 2026-04-02 | Updated success metrics after live testing — "opens a populated cart" changed to "opens a populated cart or search" to reflect that individual search fallback is necessary when API matching fails |
| v1.3 | 2026-04-03 | Expanded problem statement with lessons learned from building and user testing; added Home screen redesign rationale based on UX feedback that four import buttons confused users |

## Problem Statement
Cooking from physical cookbooks requires manually copying ingredient lists before going to the store. This is tedious, error-prone, and completely disconnected from modern grocery shopping. There is no fast path from "I want to make this recipe" to "these items are in my cart."

**What we learned through building:** The core hypothesis held up — users genuinely dislike retyping ingredient lists. But we discovered that the *import method* matters more than we expected. Camera scanning works well for printed cookbooks, but users overwhelmingly preferred URL import for online recipes because it's faster and more reliable than photographing a screen. We also learned that the Walmart integration is more nuanced than "search and add to cart" — the affiliate cart URL format (`affil.walmart.com/cart/addToCart`) is different from what Walmart's own documentation suggests, and users need to see matched product names and prices before they trust a bulk "send to cart" action. The original four-button import screen confused testers; consolidating into a single "Add Recipe" button with a modal selector significantly improved first-use comprehension.

## Target Users
iPhone users who cook from physical cookbooks or online recipes and do their grocery shopping at Walmart. They are not tech-averse but they don't want friction — they want a tool that does the work so they don't have to.

## Goals and Success Metrics
| Goal | Metric | Status |
|------|--------|--------|
| Fast recipe capture | Scan → structured list in under 10 seconds | Achieved for URL/photo; camera scan takes ~5-8s depending on GPT-4o response time |
| Accurate ingredient extraction | 90%+ of ingredients correctly identified | Achieved — GPT-4o handles printed recipes well; handwritten is weaker |
| Walmart integration works | Tapping "Send to Walmart" opens a populated cart or search | Achieved — affiliate cart URL adds items; per-ingredient search as fallback |
| App is usable in demo | Full flow works end-to-end without crashes in a 2-minute walkthrough | Achieved — tested on simulator and real device |

## Key Features (Priority Tiers)

### P0 — Must Ship (MVP blockers)
- **Camera scan**: User takes a photo of a printed recipe; GPT-4o Vision extracts ingredients
- **Photo library import**: User selects an existing photo from camera roll
- **URL import**: User pastes a recipe URL; app scrapes and parses ingredients
- **File import**: User selects a PDF or DOCX; text extracted and parsed by GPT-4o
- **Ingredient editor**: After scan, user can tap any ingredient to edit name, quantity, or unit
- **Serving size scaler**: User sets desired servings; all quantities scale proportionally
- **Recipe library**: Saved recipes persist locally and can be reopened
- **Shopping list**: Combined ingredient list across multiple selected recipes
- **Check-off while shopping**: Tap to cross off items as they go in the cart
- **Walmart integration**: Search Walmart for each ingredient; generate affiliate cart link or deep link

### P1 — Should Ship
- **Duplicate ingredient merging**: If two recipes both need flour, combine into one line item on the shopping list
- ~~**Walmart product matching**: Show Walmart product name + price alongside each ingredient before sending to cart~~ *(moved to P0 and shipped — users needed to see what they were sending to cart)*

### P2 — Nice to Have (post-deadline)
- **Aisle/category grouping**: Group shopping list by produce, dairy, pantry, etc.
- **Recipe notes**: User can add freeform notes to a saved recipe
- **Share list**: Share shopping list as plain text via iOS share sheet

## User Stories
1. As a user, I can point my camera at a cookbook and get a shopping list in one tap.
2. As a user, I can import a recipe from a website URL without retyping anything.
3. As a user, I can fix any ingredient the AI got wrong before I save the list.
4. As a user, I can scale a recipe to serve more or fewer people and see updated quantities.
5. As a user, I can save multiple recipes and combine their ingredient lists.
6. As a user, I can check off items as I walk through the store.
7. As a user, I can send my shopping list to Walmart and start adding items to my cart.

## Out of Scope
- User accounts or cloud sync of any kind
- Android-specific testing or optimization
- Unit conversion (e.g., cups to grams)
- Recipe ratings or social features
- Price tracking or budget tools
- Instacart, Amazon Fresh, or any non-Walmart cart integrations

## Risks and Mitigations
| Risk | Likelihood | Mitigation | Outcome |
|------|-----------|------------|---------|
| GPT-4o Vision misreads handwritten or stylized cookbook fonts | Medium | Allow full ingredient editing after scan | Confirmed — printed recipes work well, handwritten is hit-or-miss. Editor is essential. |
| Walmart API rate limits or auth issues | Medium | Cache product search results; fall back to Walmart search URL | Hit this — RSA signing with `node-forge` required; `crypto` module unavailable in React Native. Caching + search fallback both needed. |
| URL scraping fails on heavily JS-rendered recipe sites | Medium | Fall back to "paste recipe text manually" input | Confirmed — regex-based scraping works for ~70% of recipe sites. GPT-4o handles messy HTML gracefully. |
| PDF/DOCX text extraction is messy | Low-Medium | Send raw extracted text to GPT-4o with cleanup instructions | Minor issue — PDF regex extraction is imperfect but GPT-4o cleans it up. |
| App is too slow for live demo | Low | Pre-scan a recipe and save it before demo; show from library | Not an issue — GPT-4o responds in 3-8 seconds, acceptable for demo. |
| Walmart cart URL format undocumented | Unexpected | Discovered `affil.walmart.com/cart/addToCart?items=ID\|QTY` format through testing | Was not in original risk assessment — standard `walmart.com/cart?items=` does not add items. |

## Timeline
6-day sprint + rubric compliance pass. See `ai/roadmaps/roadmap.md` for day-by-day breakdown.
