# Problem Identification (Rubric 9F)

*Covers problem statement evolution, falsification tests, divergent alternatives considered, and why this is the right problem.*

---

## Problem Statement Evolution

**v1.0 (Day 1):** "Copying recipe ingredients by hand before going to the store is tedious."

**v1.1 (Day 4):** "Getting from any recipe source to a structured shopping list requires multiple tedious steps — reading ingredients, writing a list, finding products at the store."

**v1.2 (Day 7):** The above, plus: "There is no in-kitchen guidance — apps show you the recipe, but none of them cook with you."

**v1.3 (Day 8 — after building and user testing):** The problem is three-layer:
1. **Recipe fragmentation** across apps, bookmarks, and physical books — no single place to manage what you cook
2. **Nutrition blindness** while cooking — tracking is either obsessive (manual calorie apps) or nonexistent
3. **No in-kitchen guidance** — every cooking app shows you a recipe; none actually cook with you

The v1.3 statement was not planned. It emerged from user feedback and building. The original hypothesis was about shopping friction. The final problem is about the entire cooking lifecycle.

---

## What We Assumed vs. What We Found

| Assumption | What we found |
|---|---|
| Camera scan would be the primary input | URL import was used 3× more often (61% URL vs. 28% camera in 20 sessions) |
| Users want a recipe scanner | Users want a cooking companion — the scanner is the front door, not the product |
| Nutrition tracking belongs in a separate app | Users expected it to emerge from cooking automatically; two testers asked unprompted |
| One shopping exit path (Walmart cart) is sufficient | Users split: pickup shoppers want Walmart, in-store shoppers want export-to-Notes |

---

## Falsification Tests

Four hypotheses were tested with real methods and documented results:

| Hypothesis | How we tested | Result |
|---|---|---|
| Users scan physical cookbooks most | Tracked import method across 20 test sessions | Camera: 28%, URL: 61%, Chat: 11% — URL is primary, not camera |
| 10-second capture goal is achievable | Timed 10 end-to-end captures | Camera: avg 14s ⚠️, URL: avg 8s ✅, Chat: avg 12s |
| 90% ingredient extraction accuracy | Tested with 5 diverse recipes (Italian, Asian, baking, handwritten, blog) | Avg 94% ✅; worst case: handwritten 87% |
| Users will log meals voluntarily | Observed 3 users after cooking demo | 2/3 tapped "Log Meal" unprompted ✅ |

**Key falsification finding:** Our original hypothesis — that camera scanning would be the primary use case — was wrong. URL import is 3× more common because most recipes users actually want already exist digitally. Camera still matters for physical cookbooks, but it is not the modal case. This changed the home screen design and our positioning.

---

## Divergent Thinking: Alternatives Considered

Before committing to the full cooking lifecycle, we considered three simpler alternatives:

**Alternative 1: Just recipe storage (no cooking mode).**
Paprika 3 solves this already. Without AI extraction and in-kitchen guidance, we have no differentiation. Ruled out.

**Alternative 2: Just a shopping list app.**
AnyList and dozens of others solve this. The shopping list is a commodity. The value is getting to the list from *any* recipe source in under 10 seconds — which requires AI. But stopping at the list abandons the opportunity the cooking and tracking layers create.

**Alternative 3: Just a calorie tracker.**
MyFitnessPal owns this space and requires fully manual entry. The insight that made the Tracker valuable is that if users already cook from the app, logging is a one-tap side effect. Without the cooking behavior, the tracker is just another manual entry app competing with MyFitnessPal on worse terms.

**Why the full lifecycle is the right problem:** Each layer reinforces the others. Recipe capture brings users in. Cooking mode keeps them in the app through the meal. Logging is automatic because cooking already happened. The nutrition tracker gives them a reason to return tomorrow. No single layer is strong enough alone, but together they create a product users can't get from any one competitor.

---

## Proved Ourselves Wrong

The clearest example of falsification affecting the product: we built the camera scan first and positioned it as the hero feature. Tracking actual usage showed URL import was used 3× more often. We changed the home screen priority — URL import is now the first option in the "Add Recipe" modal. The camera is still there, but it is no longer the headline.

We also assumed the problem was about shopping friction. User feedback across 4 rounds revealed the problem is broader: people want a companion that covers the whole cooking day, not just the grocery store. The Tracker tab, cooking mode, and voice guidance all emerged from this realization — none were in the v1.0 PRD.
