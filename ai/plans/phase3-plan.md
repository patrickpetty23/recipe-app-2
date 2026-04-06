# Phase 3 Plan — GPT-4o Integration

## Goal
App can take a base64 image or raw text, send it to GPT-4o, and return a clean `Ingredient[]` array.

## Approach
- Implement `src/services/openai.js` with two functions: `parseImageIngredients` (Vision API) and `parseTextIngredients` (text completion)
- Both use the same system prompt from architecture.md that instructs GPT-4o to return only a JSON array
- Handle all error cases: timeout (AbortController at 30s), auth errors (401), malformed JSON (strip markdown fences), and generic API failures
- Every call logs entry, exit, and errors — this is critical for debugging prompt issues
- Write a CLI test that sends a known 7-ingredient sample recipe and validates the response

## Key Decisions
- **GPT-4o Vision directly for OCR** — no separate OCR library. GPT-4o handles messy cookbook typography, handwriting, and varied layouts in one step. Eliminates a dependency and a processing stage.
- **Strict JSON-only system prompt** — instruct GPT-4o to return "ONLY a JSON array with no markdown, no explanation." This makes parsing reliable. If it still wraps in markdown fences, we strip them.
- **AbortController at 30 seconds** — prevents hanging on slow API responses during demo
- **No streaming** — we need the full JSON response at once to parse it; streaming would complicate parsing for no UX benefit in this context

## Success Criteria
- `node scripts/test-openai.js` exits 0
- Returns valid `Ingredient[]` with name, quantity, unit, notes for all 7 sample ingredients
- Errors are caught and logged, not swallowed
