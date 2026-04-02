# Recipe Scanner

Scan printed cookbook recipes with your iPhone camera and send ingredients directly to your Walmart cart.

## What It Does
- **Scan** a recipe with your camera or import from a photo, URL, PDF, or DOCX
- **Review and edit** the extracted ingredient list
- **Scale** servings up or down
- **Save** recipes to your local library
- **Build** a combined shopping list across multiple recipes
- **Send** your list to Walmart with one tap

## Requirements
- Node.js 18+
- Expo CLI (`npm install -g expo`)
- iOS device or simulator (iPhone recommended for camera features)
- OpenAI API key (GPT-4o)
- Walmart Open API credentials

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
export OPENAI_API_KEY="sk-..."
export WALMART_CLIENT_ID="..."
export WALMART_CLIENT_SECRET="..."
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
- [Roadmap](ai/roadmaps/roadmap.md)
