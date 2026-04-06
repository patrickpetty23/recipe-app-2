# Phase 3 Plan — GPT-4o Integration

## Intent
Build a reliable, error-tolerant OpenAI service layer that converts both images and raw text into structured ingredient arrays. This is the core intelligence of the app — everything else is UI around it.

## Approach
Two entry points: `parseImageIngredients(base64Image)` for Vision and `parseTextIngredients(rawText)` for scraped/extracted content. Both funnel into the same response parser so formatting inconsistencies are handled once.

The system prompt is the most important decision in this phase. It must instruct GPT-4o to return only valid JSON with no markdown fences, no explanation, and a specific schema. Tested against 5 real recipes before moving on.

Use `AbortController` with a 30-second timeout on all calls. GPT-4o can occasionally take 20+ seconds — without a timeout, users would wait indefinitely with no feedback.

## Key Decisions Made
- **GPT-4o Vision directly for OCR**: Considered using a dedicated OCR library (Tesseract, expo-camera text recognition) first, then sending text to GPT-4o. Rejected this approach because: (1) cookbook fonts and layouts are highly varied, (2) a two-step pipeline doubles the failure surface, (3) GPT-4o Vision handles context that OCR misses (e.g., recognising "1½" as a fraction, inferring units from context).
- **JSON mode not enforced at API level**: GPT-4o's `response_format: { type: "json_object" }` helps but doesn't guarantee the schema matches. Added a post-parse validation step that strips markdown fences and re-parses if the model wraps output in backticks.
- **Errors logged before re-throwing**: Callers don't need to know about the logger — they just catch errors. But every error produces a structured log entry so we can diagnose failures in the field.
- **Single system prompt for both paths**: Image and text extraction use the same prompt structure. Reduces surface area for prompt divergence.

## Risks Identified
- GPT-4o may return extra fields or nest ingredients inside a wrapper object. Mitigation: defensive parsing that walks the response looking for the array.
- Rate limits: GPT-4o has per-minute token limits. For a demo with one user this is not a concern, but noted for scale.
- Cost: each Vision call with a cookbook photo is approximately $0.03. Acceptable for demo volume.
