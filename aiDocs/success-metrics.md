# Success & Failure Planning — Recipe Scanner

## Midterm Definitions (For Reference)

At midterm we defined success around speed (<30s median), user-reported speed advantage (>=70%), and 7-day retention (>=50%). Failure was the inverse: slower than manual, high correction counts, and <25% return rate. We also had branching pivot plans for success and failure scenarios.

Building revealed that some midterm metrics (retention, user-reported speed) were unmeasurable in a 6-day sprint, so the PRD replaced them with system-level numbers. The final version below tests the concrete PRD metrics and honestly assesses where we stand.

---

## Part 1: Testing Our Metrics Against Reality

| Metric | Target | Actual | Verdict |
|--------|--------|--------|---------|
| Scan → structured list | < 10 sec | URL: ~4s, Camera: ~6s, PDF: ~7s, Handwritten: ~8s | **Met.** All under 10s on good network. |
| Ingredient accuracy | 90%+ | 92% aggregate (57/62 across 5 test recipes). URL/screenshot: ~100%. Handwritten: ~75%. | **Met in aggregate.** Falls short for handwritten. |
| Walmart cart | Opens populated cart | Affiliate URL adds items to cart. Staples match well; specialty items hit-or-miss. | **Met with caveats.** |
| End-to-end stability | No crashes | Happy paths and error paths (bad URL, timeout, missing keys) all handled gracefully. | **Met.** |

### What the numbers don't capture

These metrics proved the **system** works. But they missed whether the **experience** works:

- **"Under 10 seconds" measures the wrong moment.** Users perceive "scan to *saved recipe I trust*" as one step — that's 30-60 seconds including editor review. The AI is fast; the user's decision to trust and save is slower.
- **"90% accuracy" hides variance by source.** One badly-parsed handwritten recipe feels like failure even if four others were perfect. A better metric: "fewer than 3 edits per recipe."
- **"Populated cart" is binary, but quality matters.** A cart of wrong-sized items technically passes. Users need the *right* items — we saw hesitation until they could preview products and prices.
- **"No crashes" is table stakes.** Necessary, but says nothing about whether users want to come back.

---

## Part 2: What We Should Have Measured

Our PRD metrics proved the system works. But they don't prove the experience works. Here are the user-centric metrics we'd track if starting over:

| Metric | Why It Matters | How We'd Measure It | What We Observed Informally |
|--------|---------------|--------------------|-----------------------------|
| **Edits per recipe** | Measures actual AI parsing quality from the user's perspective | Count ingredient rows modified in editor before save | Most URL imports need 0-1 edits. Camera scans need 1-3. Handwritten needs 4+. |
| **Import method choice distribution** | Reveals which input path users actually prefer | Track sourceType on saved recipes | URL import preferred ~3:1 over camera by early testers. In final interviews: Kierra and Sherrie used URL; Thomas used camera on a physical cookbook. Camera has clear value for its intended use case (cookbooks), but URL is the default when both are available. |
| **Time from open to saved recipe** | Measures the full user experience, not just AI latency | Timestamp from app open to recipe save | Roughly 30-60 seconds including review. The editor step dominates, not AI processing. |
| **Shopping list completion rate** | Measures whether users actually use the list at the store | Track checked items vs. total items | Untested — would need real in-store usage data we don't have. |
| **Walmart product acceptance rate** | Measures whether matched products are actually what users want | Track how often users tap "Send to Walmart" after seeing matches | Thomas sent all items to cart and confirmed they appeared correctly. Kierra was bothered by price discrepancies. Sherrie rejected the Walmart flow entirely — she prefers in-store shopping. Acceptance depends on user type (pickup vs. in-store) and price accuracy. |

### What we'd change about success criteria

1. **Drop "under 10 seconds"** as a headline metric. It's true but misleading — the AI step is fast, but the user's *perceived* speed includes the editor review. Replace with "import to saved recipe under 60 seconds."
2. **Redefine accuracy as effort, not percentage.** "90% accuracy" is abstract. "Fewer than 2 edits per recipe on average" is something users can feel.
3. **Add a trust metric.** The real question isn't "does the Walmart cart populate" — it's "do users trust the app enough to actually send their grocery list to Walmart?" We saw users hesitate at the Walmart step until they could preview products and prices.
4. **Add a repeat-use metric.** Would a user come back tomorrow with another recipe? We didn't track this, and it's the most important long-term indicator.

---

## Part 3: Where We Actually Stand

### Honest self-assessment

| Area | Status | Confidence |
|------|--------|------------|
| Core recipe import (chat, camera, URL, PDF/DOCX, text) | Working | High — tested across multiple recipes and input types. Chat interface is the primary entry point. |
| Ingredient parsing accuracy | Strong for digital, acceptable for print, weak for handwritten | Medium — handwritten is a known gap, editor compensates |
| Recipe library with collections | Working | High — SQLite is reliable, collections with emoji folders, search and sort, DALL-E thumbnails |
| Shopping list with merge | Working | High — check-off, clear, multi-recipe accumulation, duplicate merging with fraction math |
| Walmart integration | Working but rough edges | Medium — API auth works, cart URL works, product matching quality varies. Thomas confirmed items appeared in actual Walmart cart. Price estimates close but not exact (within cents per item, ~$6 off on total). |
| Nutrition estimation + Tracker | Working | Medium — GPT-4o estimates macros on save. Tracker shows daily ring + macro bars. Thomas found log-meal defaulted to all servings instead of one (bug). |
| Cooking mode with TTS | Working | High — full-screen step-by-step, text-to-speech reads steps, countdown timer, swipe navigation, DALL-E step illustrations |
| "Make it Lighter" AI substitutions | Working | Medium — Thomas explored it, liked suggestions. Quality depends on GPT-4o output, not always culinarily accurate. |
| DALL-E 3 illustrations | Working | Medium — thumbnails and step illustrations generate successfully. Thomas: "kind of cool" but "a little crude." Failures handled gracefully (Promise.allSettled). |
| Overall demo readiness | Ready | High — can demo full cooking lifecycle flow without crashes |

### Against our midterm failure indicators

| Midterm Failure Indicator | Status | Evidence |
|---|---|---|
| "Median time >= manual baseline" | **Not failing.** | URL import: ~30-45 sec to saved recipe vs. 2-3 min manual entry. Speed advantage is real. |
| "High correction count, no downward trend" | **Mixed.** | Digital sources: 0-1 edits. Handwritten: 4+. Variance is by source type, not learning curve. |
| "7-day return < 25%" | **Unmeasured.** | Sprint was too short for retention data. Informal signal positive but anecdotal. |

We're clearly succeeding on speed, partially succeeding on trust (digital = high, handwritten = low), and have no retention data — our biggest blind spot.

### Data-informed continuation plans

| If we continued building... | Evidence behind this decision |
|---|---|
| **Fix deselect-before-cart-send** | Thomas's top UX issue — checked items should be excluded from Walmart cart. This is the most actionable fix from final interviews. |
| **Add export to Notes/Apple Lists** | Sherrie's #1 request. Represents the in-store shopper segment that doesn't want cart integration but values recipe→list. |
| **Add ingredient substitution suggestions** | Kierra's #1 request ("Can I ask the AI?"). Natural extension of the chat interface — already possible conversationally, needs a dedicated UX. |
| **Fix per-serving meal logging** | Thomas found it logs all servings instead of one. The Tracker is only useful if logging is per-serving, not per-recipe. |
| **Add multi-store price comparison** | Thomas wanted "give me the best price for the whole cart" across Walmart/Smith's/Sam's. Kierra wanted international stores (H Mart). High complexity but strong demand. |
| **Improve Walmart price accuracy** | Kierra: "I would prefer no price if it's going to change." Thomas found prices close per item but total was off by ~$6. Consider showing "estimated" label or removing price if accuracy can't be guaranteed. |
| **Double down on chat as primary interface** | The conversational pattern handles all input methods + cooking questions naturally. Continue investing here rather than reverting to button-driven flows. |
| **Run a real retention study** | Midterm's 7-day return metric was the right question. The cooking mode and nutrition tracker give users reasons to return daily (not just when planning grocery trips), which could improve retention. |
