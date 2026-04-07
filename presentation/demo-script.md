# Mise — Capstone Presentation Script

> **Speaker notes for Casey and Jason.**
> Graders are C-suite executives evaluating your PROCESS, not your product. Every section should surface evidence of how you built, not just what you built.
> Total time: 15 minutes (expect ~20 in practice with Q&A).

---

## Pre-presentation Checklist

### Night before
- [ ] Phone charged to 100%, screen brightness at max
- [ ] Expo dev server running: `npx expo start` → scan QR with Expo Go
- [ ] `.env` file in place with `EXPO_PUBLIC_OPENAI_API_KEY` set
- [ ] Wi-Fi confirmed working on both phone and laptop
- [ ] Run `./scripts/test.sh` — confirm ~55 tests pass, 0 failures
- [ ] Fresh install or clear app data so seed data triggers cleanly
- [ ] Confirm 4 seed recipes appear in the Recipes tab
- [ ] Confirm Nutrition Tracker is empty (shows zero calories for today)
- [ ] Have a recipe URL ready to paste (e.g., bbcgoodfood.com carbonara)
- [ ] Kill all background apps on phone
- [ ] Enable Do Not Disturb (allow Expo Go notifications only)
- [ ] Start screen recording on phone as backup

### Morning of
- [ ] Recheck Wi-Fi and `.env` before leaving
- [ ] Rerun test scripts one final time
- [ ] Open the app to the Recipes tab — first impression matters

---

## Timing Overview

| Section | Duration | Slides |
|---|---|---|
| Cover + problem hook | 1 min | 1 |
| Problem evolution + falsification | 2 min | 2 |
| System architecture | 1.5 min | 3 |
| Customer research + cycles | 2 min | 4, 5, 6 |
| Success/failure metrics | 1 min | 5 |
| Technical process: docs + logging | 2 min | 7, 8, 9 |
| Live demo | 5 min | 10 (phone) |
| Learnings + close | 0.5 min | 11 |
| Buffer / Q&A | 1 min | — |

---

## Section-by-Section Speaker Notes

---

### 0:00 — Cover (Slide 1)

**Opening line — say this before you introduce yourself:**

> "Last night someone needed to make dinner. They had a recipe saved on Pinterest, a URL bookmarked three months ago, and a vague memory of something their mom used to make. Three different places. Zero idea what they were eating nutritionally. And no one talking them through the cooking. That's the problem we solved — and this is the process we used to build it."

Then: names, project name, brief description.

**Key points:**
- Pills on the slide: React Native + Expo, GPT-4o + DALL-E 3, 9 Phases, 8 Test Scripts
- Emphasize "9 Phases" — this signals structured process to Casey

**Do NOT:** Launch into a product pitch or talk about market size. They are grading process.

**Transition:** "The problem itself changed as we built it. Let me show you how."

---

### 1:00 — Problem Evolution + Falsification (Slide 2)

**Opening line:**
> "The v1.0 problem statement was 'copying ingredients by hand is tedious.' By Day 8, after four rounds of user research and actually building the thing, it had expanded to three layers."

**Key points:**
- Walk through v1.0 → v1.3 briefly — this shows living documentation
- Point at the falsification table: "We tested four hypotheses with documented results. The most important one? We were wrong about camera scan. URL import was used three times more often. We changed the product because of that — URL is now the first option in the Add Recipe modal."
- This is the core 9F evidence: stated hypothesis, tested it, found it wrong, changed direction

**Do NOT:** Read every cell in the falsification table. Hit the camera falsification result — it's the most dramatic.

**Transition:** "To understand why URL import dominates, it helps to see the full system we built."

---

### 2:00 — System Architecture (Slide 3)

**Opening line:**
> "The system has two parts: everything that lives on the device, and two cloud APIs. The interesting design decisions are in how they connect."

**Key points:**
- Device block: 4 tabs all funneling through openai.js and queries.js into SQLite. Everything is local.
- Cloud: GPT-4o handles every AI call — not multiple specialized models. One API, multiple prompts.
- Read out the 4 leverage points briefly: "GPT-4o as the intelligence layer, SQLite offline, non-blocking background pipeline — that's the one that made the biggest perceived-speed difference — and cooking as the logging trigger."
- The "cooking as logging trigger" point is the insight that makes the Tracker tab elegant: "Users don't open a tracker after eating. They cook in the app. One tap logs the meal. The tracker fills itself."

**Do NOT:** Get lost in implementation details. The architecture slide shows you understood the system, not that you can explain every function.

**Transition:** "That architecture was shaped by users. Let me show you how."

---

### 3:30 — Customer Research (Slide 4)

**Opening line:**
> "We ran four rounds of research. The last round included people we'd never met. Here's what changed each time."

**Walk through the timeline column:**
- Round 1: Validated the problem exists before writing code
- Round 2: Two users independently asked about calories → built the entire Tracker tab, not in PRD
- Round 3: Both users completed full flow without guidance — product works
- Round 4: The segmentation finding

**Then read the Thomas quote:**
> "Thomas said this before we showed him the shopping tab: 'It'd be cool if you could just get a recipe and it would add everything to your Walmart pick-up order.' That is the strongest possible product validation — he described the exact feature unprompted."

**Then read the Sherrie quote:**
> "Sherrie said exactly the opposite: 'I just want a list, 'cause I'm gonna run around.' Same feature, completely different user need. That's what revealed the segmentation."

**Transition:** "Those two reactions are the pivot plan: build export-to-Notes as the exit path for Sherrie's segment. We'll come back to that."

---

### 4:30 — Customer Interaction Cycles (Slide 6)

**Opening line:**
> "We tracked every feedback-to-feature cycle — what we heard, what we built, how we validated it. Here are the five core ones."

**Walk through briefly — 15–20 seconds per card:**
1. URL > Camera: heard it, promoted URL, confirmed by 20-session data
2. Nutrition Tracker: two users asked, built a full tab, became the most-engaged feature
3. Single button: 4-second pause, redesigned entry point, no one paused again
4. Walmart preview: black-box discomfort, added product names + prices, Thomas sent to real cart
5. Two exit paths: Thomas vs. Sherrie, segmentation finding, pivot identified

**Key line:**
> "Eleven specific features are traced to specific user feedback. That's not a side effect of the process — that's the point of the process."

**Transition:** "That's the product side. Now let me show you the technical process."

---

### 6:00 — Success & Failure (Slide 5) — can fold into Customer Research block

**If short on time**, handle this with one sentence while pointing at the table:
> "Five of six primary metrics met or exceeded. Camera speed is the miss — 14 seconds average versus a 10-second target. GPT-4o Vision API latency. We mitigated it with a non-blocking UI, but the raw number missed."

**Then:**
> "What exceeded expectations: nutrition tracking wasn't in the PRD, and it became the feature users engaged with most. Thomas validated Walmart before seeing it. Voice cooking was described as 'different from other apps.'"

---

### 7:00 — Document-Driven Development (Slide 7)

**Opening line:**
> "Casey, this is for you. Every phase started with a written plan that was committed to git before a line of code was written."

**Key points:**
- Show the PRD version history: v1.0 Day 1 through v1.3 Day 8. "This is a living document, not a one-time artifact."
- Point at the file tree: "aiDocs/ holds context.md — the file Claude reads at the start of every session. It has architecture, coding style, changelog. Ten planning documents total."
- The pipeline: "PRD → roadmap → phase plans → implementation → changelog. Documents drove coding, not the other way around."

**Do NOT:** Just list the files. Explain how they were used. The grader wants to know they drove decisions.

**Transition:** "And when things broke, the logger is what found them."

---

### 8:00 — AI Infrastructure + Debugging (Slide 8)

**Opening line:**
> "The structured logger was in from Phase 1. Every service function logs on entry, exit, and error with a structured object. That's what made debugging fast."

**Walk through the three TLF loops:**

**Loop 1 — crypto:**
> "Metro bundler threw 'Can't resolve crypto.' Logger showed the RSA signing call. Node's crypto module isn't available in React Native. Fixed by switching to node-forge exclusively."

**Loop 2 — Walmart URL:**
> "Cart wasn't populating. Logger showed the URL as walmart.com/cart?items=ID. Turns out that format doesn't work. The actual format — completely undocumented — is affil.walmart.com/cart/addToCart. Thomas's cart populated after that fix."

**Loop 3 — sqlite:**
> "ERR_DLOPEN_FAILED. better-sqlite3 version mismatch. npm rebuild. Logger output pointed straight to it."

**Key line:**
> "Each of these was a test-log-fix loop: write the test, run it, read the log, fix the root cause, validate. That's the full cycle documented in the changelog."

**Transition:** "Let me show you the full phase history and then we'll run it live."

---

### 9:00 — Phase-by-Phase (Slide 9)

**Opening line:**
> "Eight phases, each with a written plan, each with a meaningful commit. The roadmap was the checklist."

**Quick walk through the timeline column** — don't read the commit messages word for word. Hit the pattern:
> "Phase 1: project setup. Phase 4: import methods — URL and camera. Phase 6: shopping list. Phase 7: Walmart. Each phase had a written plan before the coding started."

**Test scripts:**
> "Five CLI test scripts, about 55 assertions total. test-db.js has 27 assertions covering schema, CRUD, and FK cascades. test-save-flow.js covers the end-to-end save pipeline. They all pass on ./scripts/test.sh right now."

**Closing line before demo:**
> "Nine phases of build. Let's see it run."

---

### 10:00 — LIVE DEMO (5 minutes, Slide 10)

**Pick up the phone.**

> "This is running on Expo Go. Real device, real API calls."

#### Demo Beat 1 — App state (30 sec)
Navigate to the Recipes tab. Show the 4 seed recipes.
> "Library has recipes already. The AI-generated thumbnails are DALL-E 3 — generated on save, not stock photos."

#### Demo Beat 2 — Chat (1 min)
Tap the Chat tab. Type or dictate:
> "Give me a quick pasta carbonara for 2 people"

Show GPT-4o returning a structured recipe card. Tap Save Recipe.
> "Twelve seconds. Full recipe — title, ingredients with quantities, step-by-step — extracted and saved to the device. No typing."

Point at the logger if you can show it:
> "The logger captured that as: chatRecipe start → GPT-4o call → structured JSON → saveRecipe → done. Every service call logged."

#### Demo Beat 3 — Recipe detail (1 min)
Navigate to the saved recipe. Show:
- AI-generated thumbnail (or "Generating..." — be honest about the pipeline)
- Nutrition panel: "GPT-4o estimated this in the background while we were navigating. Zero manual input."
- Ingredient list: scroll through

> "This is the non-blocking pipeline in action. Navigate away on save, nutrition fills in asynchronously."

#### Demo Beat 4 — Cooking mode (1 min)
Tap Start Cooking.
> "Full-screen, step by step. Phone is reading the recipe to me. I can put it down and just cook."

Swipe to step 2. Show the step illustration. Show the timer.
> "Text-to-speech from expo-speech. DALL-E 2 illustration per step. Every competitor shows you a recipe. None of them cook with you."

#### Demo Beat 5 — Nutrition Tracker (30 sec)
Navigate to Tracker tab. Show the calorie ring and macro bars.

If you can: tap Log Meal from the recipe detail, then return to Tracker.
> "That feature was not in the v1.0 PRD. Two users asked about calories on Day 5. We built the entire Tracker tab from that feedback. Logging is a side effect of cooking — one tap, done."

#### Demo Beat 6 — Shopping list (1 min)
Navigate to the Shopping tab. Show ingredient list. Show Walmart product matches.
> "Per-ingredient product names and prices. Thomas added the Walmart feature in his session and said 'I'm sold.' We showed you his quote earlier — he described this exact feature before seeing it."

Tap Send to Walmart (or show the button).
> "Opens the Walmart cart with items populated."

**End of demo:**
> "That's the full lifecycle — capture, cook, log, shop. Nine phases."

---

### 14:30 — Learnings + Close (Slide 11)

**Brief — 30 seconds:**
> "Three things surprised us. Camera wasn't the primary input — that changed the product. Nutrition tracking wasn't in the PRD — that became the killer feature. And Thomas told us what the Walmart cart did before he saw it. That's the feedback loop working."

**What we'd do differently:**
> "Fix per-serving logging before the demo. Build export-to-Notes for Sherrie's segment. Start camera speed mitigation earlier."

**Close:**
> "The kitchen was the last room without an AI assistant. We gave it one."

---

## Q&A Preparation

Casey and Jason will ask about process, not product features. Prepare for these:

**"Walk me through how your git history shows the phases."**
> We committed a written plan before each phase. git log shows 8 distinct phase commits from Apr 1–2, each matching the roadmap milestone. The roadmap.md was the checklist — each phase is checked off as it was completed.

**"Why did the problem statement change from v1.0 to v1.3?"**
> v1.0 was written before any user research. Day 5 users asked about calories — that's not in v1.0. Day 8 we realized the problem isn't just shopping friction, it's the whole cooking lifecycle. The PRD updated to reflect what we learned. That's the document being a living artifact, not a one-time spec.

**"How did you use Claude/AI in the build?"**
> context.md and aiDocs/ gave Claude the full project context at the start of every session. Phase plans told Claude what to build. The changelog documented what happened. We iterated in sessions, not in one long chat. MCP was configured to let Claude read the codebase directly.

**"What would you do with more time?"**
> Fix per-serving logging (Thomas found the bug). Build export-to-Notes for Sherrie's user type. Improve camera speed — explore optimistic UI that navigates before the API responds. Run a real 7-day retention study — the cooking mode and tracker create daily reasons to return that we didn't measure.

**"How do you know the Walmart integration actually works?"**
> Thomas sent items from the app to his real Walmart cart in Round 4 and confirmed they appeared in his actual Walmart app. That's not a simulated demo — it was a live test with a real user and a real cart. We also tested the URL format with 3 Test-Log-Fix loops documented in the changelog.

**"Which rubric section are you most confident in?"**
> 9G and 9I — customer focus and interaction. We ran 4 rounds, went beyond our friend circle, got Thomas's unprompted Walmart validation, found the segmentation between Sherrie and Thomas, and traced 11 specific features to specific user feedback. The research drove real product decisions.

**"What failed?"**
> Camera speed missed the 10-second target by 40% — GPT-4o Vision API latency is 12–18 seconds. Per-serving logging defaulted to all servings, which broke the Tracker. Walmart price totals were off by ~$6 on a $32–38 basket. We know the root causes for all three and have documented them.

---

## If the Demo Breaks

| Problem | What to do |
|---|---|
| No internet on phone | Show screen recording backup. Say: "Let me play the recording — the logger output is also here if you want to see the structured logs." |
| Expo app crashes | Shake phone → Reload. Keep talking. Takes 5 seconds. |
| API key error | Navigate to an already-saved recipe to show cooking mode and nutrition panel. Say: "The AI call would go here — let me show you what the saved data looks like." |
| TTS not speaking | Read the step aloud yourself. "The voice is there on a working device — let me read this one." |
| App slow / laggy | Keep talking through the feature. Attribute it to the demo environment. Don't apologize repeatedly. |
| Walmart send fails | Show the product preview screen with prices. "The cart URL call would open here — Thomas tested this in Round 4 with a real Walmart account." |
| Logger output not visible | Reference it verbally: "The logger would show openai.estimateNutrition start → API call → result. It's in the changelog with the three TLF loops." |
| Rubric question you didn't expect | Say where the evidence lives. "That's in aiDocs/changelog.md under the Phase 7 TLF loops" or "That commit is in the git log — I can pull it up." |
