# Project Instructions

## Context
Read the project context file first: aiDocs/context.md

## Required Reading Before Any Task
- `aiDocs/context.md` — project overview and tech stack
- `aiDocs/prd.md` — what we're building and why
- `aiDocs/architecture.md` — file structure, data models, logging
- `aiDocs/coding-style.md` — conventions you must follow

## Behavioral Guidelines
- Ask for opinion before making architectural decisions or changes not in the roadmap
- Do not add features not defined in `aiDocs/prd.md`
- This is MVP only — keep solutions simple and focused
- Do not over-engineer — we can add complexity later
- Change code as if it was always this way — no compatibility layers, no legacy comments
- Do not add TODO comments to committed code — put them in the roadmap instead

## Testing
- After implementing any phase, run `./scripts/test.sh`
- If tests fail, analyze the JSON output, fix the issue, and run again
- Continue the fix loop until exit code is 0

## Logging
- Never use `console.log` in production code
- Always use the structured logger: `import { logger } from '../utils/logger'`
- Log entry and exit for every service function

## Secrets
- API keys are in `.testEnvVars` — source it with `source .testEnvVars` before testing
- Never hardcode API keys or commit them
