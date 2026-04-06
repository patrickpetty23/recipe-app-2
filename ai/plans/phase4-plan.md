# Phase 4 Plan — Import Methods

## Intent
Wire all four recipe import paths (camera, photo library, URL, file) to the GPT-4o service and land them on a unified editor screen. Users should have the same experience regardless of how they got their recipe into the app.

## Approach
All four methods produce a raw input (image base64 or text string), pass it to the appropriate openai.js function, and navigate to `app/recipe/editor.jsx` with the structured result as Expo Router params. The editor is the single destination — import method is irrelevant once parsing is done.

URL scraping requires stripping HTML noise before sending to GPT-4o. A lightweight regex-based approach strips `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>` tags. The GPT-4o prompt handles any remaining noise gracefully.

PDF/DOCX parsing uses `expo-document-picker` + `expo-file-system` to get the file, then extracts text. PDFs are notoriously inconsistent — the approach is "extract whatever text is there and let GPT-4o clean it up."

## Key Decisions Made
- **Single editor screen for all methods**: Considered having method-specific screens but rejected it. Code duplication grows fast and testing becomes harder. One editor, four entry points.
- **URL as primary method**: After initial testing, URL import was faster and more reliable than camera scan for modern recipes. Camera scan is still important for cookbooks. Both are first-class.
- **No preview step between capture and editor**: Considered showing a raw ingredient list for confirmation before editing. Rejected — adds a tap and a screen. Users can edit directly in the editor.
- **Loading spinner during GPT-4o call**: The 5–15 second wait needs visual feedback. Simple ActivityIndicator with a label ("Reading recipe...") is sufficient.
- **Error handling with retry**: If GPT-4o fails, show an Alert with the error message and offer to try again. Don't drop the user back to the home screen without context.

## Risks Identified
- Some recipe URLs use heavy JavaScript rendering (React, Next.js) that `fetch()` can't execute. Mitigation: if scraping returns empty/short text, fall back to showing a text input for manual paste.
- PDF text extraction via regex is fragile. Mitigation: GPT-4o is tolerant of messy input — "Do your best" is a valid fallback.
- Camera permissions: must request at runtime on both platforms with a clear explanation of why.
