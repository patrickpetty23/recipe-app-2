# Mise — Executive Summary

**One-page overview for judges and evaluators.**

---

## What is it?

**Mise** is an AI-powered cooking companion mobile app (iOS & Android) that solves three problems simultaneously: fragmented recipe storage, zero-effort nutrition tracking, and the stress of cooking alone without guidance.

A user can capture any recipe — photograph a cookbook, paste a URL, or ask the AI to invent one — in under 10 seconds. The app then generates a professional food photograph, writes step-by-step cooking illustrations, estimates macronutrients, and guides the user through the cooking process with voice narration and countdown timers. All automatically.

---

## The Problem

| Problem | Current user behaviour |
|---|---|
| Recipes are scattered | Screenshots, bookmarks, handwritten notes across 5+ apps |
| Nutrition tracking is abandoned | 80% of calorie-tracker users quit within a month (manual entry is tedious) |
| Cooking alone is stressful | Constant phone-glancing, lost steps, forgotten timers |

---

## The Solution — 6 Screens, Full Workflow

| Screen | Function |
|---|---|
| **Chat** | iMessage-style AI assistant — capture recipes from photos, URLs, or conversation |
| **Recipes (Library)** | Full recipe library with AI-generated thumbnails, collections, search |
| **Recipe Detail** | Scaled ingredients, auto-estimated nutrition, "Make it Lighter" AI tool |
| **Cooking Mode** | Immersive step-by-step, TTS voice narration, swipe gestures, countdown timers |
| **Shopping List** | Auto-populated from any recipe, Walmart product integration |
| **Tracker** | Daily calorie ring, macro progress bars, meal log, personalised goals |

---

## Technical Highlights

- **GPT-4o** for recipe extraction, conversational chat, nutrition estimation, and healthier-recipe generation
- **DALL-E 3** for hero food photography thumbnails (1792×1024, landscape)
- **DALL-E 2** for step illustrations — fired in parallel across all steps simultaneously for speed
- **expo-sqlite** (WAL mode) — fully offline, all data on-device, instant load times
- **Non-blocking AI pipeline** — saving a recipe is instant; AI tasks complete in background
- **React Native / Expo SDK 54** — single codebase ships iOS + Android simultaneously
- **expo-speech** for text-to-speech step narration in cooking mode

---

## Market Opportunity

- Global recipe & meal planning app market: **$45B by 2027** (CAGR 9.7%)
- Adjacent nutrition/health app market: **$8.4B**
- 72% of millennials try new recipes monthly
- 65% of smartphone owners use their phone while cooking

---

## Business Model

| Tier | Price | Key features |
|---|---|---|
| Free | $0 | 20 recipes, basic chat (GPT-3.5), shopping list |
| **Pro** | **$6.99/month** | Unlimited recipes, GPT-4o, nutrition, voice cooking, AI visuals |
| Platform (Y2+) | B2B / rev-share | Grocery integration, white-label for meal kit brands |

**Unit economics (Pro):** ~$0.15 API cost per active recipe save. At 10 saves/month = $1.50 cost vs. $6.99 revenue = **78% gross margin**.

Target: 15,000 Pro subscribers in 18 months = **$1.26M ARR**.

---

## Competitive Advantage

No competitor combines all five capabilities in a single product:

| | AI Capture | Voice Cooking | Auto Nutrition | AI Visuals | Offline |
|---|---|---|---|---|---|
| **Mise** | ✅ | ✅ | ✅ | ✅ | ✅ |
| Paprika | ❌ | ❌ | ❌ | ❌ | ✅ |
| Yummly | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ |
| MyFitnessPal | ❌ | ❌ | ✅ | ❌ | ⚠️ |

The moat is **integration** — individually, each feature could be replicated. Together, they create a switching cost that competitors would need 2–3 years to match.

---

## Status

- ✅ Full working prototype on Android (live demo available)
- ✅ All five AI features functional (recipe extraction, nutrition, thumbnails, illustrations, lightening)
- ✅ Voice cooking mode with TTS + timers
- ✅ Nutrition tracker with personalised goals
- ✅ Offline-first SQLite database with full migration history
- ✅ Codebase on GitHub (`feature/android-polish` branch)

---

## Team

[Add team names, roles, and any relevant background here.]

---

*"The kitchen is the last room in your home without an AI assistant."*
