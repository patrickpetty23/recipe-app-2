# Phase 1 Plan — Project Setup

## Intent
Establish a working Expo project with the correct folder structure, dependencies, logging infrastructure, and CI scripts before writing any product code. A clean foundation prevents structural debt from accumulating across the sprint.

## Approach
Use `npx create-expo-app` with the blank template, then immediately restructure folders to match the architecture defined in `aiDocs/architecture.md`. Install all dependencies upfront so we don't interrupt flow mid-phase to add packages.

Three-tab structure chosen at setup time (Scan, Library, Shopping List) because we know the full navigation graph from the PRD. Expo Router's file-based routing makes tab setup near-zero cost.

Logger is implemented first (before any service code) because every subsequent service function will need it. A structured JSON logger that outputs to stdout/stderr lets us grep logs programmatically and keeps the format consistent for the rubric requirement.

## Key Decisions Made
- **Expo Router over React Navigation**: File-based routing eliminates a separate navigator config file. Tab screens are just files in `app/(tabs)/`. Much less boilerplate for a 6-day sprint.
- **JavaScript not TypeScript**: Type annotations slow down rapid iteration and the AI pair-programming tools generate cleaner JS without TS noise. Not a long-term decision — this is MVP scope.
- **Custom logger over a library**: `console.log` is the default but produces unstructured output. A 20-line custom logger that wraps it with level/timestamp/action is zero-dependency and satisfies the rubric's structured-logging requirement.
- **Scripts committed to repo**: `build.sh`, `test.sh`, `run.sh` — these make the grader's job easy and demonstrate DevOps awareness. They must exit 0/1 with JSON output.
- **`ai/` folder tracked, not gitignored**: Planning artifacts (roadmaps, plans, changelogs) are part of the deliverable and should be visible to graders.

## Risks Identified
- Expo SDK version compatibility: using the latest SDK risks breaking changes. Mitigation: use the specific SDK version recommended by the rubric environment.
- `.gitignore` setup: must ensure `.env` and `.testEnvVars` are excluded from day one to prevent accidental key commits.
