# Phase 1 Plan — Project Setup

## Goal
Get a runnable Expo app with the full folder structure, dependencies, logging, and CLI scripts in place before writing any feature code.

## Approach
- Use `create-expo-app` for scaffolding — gives us a working app shell immediately
- Set up Expo Router with three tabs matching the PRD navigation: Scan, Library, Shopping List
- Create the `src/` folder hierarchy (services, db, utils, components) so every future phase has a clear home
- Implement the structured JSON logger first — every subsequent phase will import it from day one
- Write the three shell scripts (`build.sh`, `test.sh`, `run.sh`) with proper JSON output and exit codes so we have a consistent test harness from the start
- Set up `.gitignore` to cover secrets (`.testEnvVars`, `.env`) and library folders (`node_modules/`)
- Create `CURSOR.md` with behavioral guidelines so AI sessions stay consistent

## Key Decisions
- **JavaScript, not TypeScript** — faster to write and debug in a short sprint; PRD explicitly scopes this as MVP
- **Expo Router over React Navigation** — file-based routing is simpler for three tabs + one detail screen
- **Custom logger over a logging library** — zero dependencies, structured JSON that AI can parse, stderr/stdout separation built in
- **SQLite over AsyncStorage** — relational structure needed for recipes + ingredients with foreign keys; decided early so the schema drives everything

## Success Criteria
- `./scripts/build.sh` exits 0
- App launches in iOS simulator with three empty tabs
- Logger works: `logger.info('test', { foo: 'bar' })` outputs valid JSON
