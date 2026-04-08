# Recipe Scanner

A full-featured cooking companion app — scan recipes, plan meals, track nutrition, and shop at Walmart, all from your phone.

## What It Does

### Recipe Capture
- **Scan** a recipe with your camera or import from a photo, URL, PDF, or DOCX
- **AI chat** — ask the cooking assistant to identify dishes, answer questions, or create recipes
- **Review and edit** the extracted ingredient list with fraction-based quantities
- **Scale** servings up or down with automatic quantity recalculation

### Recipe Library
- **Save** recipes with AI-generated hero thumbnails (DALL-E 3)
- **Organize** recipes into custom collections with emoji labels
- **Cooking mode** — full-screen step-by-step with TTS voice narration, swipe navigation, and in-context timers
- **Step illustrations** — AI-generated cookbook-style images for each step

### Meal Planning
- **Weekly planner** with breakfast/lunch/dinner/snack slots
- **AI-powered suggestions** — GPT-4o recommends meals from your recipe library based on preferences
- **Per-day calorie and macro tracking** in the planner view

### Nutrition
- **Auto-estimated macros** per recipe via GPT-4o (calories, protein, carbs, fat, fiber)
- **"Make it Lighter"** — AI suggests healthier ingredient substitutions
- **Tracker tab** — daily calorie ring, macro progress bars, cook log, editable goals

### Shopping
- **Combined shopping list** from selected recipes or individual ingredients
- **Check-off** items as you shop with animated strikethrough
- **Walmart integration** — search products, see prices, and send your cart to Walmart with one tap

## Tech Stack
- React Native (Expo SDK 54) — JavaScript, no TypeScript
- OpenAI GPT-4o (recipe extraction, chat, nutrition, meal planning) + DALL-E 3 (image generation)
- SQLite via expo-sqlite v16 (offline-first, 11 tables)
- Expo Router v6 (file-based navigation, 5 tabs)
- expo-speech (TTS cooking narration)
- node-forge (Walmart RSA signing)

## Requirements
- Node.js 18+
- Expo CLI (`npm install -g expo`)
- iOS or Android device / simulator
- OpenAI API key (GPT-4o)
- Walmart Open API credentials (optional — app works without them)

## Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .testEnvVars.example .testEnvVars
# Edit .testEnvVars and add your API keys

# Start the dev server
./scripts/run.sh
```

## Environment Variables
Create a `.testEnvVars` file (gitignored) with:
```bash
export EXPO_PUBLIC_OPENAI_API_KEY="sk-..."
export EXPO_PUBLIC_WALMART_CLIENT_ID="..."
export EXPO_PUBLIC_WALMART_KEY_VERSION="1"
export EXPO_PUBLIC_WALMART_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
export LOG_LEVEL="info"
```

## Scripts
```bash
./scripts/build.sh   # Install deps and verify setup
./scripts/test.sh    # Run test suite
./scripts/run.sh     # Start Expo dev server
```

## Project Docs
- [Product Requirements](aiDocs/prd.md)
- [MVP Scope](aiDocs/mvp.md)
- [Architecture](aiDocs/architecture.md)
- [Coding Style](aiDocs/coding-style.md)
- [Changelog](aiDocs/changelog.md)
- [Roadmap](ai/roadmaps/roadmap.md)
