# Recipe Scanner — MVP Definition

## MVP Goal
A working iOS app that demonstrates the full core loop: **scan or import a recipe → review and edit ingredients → send to Walmart** — all without user accounts, cloud sync, or any features beyond this flow.

The MVP exists to prove the concept works and deliver a compelling demo within 6 days.

> **Note (v1.4):** The delivered app significantly exceeds this MVP scope. Beyond-MVP features include: iMessage-style chat tab, AI recipe thumbnails (DALL-E 3), step illustrations (DALL-E 3), cooking mode with TTS and timers, nutrition tracking (GPT-4o macros + cook log), Tracker tab, AI-powered Meal Planner tab (weekly calendar + GPT-4o meal suggestions), Collections, fraction-based quantities, individual ingredient shopping list management, onboarding screen, and cross-platform iOS/Android support. The MVP definition below reflects the original scoped deliverable; `aiDocs/prd.md` documents the full current product.

## What IS in the MVP

### Input Methods
- ✅ Camera scan (photo → GPT-4o Vision → ingredient list)
- ✅ Camera roll import (pick existing photo → same GPT-4o flow)
- ✅ URL import (scrape recipe page → GPT-4o cleanup → ingredient list)
- ✅ File import — PDF and DOCX (extract text → GPT-4o cleanup → ingredient list)

### Recipe Management
- ✅ Editable ingredient list (name, quantity, unit per line)
- ✅ Serving size scaler (multiplier applied to all quantities)
- ✅ Save recipe to local library
- ✅ View saved recipe library

### Shopping
- ✅ Combined shopping list from one or more saved recipes
- ✅ Check off items while shopping

### Walmart Integration
- ✅ Search Walmart Open API for each ingredient
- ✅ Display matched product + price
- ✅ Generate Walmart cart link or deep link and open it

## What is NOT in the MVP
| Feature | Reason Cut |
|---------|-----------|
| User accounts / cloud sync | Out of scope, adds complexity |
| Unit conversion | Rabbit hole, not core to the demo |
| ~~Duplicate ingredient merging~~ | ~~P1, not blocking~~ — shipped: shopping list now merges identical ingredients by name+unit and sums quantities |
| Aisle/category grouping | P2 |
| Recipe notes or ratings | P2 |
| Share list via share sheet | P2 |
| ~~Android testing~~ | ~~Time constraint~~ — Android verified working via Expo Go |
| Instacart / Amazon integration | Walmart is the differentiator |

## MVP Success Criteria
The MVP is done when a user can:
1. Open the app on an iPhone
2. Scan OR import a recipe using any supported method
3. See a structured, editable ingredient list
4. Adjust the serving size
5. Send the list to Walmart (opens cart or search with items)

All five steps must work without crashing in a single session.

## Simplifications Allowed in MVP
- GPT-4o prompt can be tuned for cookbooks specifically; doesn't need to handle every edge case
- Walmart search can return first result match; no complex ranking
- No loading skeletons — a simple spinner is fine
- No empty state illustrations — plain text placeholders are acceptable
- SQLite schema doesn't need migrations; fresh install is fine
