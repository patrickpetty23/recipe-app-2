# Recipe Scanner — Project Context

## What This Is
An iOS mobile app (React Native + Expo) that lets users scan physical cookbook recipes with their camera, import recipes from URLs or files, and automatically generate structured shopping lists — culminating in a one-tap Walmart cart integration.

## Critical Files to Review
- **PRD**: `aiDocs/prd.md` — full product requirements, user stories, and success metrics
- **MVP**: `aiDocs/mvp.md` — scoped feature set for the 6-day build
- **Architecture**: `aiDocs/architecture.md` — file structure, data models, API design, logging
- **Coding Style**: `aiDocs/coding-style.md` — conventions AI must follow
- **Changelog**: `aiDocs/changelog.md` — recent changes and decisions

## Tech Stack
- **Framework**: React Native (Expo SDK 54)
- **Language**: JavaScript (not TypeScript — keep it simple)
- **AI/Parsing**: OpenAI GPT-4o API — recipe extraction, chat, nutrition estimation, recipe lightening
- **Image Generation**: DALL-E 3 (hero thumbnails 1792×1024) + DALL-E 2 (step illustrations, parallel)
- **TTS**: expo-speech — voice-guided cooking mode narration
- **OCR**: GPT-4o Vision directly — no separate OCR library
- **Storage**: SQLite via expo-sqlite v16 (WAL mode, FK cascade) — fully offline
- **Navigation**: Expo Router v6 (file-based)
- **HTTP**: fetch() — no axios
- **Logging**: Custom structured JSON logger (see architecture.md)
- **External API**: Walmart Open API (product search + affiliate cart links)

## Important Notes
- **No user accounts.** Everything is local on device.
- **Android verified.** App tested on Android via Expo Go in addition to iOS.
- **GPT-4o Vision handles OCR.** No separate OCR library — image goes straight to GPT-4o.
- **All scripts return JSON to stdout.** Errors go to stderr. Exit codes are mandatory.
- **Structured logging** is used throughout — never console.log in production code.
- **Secrets live in `.env`** (gitignored). API key is `EXPO_PUBLIC_OPENAI_API_KEY`.
- **AI tasks are non-blocking.** Nutrition estimation, thumbnail generation, and step illustrations all fire in the background after save — user navigates immediately.

## Current Focus
Phase 9 complete — rubric compliance, Android polish, and demo preparation.

The app has expanded significantly beyond the original MVP scope. Five milestones were executed on the `feature/android-polish` branch:
- **Milestone 1–2**: Full schema, queries, OpenAI service, iMessage-style chat tab
- **Milestone 3**: Recipe detail redesign — hero image, gradient, tabs, cooking mode screen
- **Milestone 4**: Editor redesign, Collections in Library, warm colour theme (#FF6B35 orange)
- **Milestone 5**: Nutrition tracking (GPT-4o macros, cook log, Tracker tab), voice cooking (TTS + timers), "Make it Lighter" AI feature
- **Auto-generation**: On every save — DALL-E 3 thumbnail, DALL-E 2 parallel step illustrations, GPT-4o nutrition — all non-blocking background tasks
