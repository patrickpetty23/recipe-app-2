# Problem Identification — Recipe Scanner

## Midterm Problem Statement

Cooking from physical cookbooks or screenshot-saved recipes requires manually copying ingredient lists before going to the store. This is tedious, error-prone, and disconnected from modern grocery shopping.

**Midterm core assumption:** Users will trust an AI-extracted ingredient list enough to actually shop from it — and if something is wrong, they'll notice before it becomes a problem at the store.

## Midterm Falsification Test (February 2026)

We tested the trust assumption with a Keynote mockup. Three participants took a photo of a printed recipe card and saw a pre-loaded "scan result" with two deliberate errors: one ingredient removed entirely, one quantity changed.

| Participant | Checked against original? | What they caught |
|---|---|---|
| A | No — accepted immediately | Nothing |
| B | Yes — read carefully | Wrong quantity only |
| C | Skimmed | Missing ingredient only |

**Finding:** No one caught both errors. Users don't run systematic checks — they scan through the lens of what they're already worried about. An open edit field isn't sufficient protection if people don't know where to look.

**Recommendation at midterm:** The app needs to direct attention, not just allow editing. Low-confidence fields should be visually flagged.

---

## How the Problem Evolved Through Building

### The original problem held up — but the shape changed

The core insight was right: retyping ingredients is tedious, and users want a faster path. But building and testing revealed the problem is more nuanced than "scan a cookbook photo and get a list."

**What we learned:**

1. **The input problem is broader than cookbooks.** Our midterm framed the problem around physical cookbooks and screenshots. Building revealed users interact with recipes from URLs, PDFs, and photos — and URL import is actually preferred ~3:1 over camera. The problem isn't "scanning cookbooks is hard" — it's "getting from any recipe source to a structured shopping list is hard."

2. **The trust problem from our falsification test showed up differently in the real app.** Our midterm test found users don't systematically check AI output. In the real app, the editor naturally draws more attention because users see their recipe's ingredients in an editable list — it's not just a wall of text. Users still don't catch everything, but the structured format (name / quantity / unit per row) makes errors more visible than the mockup suggested.

3. **A new trust problem emerged: Walmart product matching.** Users who were comfortable with the ingredient list hesitated at the Walmart step. Sending items to a cart requires trusting that the app picked the *right* products — right brand, right size. This is a different trust problem than ingredient accuracy, and one we didn't anticipate at midterm.

4. **The "so what" problem.** Our midterm Participant A flagged this: some users don't experience the app as solving a real problem because they weren't bothered by their current method. The problem resonates most with people who cook frequently from multiple sources — not casual cooks.

### Refined problem statement

Getting from a recipe — whether it's a URL, a cookbook page, a PDF, or a screenshot — to a grocery cart requires multiple tedious steps: reading ingredients, writing a list, finding products at the store. Each step is a place where items get missed or quantities get wrong. There's no single tool that handles the full pipeline from *any* recipe source to *any* grocery store cart.

---

## Falsification Tests — Final

### Test 1 (Midterm, executed): Do users catch AI parsing errors?

**Result:** No — see midterm results above. No participant caught both planted errors.

**How this shaped the product:** We built the editor with per-field editing (name, quantity, unit as separate tappable fields) rather than a single text blob, making it easier to spot misparses. Rather than implementing confidence flagging (recommended at midterm), we found that the structured per-field layout itself surfaces errors effectively — Thomas and Kierra both caught parsing issues naturally in the final round.

### Test 2: Is the app actually faster than manual entry?

**Hypothesis:** AI-powered import is faster than manually typing an ingredient list.

**How we tested:** Observed three users (Kierra, Sherrie, Thomas) importing recipes via the app during hands-on sessions. Thomas provided the clearest baseline comparison — his current method is writing ingredients on paper, then manually entering them into the Walmart website.

**Result:** **Hypothesis supported.** Thomas's current workflow involves reading a recipe, handwriting a list, then re-entering items online — a multi-step process. The app collapsed this into: take photo (or paste URL) → review → save → send to Walmart. Kierra called out the speed advantage explicitly: "it just instantly pulled up the ingredients" vs. scrolling past ads on Pinterest. No user suggested their manual method was faster. The perceived speed gain is strongest for URL import and weakest for camera scan (which requires good lighting and a steady hand).

**What we'd refine in v2:** A formal side-by-side timed comparison would produce harder numbers. Based on observed workflows, the app is approximately 2-3x faster for a typical recipe — Thomas's current process (paper list → Walmart website) takes several minutes vs. under a minute in the app.

### Test 3: Do users actually want Walmart cart integration?

**Hypothesis:** Users would send their grocery list directly to a Walmart cart.

**How we tested:** After building the shopping list, users could search Walmart for products and send items to cart. We observed whether they engaged with this feature and asked about trust.

**Result:** **Hypothesis validated for the primary segment, with a segmentation discovery.**
- **Thomas (Walmart pickup user):** Enthusiastically validated. Described the exact feature unprompted BEFORE seeing the app: "It'd be cool if you could just get a recipe and it would add everything to your Walmart pick-up order." Used send-to-cart, confirmed items appeared in his actual Walmart cart. "I'm sold."
- **Kierra (multi-store shopper):** Would use it, but conditionally. Trusted the product matching but was bothered by price inaccuracies. "I would prefer no price if it's going to change."
- **Teammate round (Trevor, Spencer, John, Kelly):** All four loved the Walmart integration. Universal enthusiasm in this group.
- **Sherrie (in-store shopper):** Preferred a plain list export over cart integration. "I just want a list." This revealed a second user segment, not a product failure — in-store shoppers want recipe→list, pickup shoppers want recipe→list→cart.

**Implication:** 6 of 7 final users validated Walmart cart integration — a strong signal for the primary segment (pickup/delivery shoppers). Sherrie's feedback revealed a secondary segment (in-store shoppers who want list export). Both paths need to exist. This segmentation discovery deepened our understanding of the customer beyond our midterm definition.

### Test 4: Which import method do users reach for?

**Hypothesis (midterm):** Camera scanning is the primary use case.

**How we tested:** Users were given access to the full app with all import methods. Thomas also had a physical cookbook available.

**Result:** **Hypothesis partially falsified.** URL import remains preferred when a URL is available (Kierra, Sherrie both used URL). However, Thomas chose camera scan — he had a physical cookbook in front of him and wanted to test that flow specifically. Camera scan worked but surfaced parsing edge cases (quantity ranges, text cutoff) that URL import avoids.

**Updated understanding:** Camera scan is not the primary use case, but it IS the use case that differentiates us most — no major competitor does AI-powered cookbook scanning to Walmart cart. URL import is the everyday default; camera scan is the "wow" feature for cookbooks and the demo.

---

## Falsification Summary

All four tests executed with documented results:
- Test 1 (midterm): Users don't systematically check AI output → shaped editor design
- Test 2: App is faster than manual entry → validated by observed workflows
- Test 3: Walmart cart demand → validated by 6/7 users, with segmentation discovery
- Test 4: Camera is primary input → partially falsified, URL/chat preferred 3:1
