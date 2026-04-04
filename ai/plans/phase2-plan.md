# Phase 2 Plan — Database + Data Layer

## Goal
SQLite schema initialized on app start. Recipes and ingredients can be created, read, updated, and deleted through a clean query layer.

## Approach
- Implement `src/db/schema.js` to create tables on first run using `expo-sqlite` with WAL mode and foreign keys
- Build `src/db/queries.js` with all CRUD functions the app will need — design the API surface now so UI phases just call these functions
- Every query function logs entry, exit, and errors via the structured logger
- Implement `src/utils/scaler.js` for serving size math — simple multiplier, null quantities stay null
- Write a CLI test (`scripts/test-db.js`) using `better-sqlite3` (Node.js-compatible) that exercises every query function

## Key Decisions
- **Two tables: `recipes` and `ingredients`** — normalized schema with foreign key cascade delete. Considered a single denormalized table but ingredients need independent check/uncheck for the shopping list.
- **`better-sqlite3` for CLI testing** — `expo-sqlite` only runs in React Native runtime, so we need a Node.js-compatible SQLite driver for CLI tests. Same SQL, different driver.
- **UUIDs for all IDs** — no auto-increment integers. UUIDs are safer for potential future sync and avoid ID collision issues.
- **`in_list` column on ingredients** — tracks which ingredients are on the shopping list. Added to the schema upfront even though the Shopping List UI comes in Phase 6.

## Success Criteria
- `node scripts/test-db.js` exits 0 with all assertions passing
- Insert, read, update, toggle, delete, and cascade all work
- Scaler handles null quantities correctly
