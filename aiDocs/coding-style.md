# Recipe Scanner — Coding Style Guide

## General Rules
- **JavaScript only** — no TypeScript, no type annotations
- **Functional components only** — no class components
- **No over-engineering** — solve for MVP requirements, not hypothetical future ones
- **No compatibility layers** — write code as if it was always this way
- **No legacy comments** — don't explain what was removed or why something changed
- **No features not in the PRD** — if it's not in `aiDocs/prd.md`, don't build it

## File and Folder Naming
- React components: `PascalCase.jsx` (e.g., `IngredientRow.jsx`)
- Utility/service files: `camelCase.js` (e.g., `openai.js`, `logger.js`)
- Expo Router pages: `lowercase.jsx` or `[param].jsx`
- Constants: `SCREAMING_SNAKE_CASE`

## Component Style
```jsx
// Good — clean functional component
export default function IngredientRow({ ingredient, onEdit, onDelete }) {
  return (
    <View style={styles.row}>
      <Text>{ingredient.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 12 }
});
```

- Props are destructured in the function signature
- StyleSheet.create() for all styles — no inline style objects except for dynamic values
- One component per file

## Service Functions
```js
// Good — explicit input/output, logs entry and exit
export async function parseImageIngredients(base64Image) {
  logger.info('openai.parseImageIngredients', { imageSize: base64Image.length });
  try {
    const result = await callGPT4oVision(base64Image);
    logger.info('openai.parseImageIngredients.success', { count: result.length });
    return result;
  } catch (err) {
    logger.error('openai.parseImageIngredients.error', { error: err.message });
    throw err;
  }
}
```

- Every service function logs on entry and exit
- Errors are logged with `logger.error` before re-throwing
- No silent failures

## Logging Rules
- **Never use `console.log`** in production code — use `logger.info`, `logger.debug`, `logger.warn`, `logger.error`
- Log format: `'service.functionName'` as the action string
- Always include relevant context in the data object (IDs, counts, sizes, error messages)
- `console.log` is only acceptable in `scripts/` CLI files

## Database Access
- All DB reads and writes go through `src/db/queries.js` — never inline SQL elsewhere
- Function names are descriptive: `saveRecipe()`, `getRecipeById()`, `deleteIngredient()`
- Always use parameterized queries — no string interpolation in SQL

## State Management
- Local component state: `useState`
- Shared state across tabs: React Context (keep it simple — one RecipeContext)
- No Redux, no Zustand, no external state libraries

## Error Handling
- All API calls wrapped in try/catch
- User-facing errors shown with `Alert.alert()` — one consistent pattern
- Log the error before showing the alert
- Never swallow errors silently

## ID Generation
- Use `uuid` library: `import { v4 as uuidv4 } from 'uuid'`
- All IDs are UUIDs — no auto-increment integers

## Imports
- Group imports: React/RN first, then Expo, then local
- Use relative imports for local files: `'../utils/logger'` not `'@/utils/logger'`

## CLI Scripts
- Output JSON to stdout on success: `echo '{"status":"pass"}'`
- Output JSON to stderr on failure: `echo '{"status":"fail","error":"..."}' >&2`
- Exit 0 on success, exit 1 on failure, exit 2 on bad usage
- Source `.testEnvVars` at the top of any script that needs API keys

## Comments
- Only comment WHY, never WHAT — the code should explain what it does
- No TODO comments in committed code — put them in the roadmap instead
- No commented-out code — delete it, git has history
