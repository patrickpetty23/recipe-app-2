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
Initial project setup — scaffolding Expo project, aiDocs structure, and scripts/ folder.
