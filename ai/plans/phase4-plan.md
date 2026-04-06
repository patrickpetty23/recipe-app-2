# Phase 4 Plan — Import Methods

## Goal
All four input methods (camera, photo library, URL, file) work and produce a structured ingredient list that lands on the same editor screen.

## Approach
- Build all four import paths in `app/(tabs)/index.jsx` (the Scan tab):
  1. **Camera**: `expo-camera` to capture → convert to base64 → `parseImageIngredients`
  2. **Photo library**: `expo-image-picker` → base64 → `parseImageIngredients`
  3. **URL**: text input → `src/services/scraper.js` fetches and strips HTML → `parseTextIngredients`
  4. **PDF/DOCX**: `expo-document-picker` → `src/services/fileParser.js` extracts text → `parseTextIngredients`
- Implement `scraper.js` — fetch URL, strip `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>` tags via regex, return cleaned text
- Implement `fileParser.js` — PDF text extraction via parenthesis-operator regex on binary; DOCX via JSZip to extract `word/document.xml`
- Create `app/recipe/editor.jsx` — the shared destination for all import paths. Receives ingredients via Expo Router params (JSON-serialized).
- Show loading spinners during processing; show error alerts on failure

## Key Decisions
- **Regex-based HTML stripping over a full DOM parser** — lighter weight, no extra dependency. GPT-4o can handle imperfect text cleanup.
- **JSZip for DOCX** — DOCX files are ZIP archives. Extract `word/document.xml` and strip XML tags for raw text.
- **All four paths converge on one editor screen** — avoids building separate flows. The editor doesn't care how the ingredients arrived.
- **JSON-serialized params via Expo Router** — pass the full ingredient array as a URL param. Works within Expo Router's string-based param system.

## Success Criteria
- Each import method reaches the editor screen with a parsed ingredient list
- Loading spinner visible during GPT-4o processing
- Errors show user-facing alerts (not silent failures)
