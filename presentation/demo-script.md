# Mise — 20-Minute Presentation & Demo Script

> **Speaker notes for the live presentation.**
> Estimated timings are targets, not hard stops. Demo is the centrepiece — protect that time above all else.

---

## Pre-presentation checklist (do the night before)

- [ ] Phone charged to 100%, screen brightness at max
- [ ] App open and on the Chat screen (first impression matters)
- [ ] Expo dev server running: `npx expo start` → scan QR with Expo Go
- [ ] `.env` file in place with `EXPO_PUBLIC_OPENAI_API_KEY` set
- [ ] Wi-Fi confirmed working on phone AND laptop
- [ ] One recipe already saved (so Library isn't empty)
- [ ] One recipe with nutrition already estimated (so Tracker has data)
- [ ] Kill all other apps on the phone (performance + no notifications)
- [ ] Turn off Do Not Disturb — wait, actually **turn it ON**
- [ ] Screen recording running on phone as backup (Settings → Control Centre → Screen Recording)
- [ ] Backup: screen mirror via USB cable in case Wi-Fi fails

---

## Timing overview

| Section | Duration | Slides |
|---|---|---|
| Hook & Problem | 2 min | 1–2 |
| Market opportunity | 1.5 min | 3 |
| Solution overview | 1 min | 4 |
| **Live demo** | **8 min** | (phone) |
| Competitive landscape | 1.5 min | 9–10 |
| Business model | 3 min | 11–13 |
| Tech + Roadmap | 2 min | 14–15 |
| Close + Q&A | 1 min | 16 |

---

## Section by section

---

### ⏱ 0:00 — Hook (Slide 1: Cover)

Open with **this line**, don't introduce yourself first:

> *"Last night I needed to make dinner. I had a recipe screenshot from Instagram, a URL bookmarked three months ago, and a vague memory of something my mum used to make. Three different places. Three different apps. Still didn't know what I was eating. That's the problem we solved."*

Then: introduce yourselves, the project name, the brief.

---

### ⏱ 0:45 — The Problem (Slide 2)

Walk through the three problem cards naturally. Don't read them — they're cues.

Key line on problem 3:
> *"Every cooking app shows you a recipe. None of them actually cook with you."*

---

### ⏱ 2:00 — Market (Slide 3)

Keep this fast. Hit only two numbers:
- **$45 billion** market by 2027
- **72% of millennials** try new recipes monthly — that is our user

Then bridge to the solution:
> *"The market is massive, the behaviour is there — but the technology to serve it properly only became available in the last 18 months. GPT-4o and DALL-E 3 are what make Mise possible now."*

---

### ⏱ 3:30 — Solution Overview (Slide 4)

Quick, confident, no deep dive yet:

> *"Mise is an AI cooking companion. Six screens. You can add any recipe in 8 seconds, cook hands-free with voice guidance, and your nutrition is tracked automatically as a side effect of cooking — never manually."*

Then: **pick up the phone**.

---

### ⏱ 4:30 — LIVE DEMO (8 minutes total)

> ⚡ **This is the most important part. Be calm. Talk through what you're doing. If something goes wrong, narrate it — "great, let me show you the fallback."**

---

#### Demo Beat 1 — Recipe Capture (2 min)

**Option A — Chat (easiest, most impressive):**

Tap the **Chat** tab. Type or dictate:
> "Give me a quick pasta carbonara for 2 people"

Watch GPT-4o return a full structured recipe. Tap **Save Recipe**.

Say:
> *"That was 12 seconds. A full recipe — title, servings, ingredients with quantities, step-by-step instructions — extracted and saved to the device. No typing, no searching."*

**Option B — Camera scan (more dramatic, higher risk):**
Have a printed recipe or open a cookbook. Tap the camera icon. Take a clear photo. Show the extraction result.

**Option C — URL paste (safe fallback):**
Paste `https://www.bbcgoodfood.com/recipes/spaghetti-carbonara` (or any recipe URL you tested beforehand).

---

#### Demo Beat 2 — Recipe Detail (1.5 min)

Navigate to the saved recipe. Show:

1. **Hero section** — AI-generated food photo at the top (if background task has completed) OR show the placeholder with "Generating..." as an honest demo of the pipeline
2. **Metadata bar** — prep time, cook time, cuisine, servings
3. **Portion scaler** — tap + / − to scale from 2 to 4 servings, watch ingredients update live
4. **Nutrition panel** — show the AI-estimated macros. Say:
   > *"GPT-4o estimated this while we were looking at the recipe detail. Zero manual input — it just knows from the ingredients."*
5. **"Make it Lighter" button** — tap it, show the AI response summarising changes and calorie delta

---

#### Demo Beat 3 — Cooking Mode (2.5 min)

Tap **Start Cooking**. Show:

1. **Dark immersive UI** — full screen, step 1 of N at the top
2. **TTS** — step is read aloud immediately. Say:
   > *"Your phone is now reading you the recipe. You can put it down and just listen."*
3. **Swipe gesture** — swipe left to advance to step 2. It reads step 2.
4. **Timer** — tap the timer icon, enter "3" minutes, tap Start. Show the countdown ring.
5. **Progress dots** — show how far through the recipe you are
6. Navigate to the last step, tap the checkmark — show the **"All done!" completion screen** with confetti animation.

---

#### Demo Beat 4 — Nutrition Tracker (1.5 min)

Navigate to the **Tracker** tab. Show:

1. **Calorie ring** — today's total vs. goal
2. **Macro bars** — Protein / Carbs / Fat with progress
3. **Today's Meals** — tap "Log Meal" from the recipe detail and then return here to show the entry appear
4. **Goals modal** — tap the gear icon, show that goals are configurable

Say:
> *"This is what MyFitnessPal charges $20 a month for — and it requires you to manually search a food database every single meal. Ours is automatic."*

---

#### Demo Beat 5 — Library & Collections (30 sec)

Quickly show the **Recipes** tab:
- Recipe cards with thumbnails (generated or placeholder)
- Horizontal Collections row
- Search bar

---

### ⏱ 12:30 — Competitive Landscape (Slide 9–10)

Point at the table. Don't read every cell. Key line:

> *"Every competitor solves one of these problems. Paprika has offline storage. MyFitnessPal has nutrition. Yummly has discovery. Nobody combines all five. That's our moat — it's not one feature, it's the integration."*

---

### ⏱ 14:00 — Business Model (Slides 11–13)

Walk through the three tiers:

> *"Free tier drives acquisition — you can save 20 recipes, use basic chat, it feels complete. The upgrade trigger is when you want GPT-4o quality scans and unlimited storage — that's the moment users hit a wall and are already invested in the product."*

On the platform play:
> *"Every saved recipe is a shopping list. The grocery integration in Year 2 turns Mise from a utility into a commerce platform. We earn a commission on every basket."*

Hit the unit economics slide briefly — $1.2M ARR at 15,000 subscribers is a conservative 18-month target.

---

### ⏱ 17:00 — Technology + Roadmap (Slides 14–15)

Keep this brief for a business audience:

> *"The technical decisions are worth 30 seconds: everything lives on-device, so it's fast, private, and works offline. The AI pipeline is non-blocking, so users never wait. And it's one codebase for both platforms, which halves ongoing engineering cost."*

Point at the roadmap:
> *"Watch app, social sharing, meal planning, grocery integration — the foundation we've built supports all of this without architectural changes."*

---

### ⏱ 19:00 — Close (Slide 16)

End on this line:

> *"The kitchen is the last room in your home without an AI assistant. We built one. It's on this phone right now — we'd love to show you anything we didn't get to, or answer questions."*

Hand it over to Q&A.

---

## Q&A Preparation

**"What does it cost to run per user?"**
> OpenAI API cost per recipe save: ~$0.03 (GPT-4o extraction) + ~$0.08 (DALL-E thumbnail) + ~$0.04 (DALL-E 2 illustrations × average 8 steps). Total: ~$0.15 per recipe save. At $6.99/month with a power user saving 10 recipes/month, that's $1.50 cost vs. $6.99 revenue. Very healthy margin.

**"Why not just use ChatGPT?"**
> ChatGPT has no persistence, no offline access, no cooking-specific UX, no nutrition tracking, no shopping list. Mise is a purpose-built product; ChatGPT is a general tool.

**"What about privacy — are my recipes sent to OpenAI?"**
> Only during the extraction step. Once saved, everything lives on-device. We never store or transmit personal data.

**"How do you compete with Google?"**
> Google doesn't have a recipe product. They index recipes for search. We're the post-search layer — where you actually cook.

**"What's the team?"**
> [Answer honestly — this is a capstone project, show the work speaks for the team size.]

**"What would you do with funding?"**
> App Store launch, growth marketing (food TikTok is extremely high-ROI), and the grocery integration API. First $500K gets us to 15K subscribers.

---

## If the demo breaks

| Problem | Recovery |
|---|---|
| No internet on phone | Show screen recording backup. Say: "Let me play the recording while we work on the connection." |
| Expo app crashes | Shake phone → reload. Takes 5 seconds. Keep talking. |
| API key error | Navigate to an already-saved recipe to show the non-AI parts. |
| TTS not speaking | Show the text on screen and manually read it. "The voice narration is there — let me read this one for you." |
| App slow / laggy | Keep talking through the feature. Attribute it to the demo environment. |
