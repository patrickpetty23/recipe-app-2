# Phase 2 Plan — Database + Data Layer

## Intent
Build the persistence layer before any UI or API work. Recipes and ingredients need a relational home before we can meaningfully test extraction or editing. Getting the schema right now means we don't have to migrate a live database mid-sprint.

## Approach
Use `expo-sqlite` with WAL (Write-Ahead Logging) mode for better concurrent read performance. Enable foreign keys explicitly — SQLite disables them by default, which would silently allow orphaned ingredient rows after recipe deletion.

All database access goes through `src/db/queries.js` — no inline SQL anywhere else in the codebase. This centralises the schema contract and makes the code easy to audit for SQL injection.

Write a CLI test script (`scripts/test-db.js`) using `better-sqlite3` (a Node.js SQLite library) so we can test the data layer without needing a running Expo app. This satisfies the rubric's test-script requirement and gives fast feedback during development.

## Key Decisions Made
- **SQLite over AsyncStorage**: Recipes have a relational structure (recipe → ingredients, 1:N). AsyncStorage stores JSON blobs — you'd have to manually manage joins and cascade deletes. SQLite handles this cleanly.
- **WAL mode**: Default journal mode causes write locks that can make the app feel choppy during saves. WAL allows simultaneous reads and writes.
- **Parameterised queries everywhere**: String interpolation in SQL is an injection risk. All queries use `?` placeholders, even in a local app — it's a habit worth keeping.
- **`scaler.js` in this phase**: Serving size scaling is pure math with no dependencies. Implementing it now means the editor (Phase 5) can use it immediately without blocking.
- **UUID for all IDs**: Auto-increment integers leak record counts and make merge/sync harder in future. UUIDs are the correct default even for a local app.

## Risks Identified
- SQLite schema migrations: the simplest approach for MVP is to drop and recreate tables on schema changes. This is acceptable during development but would be unacceptable in a shipped app with user data. Plan: document this limitation and add proper migration guards before demo day.
- Foreign key cascade on iOS vs Android: SQLite behaviour is consistent across platforms when FKs are explicitly enabled — verify this in testing.
