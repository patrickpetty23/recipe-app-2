# Phase 9 Plan — Rubric Compliance + Final Submission

## Goal
Every graded rubric criterion is addressed, evidenced in the repository, and visible to graders. All process artifacts are living documents that reflect the actual project. App is demo-ready on a real iPhone by April 7.

## Approach

### Casey's Technical Domain

**9A — PRD & Document-Driven Development**
- Add version history to the PRD showing how the spec evolved across phases (v1.0–v1.3)
- Expand the PRD problem statement with a "What we learned through building" section — real lessons, not aspirations
- Confirm all mvp.md checkboxes are checked and match what was actually delivered
- Create per-phase plan docs in `ai/plans/` for every phase (phase1 through phase9) — captures intent, approach, and key decisions before implementation, demonstrating plan-first workflow
- Update all aiDocs to reflect current project state: context.md focus, architecture.md structure, PRD risk outcomes

**9B — AI Development Infrastructure**
- Update `context.md` current focus section to reflect Phase 9
- Verify `ai/` folder is committed and visible (graders must see roadmaps, plans, changelogs)
- Convert `CURSOR.md` behavioral guidance to `.cursorrules` and remove from `.gitignore` so graders can see it
- Add all required secrets patterns to `.gitignore`: `.env`, `.testEnvVars`, MCP config files
- Audit git history for any committed secrets (scan for `sk-`, API key patterns)

**9C — Phase-by-Phase Implementation & Working Demo**
- Verify all roadmap phase checkboxes are checked and accurate
- Run full end-to-end flow on real iPhone — no crashes, no awkward pauses
- Record a short backup demo video as insurance for presentation day

**9D — Structured Logging & Debugging**
- Audit every `src/services/*.js` and `src/db/*.js` file for logger import and usage
- Confirm zero `console.log` outside of `logger.js` itself
- Document three test-log-fix loops in changelog: the `crypto` module error, the Walmart cart URL format discovery, and the `better-sqlite3` version mismatch
- Confirm all CLI test scripts output JSON to stdout, errors to stderr, exit codes 0/1

### Jason's Product Domain

**9E — System Understanding**
- Create an updated system diagram committed to `aiDocs/` — shows iPhone app, GPT-4o API, Walmart Open API, SQLite, and Expo Router tabs with data flow between them
- Document what was wrong or unseen at midterm: discovered that the Walmart affiliate cart URL format differs from API documentation; discovered that GPT-4o Vision handles OCR better than a dedicated OCR library; discovered that modal-based import selection is significantly clearer than a four-button layout

**9F — Problem Identification**
- Sharpen the problem statement based on what building revealed
- Document falsification test results in structured format: hypothesis → test method → participants → result → conclusion
- Key test: "We hypothesized camera scanning would be the primary import method. Testing with early users showed URL import was preferred for online recipes; camera scanning preferred for physical cookbooks only."

**9G — Customer Focus**
- Document customer research in `aiDocs/customer-research.md` — capture interview notes with target users beyond friends and family (people who cook from cookbooks and shop at Walmart)
- Update competitive analysis: Paprika, Mealime, AnyList — none have direct one-tap Walmart cart integration
- Document what customers actually said vs. what was assumed before building

**9H — Success & Failure Planning**
- Test each PRD success metric against reality and report actual numbers:
  - Time from scan to structured list (measure it, report median)
  - Ingredient identification accuracy (test 3+ recipes, count correct vs. total)
  - Walmart integration: confirm "Send to Walmart" opens populated cart
  - Full demo flow: confirm no crashes across the full walkthrough
- Update PRD with actual measured outcomes in the success metrics table

**9I — Customer Interaction**
- Document the feedback loop that produced real changes: engage → learn → change → re-engage
- Point to specific features shaped by user feedback: modal import selector (replaced four-button layout after UX confusion feedback), URL import as primary method (users preferred it over camera for online recipes), product name/price shown before bulk cart send (users didn't trust blind cart additions)

### Presentation Prep

**9J — Presentation Materials**
- Build slide deck covering: midterm-to-final journey, system diagram, process narrative, demo integration, honest reflection
- Do not re-present midterm — start from where midterm left off
- Plan live demo segment with a known-good recipe URL and a backup photo of a printed cookbook page
- Prepare Q&A talking points: why SQLite over cloud storage, why GPT-4o over a dedicated OCR library, why Walmart specifically, what we would do differently

## Key Decisions

- **Rubric-driven phase** — Phase 9 is explicitly about making the process visible, not adding features. Every task produces a committed artifact or a checked-off demo milestone.
- **Customer research document separate from PRD** — the PRD captures product decisions; a dedicated research doc captures raw interview notes and synthesis. Keeps the PRD readable while making the evidence visible.
- **System diagram as a committed file** — committing the diagram (not just embedding in slides) means graders can see it in the repo without waiting for the presentation.
- **Backup demo video committed to repo** — keeps the video version-controlled alongside the code, makes the April 7 deadline unambiguous.

## Success Criteria

- All `aiDocs/` files current and reflect the actual delivered product
- `ai/` folder committed with roadmaps, all 9 phase plans, and changelog visible
- `aiDocs/system-diagram.png` (or equivalent) committed
- `aiDocs/customer-research.md` committed with interview notes
- Falsification test results documented in PRD or changelog
- PRD success metrics table updated with actual measured results
- No secrets in repo (`git log -p` shows no API keys)
- `./scripts/build.sh` exits 0
- `./scripts/test.sh` exits 0
- App runs end-to-end on real iPhone without crashes
- Slide deck committed before April 7 at 23:59
