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
- **Plans**: `ai/plans/phase1-plan.md` through `phase8-plan.md` — intent, approach, and key decisions for each phase before implementation

## Tech Stack
- **Framework**: React Native (Expo SDK 51+)
- **Language**: JavaScript (not TypeScript — keep it simple)
- **AI/Parsing**: OpenAI GPT-4o API — ingredient extraction and cleanup
- **OCR**: Expo Camera + Vision (device-native) for image capture; raw image passed to GPT-4o Vision
- **Storage**: AsyncStorage (app state) + SQLite via expo-sqlite (recipe library)
- **Navigation**: Expo Router (file-based)
- **HTTP**: fetch() — no axios
- **Logging**: Custom structured JSON logger (see architecture.md)
- **External API**: Walmart Open API (product search + affiliate cart links)

## Important Notes
- **No user accounts.** Everything is local on device.
- **No Android testing.** Expo handles cross-platform but we only verify on iOS.
- **No unit conversion database.** Raw recipe amounts are shown as-is.
- **GPT-4o Vision handles OCR.** We do NOT use a separate OCR library — the image goes straight to GPT-4o which extracts and cleans ingredients in one step.
- **All scripts return JSON to stdout.** Errors go to stderr. Exit codes are mandatory.
- **Structured logging** is used throughout — never console.log in production code.
- **Secrets live in `.testEnvVars`** (gitignored). Never hardcode API keys.

## Current Focus
Phase 9 — rubric compliance and final submission prep. All core features (Phases 1–8) are implemented and working: camera/photo/URL/file import, ingredient editor with scaling, recipe library, shopping list with check-off, and Walmart product search + cart integration. Now finalizing documentation, creating per-phase plan artifacts, and preparing for the April 7 demo.
