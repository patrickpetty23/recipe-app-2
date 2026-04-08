# Recipe Scanner — Project Context

## What This Is
An iOS mobile app (React Native + Expo) that lets users scan physical cookbook recipes with their camera, import recipes from URLs or files, and automatically generate structured shopping lists — culminating in a one-tap Walmart cart integration.

## Critical Files to Review
- **PRD**: `aiDocs/prd.md` — full product requirements, user stories, success metrics, and version history showing how the spec evolved
- **MVP**: `aiDocs/mvp.md` — scoped feature set for the build; all checkboxes checked as of Phase 8
- **Architecture**: `aiDocs/architecture.md` — file structure, data models, API design, logging patterns
- **Coding Style**: `aiDocs/coding-style.md` — conventions AI must follow (logging rules, error handling, file naming)
- **Changelog**: `aiDocs/changelog.md` — day-by-day record of what changed and why
- **Roadmap**: `ai/roadmaps/roadmap.md` — phase-by-phase checklist with completion tracking
- **Plans**: `ai/plans/phase1-plan.md` through `phase9-plan.md` — intent, approach, and key decisions for each phase before implementation
- **README**: `README.md` — setup instructions and feature overview

## Tech Stack
- **Framework**: React Native (Expo SDK 54)
- **Language**: JavaScript (not TypeScript — keep it simple)
- **AI/Parsing**: OpenAI GPT-4o API — recipe extraction, chat, nutrition estimation, recipe lightening, meal planning
- **Image Generation**: DALL-E 3 (hero thumbnails 1792×1024 + step illustrations 1024×1024)
- **TTS**: expo-speech — voice-guided cooking mode narration
- **OCR**: GPT-4o Vision directly — no separate OCR library
- **Storage**: SQLite via expo-sqlite v16 (WAL mode, FK cascade) — fully offline
- **Navigation**: Expo Router v6 (file-based)
- **HTTP**: fetch() — no axios
- **Logging**: Custom structured JSON logger (see architecture.md)
- **External API**: Walmart Open API (product search + affiliate cart links)

## Important Notes
- **No user accounts.** Everything is local on device.
- **Android + iOS verified.** App tested on both platforms via Expo Go. iOS safe area handling uses `useSafeAreaInsets` throughout.
- **GPT-4o Vision handles OCR.** No separate OCR library — image goes straight to GPT-4o.
- **All scripts return JSON to stdout.** Errors go to stderr. Exit codes are mandatory.
- **Structured logging** is used throughout — never console.log in production code.
- **Secrets live in `.testEnvVars`** (gitignored). Use `source .testEnvVars` before running scripts. All keys use the `EXPO_PUBLIC_` prefix so they're accessible in React Native.
- **AI tasks are non-blocking.** Nutrition estimation, thumbnail generation, and step illustrations all fire in the background after save — user navigates immediately.

## Current Focus
Phase 9 complete. Post-phase polish and new Meal Planner feature added on Day 10 (April 6).

The app has expanded significantly beyond the original MVP scope:
- **Milestone 1–2**: Full schema, queries, OpenAI service, iMessage-style chat tab
- **Milestone 3**: Recipe detail redesign — hero image, gradient, tabs, cooking mode screen
- **Milestone 4**: Editor redesign, Collections in Library, warm colour theme (#FF6B35 orange)
- **Milestone 5**: Nutrition tracking (GPT-4o macros, cook log, Tracker tab), voice cooking (TTS + timers), "Make it Lighter" AI feature
- **Meal Planner**: AI-powered weekly meal planning tab — GPT-4o suggests meals from user's library, calendar view, per-day macro tracking
- **Auto-generation**: On every save — DALL-E 3 thumbnail, DALL-E 3 step illustrations, GPT-4o nutrition — all non-blocking background tasks
- **iOS polish**: Safe area insets on all screens, cross-platform tab bar sizing, memory leak fixes
