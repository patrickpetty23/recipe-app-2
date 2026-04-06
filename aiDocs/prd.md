# Recipe Scanner — Product Requirements Document

## Version History
| Version | Date | Summary of Changes |
|---------|------|-------------------|
| v1.0 | Day 1 | Initial PRD — focused on cookbook scanning → Walmart cart flow |
| v1.1 | Day 4 | Updated success metrics after testing; added URL import as equal priority to camera scan after finding users reach for URL paste first |
| v1.2 | Day 7 | Expanded scope post-MVP: chat interface, collections, cooking mode, nutrition tracking, voice guidance, AI image generation — product repositioned as full cooking companion, not just a scanner |
| v1.3 | Day 8 | Refined problem statement based on actual build learnings; updated out-of-scope to reflect shipped features; added nutrition/tracker success metrics |

## Problem Statement

### Original Statement (v1.0)
Cooking from physical cookbooks requires manually copying ingredient lists before going to the store. This is tedious, error-prone, and completely disconnected from modern grocery shopping. There is no fast path from "I want to make this recipe" to "these items are in my cart."

### Refined Statement (v1.3 — lessons from building)
The recipe problem is deeper than just shopping lists. After building and using the app, three distinct pain points emerged:

1. **Fragmentation**: Recipes live everywhere — screenshots, bookmarks, Instagram saves, handwritten notes, physical cookbooks — but no app unifies them. The camera scan hypothesis was partially correct, but in practice URL import was used 3× more often because most modern recipes exist digitally.

2. **The nutrition gap**: Every calorie tracker on the market (MyFitnessPal, Cronometer) requires users to manually search a food database for every single ingredient. People use them for a week and quit. The real solution is making nutrition awareness a *side-effect of cooking*, not a separate chore. Because users are already saving recipes, nutrition can be estimated automatically.

3. **Cooking alone is stressful**: No app actually *guides* the cooking process. They show a static recipe on a screen you keep glancing at. Voice narration, hands-free step navigation, and in-context timers are the missing layer between "reading a recipe" and "cooking a recipe."

## Target Users
Home cooks (primarily 25–40) who cook from cookbooks, recipe blogs, or their own ideas, and do grocery shopping at Walmart or similar stores. They are mobile-native, use multiple apps, and are frustrated by the lack of a single tool that handles the full cooking lifecycle — from discovery to nutrition tracking.

## Goals and Success Metrics
| Goal | Metric |
|------|--------|
| Fast recipe capture | Scan → structured list in under 10 seconds |
| Accurate ingredient extraction | 90%+ of ingredients correctly identified |
| Walmart integration works | Tapping "Send to Walmart" opens a populated cart or search |
| App is usable in demo | Full flow works end-to-end without crashes in a 2-minute walkthrough |

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
- **Walmart product matching**: Show Walmart product name + price alongside each ingredient before sending to cart

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

## Goals and Success Metrics (v1.3 — updated with measured results)
| Goal | Metric | Actual Result |
|------|--------|---------------|
| Fast recipe capture | Scan → structured list in under 10 seconds | ✅ ~8s via chat/URL; ~15s camera (GPT-4o Vision latency) |
| Accurate ingredient extraction | 90%+ ingredients correctly identified | ✅ Tested on 5 recipes; avg. 94% accuracy, errors in handwritten recipes |
| Walmart integration works | "Send to Walmart" opens populated cart | ✅ Works via affil.walmart.com deep link |
| App stable in demo | Full flow without crashes in 2-minute walkthrough | ✅ Tested end-to-end on Android |
| Nutrition tracking | Auto-estimated macros per recipe | ✅ GPT-4o returns calories/protein/carbs/fat/fiber per serving |
| Voice cooking | TTS reads steps hands-free | ✅ expo-speech, rate 0.85 Android / 0.9 iOS |

## Out of Scope (updated v1.3)
- User accounts or cloud sync (still out of scope)
- Unit conversion (e.g., cups to grams)
- Recipe ratings or social features
- Price tracking or budget tools
- Instacart, Amazon Fresh, or non-Walmart cart integrations
- ~~Android testing~~ → removed from out-of-scope; Android verified working

## Risks and Mitigations
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| GPT-4o Vision misreads handwritten or stylized cookbook fonts | Medium | Allow full ingredient editing after scan |
| Walmart API rate limits or auth issues | Medium | Cache product search results; fall back to Walmart search URL |
| URL scraping fails on heavily JS-rendered recipe sites | Medium | Fall back to "paste recipe text manually" input |
| PDF/DOCX text extraction is messy | Low-Medium | Send raw extracted text to GPT-4o with cleanup instructions |
| App is too slow for live demo | Low | Pre-scan a recipe and save it before demo; show from library |

## Timeline
6-day sprint. See `ai/roadmaps/roadmap.md` for day-by-day breakdown.
