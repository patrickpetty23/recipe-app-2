# Falsification Tests

## Test 1 — Do users catch AI extraction errors? (Midterm, February 2026)

### What we were trying to break

The core assumption: that users will trust an AI-extracted ingredient list enough to shop from it — and that if something is wrong, they'll notice before it becomes a problem at the store.

### How we ran it

Three participants. Used a Keynote mockup — they took a photo of a printed recipe card and a pre-loaded "scan result" appeared. Two deliberate errors were planted:
- One ingredient removed entirely (mid-list, easy to visually skip)
- One quantity changed (same unit, just the number was wrong)

### What happened

| Participant | Checked against original? | What they caught |
|---|---|---|
| A | No — accepted immediately | Nothing |
| B | Yes — read carefully | Wrong quantity only |
| C | Skimmed | Missing ingredient only |

No one caught both errors. Users don't run systematic checks — they scan through the lens of what they're already worried about.

### What we changed

The app needs to direct attention, not just allow editing. We built the editor with separate tappable fields for name, quantity, and unit (rather than a single text blob), making misparses structurally visible. In final testing, Thomas and Kierra both caught parsing issues naturally in the structured editor — confirming the design decision worked.

---

## Test 2 — Is the app faster than manual entry? (Final, April 2026)

**Hypothesis:** AI-powered import is faster than manually typing an ingredient list.

**How tested:** Observed three users (Kierra, Sherrie, Thomas) importing recipes. Thomas provided the clearest baseline — his current method is writing ingredients on paper, then manually entering them into the Walmart website.

**Result:** Validated. Thomas's multi-step workflow collapsed into: take photo → review → save → send to Walmart. Kierra called out the speed advantage explicitly vs. scrolling past ads on Pinterest. No user suggested their manual method was faster.

---

## Test 3 — Do users actually want Walmart cart integration? (Final, April 2026)

**Hypothesis:** Users would send their grocery list directly to a Walmart cart.

**How tested:** After building the shopping list, users could search Walmart for products and send items to cart. Observed engagement and asked about trust.

**Result:** Validated for the primary segment, with a segmentation discovery. Thomas enthusiastically validated — described the feature unprompted before seeing it. Kierra would use it conditionally (price accuracy matters). All 4 teammate-round participants loved it. Sherrie rejected it (in-store shopper) — revealing a second user segment that wants list export instead.

**8 of 9 final users validated the Walmart cart** (adding Maya and Jane). Sherrie's feedback deepened our customer understanding rather than invalidating the feature. Maya and Jane both used the Walmart search and saw value, though Jane immediately asked about Sam's Club too.

---

## Test 4 — Which import method do users reach for? (Final, April 2026)

**Hypothesis (midterm):** Camera scanning is the primary use case.

**How tested:** Users given access to all import methods. Thomas had a physical cookbook. Maya tested both URL and camera (handwritten recipe card).

**Result:** Partially falsified. URL import preferred when a URL is available (Kierra, Sherrie, Jane). Thomas chose camera scan with a physical cookbook. Maya tested both — URL for online recipes, camera for her mom's handwritten recipe card. Camera is not the primary use case, but it IS emotionally resonant (Maya: "The fact that it even read my mom's handwriting is kind of amazing") and differentiates us from competitors.

---

## Test 5 — Is passive calorie tracking a real differentiator? (Final, April 2026)

**Hypothesis:** Users will value automatic nutrition tracking over manual calorie entry.

**How tested:** Showed Maya and Jane the Tracker tab after they saved a recipe. Neither was prompted about nutrition — we waited to see if they found it and how they reacted.

**Result:** Strongly validated. Maya's eyes lit up: "Wait, so it counts the calories FOR me when I cook? I don't have to type everything in?" This was her strongest reaction in the entire session. She had quit MyFitnessPal twice because manual entry was "soul-crushing." Jane also noticed the nutrition tab and appreciated that it wasn't weight-focused: "I kind of like that it's not about weight loss, just nutrition." This is now the 7th+ user to validate nutrition tracking across all rounds.

---

## Summary

| Test | Hypothesis | Result | Product impact |
|------|-----------|--------|---------------|
| 1 (midterm) | Users catch AI errors | Falsified — 0/3 caught both | Built structured per-field editor |
| 2 (final) | App faster than manual | Validated | Confirmed core value proposition |
| 3 (final) | Users want Walmart cart | Validated 8/9, segmentation found | Walmart cart is core pitch + need export and multi-store paths |
| 4 (final) | Camera is primary input | Partially falsified | URL/chat promoted, camera kept for cookbooks and family recipes |
| 5 (final) | Passive calorie tracking differentiates | Strongly validated | Nutrition tracker confirmed as must-have by 7+ users |
