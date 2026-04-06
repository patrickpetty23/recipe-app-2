import { logger } from '../utils/logger';

const CHAT_API_URL = 'https://api.openai.com/v1/chat/completions';
const FAL_IMAGE_URL = 'https://fal.run/fal-ai/flux/schnell';
const MODEL = 'gpt-4o';
const TIMEOUT_MS = 45000;
const ILLUSTRATION_TIMEOUT_MS = 60000;

// Instructs GPT to return the full recipe structure in one shot.
const RECIPE_SYSTEM_PROMPT = `You are a recipe extraction assistant. Extract the complete recipe from the image or text provided and return ONLY a JSON object — no markdown, no explanation.

Required format:
{
  "title": "Recipe name as a string",
  "servings": <integer or null>,
  "prepTime": "e.g. 15 minutes — string or null",
  "cookTime": "e.g. 30 minutes — string or null",
  "cuisine": "e.g. Italian, American — string or null",
  "ingredients": [
    { "name": "ingredient name", "quantity": <number or null>, "unit": "string or null", "notes": "string or null" }
  ],
  "steps": [
    { "stepNumber": 1, "instruction": "Complete step text." }
  ]
}

Rules:
- Always include realistic quantities and units for every ingredient.
- Write steps as complete, actionable sentences. Aim for 5–12 steps.
- If the image shows a finished dish rather than a written recipe, infer a plausible full recipe.`;

// Instructs GPT to behave as a conversational cooking assistant and return
// structured JSON so the app can branch on recipe vs. answer responses.
const CHAT_SYSTEM_PROMPT = `You are a helpful cooking assistant built into a recipe app. Always respond with a single JSON object only — no markdown, no explanation.

When the user shares or describes a recipe (from an image, pasted text, or URL), return:
{"type":"recipe","message":"<short friendly message>","recipe":{"title":"...","servings":<int or null>,"prepTime":"...","cookTime":"...","cuisine":"...","ingredients":[{"name":"...","quantity":<number or null>,"unit":"...","notes":"..."}],"steps":[{"stepNumber":1,"instruction":"..."}]}}

For any other cooking question, tip, or conversation, return:
{"type":"answer","message":"<your response>"}`;

function getApiKey() {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return key;
}

function getFalApiKey() {
  const key = process.env.EXPO_PUBLIC_FAL_API_KEY || process.env.FAL_API_KEY;
  if (!key) throw new Error('FAL_API_KEY is not set');
  return key;
}

async function falGenerateImage(prompt, imageSize = 'square_hd') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ILLUSTRATION_TIMEOUT_MS);
  try {
    const response = await fetch(FAL_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${getFalApiKey()}`,
      },
      body: JSON.stringify({
        prompt,
        image_size: imageSize,
        num_inference_steps: 4,
        num_images: 1,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`fal.ai API error ${response.status}: ${errBody}`);
    }
    const data = await response.json();
    const url = data?.images?.[0]?.url;
    if (!url) throw new Error('fal.ai returned no image URL');
    return url;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Image generation timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Core HTTP helper ──────────────────────────────────────────────────────────

async function callOpenAI(messages, { jsonMode = false, timeoutMs = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = { model: MODEL, messages, max_tokens: 4096 };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 401) throw new Error('OpenAI API auth error: invalid API key');
      throw new Error(`OpenAI API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    if (!choice) throw new Error('OpenAI returned no choices in response');
    const content = choice.message?.content;
    if (!content) {
      const refusal = choice.message?.refusal;
      throw new Error(refusal || 'OpenAI returned empty response');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// ── Response parsers ──────────────────────────────────────────────────────────

function parseRecipeJson(raw) {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(text);

    if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
      throw new Error('No ingredients array in response');
    }

    return {
      title: typeof parsed.title === 'string' ? parsed.title.trim() || null : null,
      servings: typeof parsed.servings === 'number' ? parsed.servings : null,
      prepTime: typeof parsed.prepTime === 'string' ? parsed.prepTime : null,
      cookTime: typeof parsed.cookTime === 'string' ? parsed.cookTime : null,
      cuisine: typeof parsed.cuisine === 'string' ? parsed.cuisine : null,
      ingredients: parsed.ingredients.map((item) => ({
        name: typeof item.name === 'string' ? item.name : String(item.name ?? ''),
        quantity: typeof item.quantity === 'number' ? item.quantity : null,
        unit: typeof item.unit === 'string' ? item.unit : null,
        notes: typeof item.notes === 'string' ? item.notes : null,
      })),
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s, i) => ({
            stepNumber: typeof s.stepNumber === 'number' ? s.stepNumber : i + 1,
            instruction: typeof s.instruction === 'string' ? s.instruction : String(s.instruction ?? ''),
          }))
        : [],
    };
  } catch (parseErr) {
    logger.error('openai.parseRecipeJson.failed', { preview: raw.slice(0, 300) });
    throw new Error(
      'Could not extract recipe. Make sure the image clearly shows a recipe with ingredients listed.'
    );
  }
}

function parseChatJson(raw) {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(text);
    if (parsed.type !== 'recipe' && parsed.type !== 'answer') {
      // Treat malformed response as a plain answer
      return { type: 'answer', message: text };
    }
    return parsed;
  } catch {
    // GPT occasionally returns plain prose despite the prompt; wrap it
    return { type: 'answer', message: text };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function parseRecipeFromImage(base64Image) {
  logger.info('openai.parseRecipeFromImage', { imageSize: base64Image.length, model: MODEL });
  try {
    const raw = await callOpenAI([
      { role: 'system', content: RECIPE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract the complete recipe from this image. If it shows a finished dish rather than a written recipe, infer the full recipe. Return ONLY the JSON object.',
          },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ]);
    const recipe = parseRecipeJson(raw);
    logger.info('openai.parseRecipeFromImage.success', {
      title: recipe.title,
      ingredientCount: recipe.ingredients.length,
      stepCount: recipe.steps.length,
    });
    return recipe;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('openai.parseRecipeFromImage.timeout', {});
      throw new Error('OpenAI request timed out. Please try again.');
    }
    logger.error('openai.parseRecipeFromImage.error', { error: err.message });
    throw err;
  }
}

export async function parseRecipeFromText(rawText) {
  logger.info('openai.parseRecipeFromText', { textLength: rawText.length, model: MODEL });
  try {
    const raw = await callOpenAI(
      [
        { role: 'system', content: RECIPE_SYSTEM_PROMPT },
        { role: 'user', content: rawText },
      ],
      { jsonMode: true }
    );
    const recipe = parseRecipeJson(raw);
    logger.info('openai.parseRecipeFromText.success', {
      title: recipe.title,
      ingredientCount: recipe.ingredients.length,
      stepCount: recipe.steps.length,
    });
    return recipe;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('openai.parseRecipeFromText.timeout', {});
      throw new Error('OpenAI request timed out. Please try again.');
    }
    logger.error('openai.parseRecipeFromText.error', { error: err.message });
    throw err;
  }
}

// Handles freeform chat: cooking questions, recipe identification from images,
// and pasted recipe text. Returns { type, message, recipe? }.
export async function processChat(messages, imageBase64 = null) {
  logger.info('openai.processChat', { messageCount: messages.length, hasImage: !!imageBase64 });
  try {
    // Build the API messages array, attaching the image to the last user turn
    const apiMessages = messages.map((msg) => ({ role: msg.role, content: msg.content }));

    if (imageBase64 && apiMessages.length > 0) {
      const lastIdx = apiMessages.length - 1;
      if (apiMessages[lastIdx].role === 'user') {
        apiMessages[lastIdx] = {
          role: 'user',
          content: [
            { type: 'text', text: apiMessages[lastIdx].content || 'What is this recipe?' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        };
      }
    }

    const raw = await callOpenAI([
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...apiMessages,
    ]);

    const result = parseChatJson(raw);
    logger.info('openai.processChat.success', { type: result.type });
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('openai.processChat.timeout', {});
      throw new Error('OpenAI request timed out. Please try again.');
    }
    logger.error('openai.processChat.error', { error: err.message });
    throw err;
  }
}

// ── Nutrition estimation ──────────────────────────────────────────────────────

const NUTRITION_SYSTEM_PROMPT = `You are a professional nutritionist. Given a list of recipe ingredients and the number of servings, estimate the nutritional content per serving. Return ONLY a JSON object — no markdown, no explanation.

Required format:
{
  "calories": <integer per serving>,
  "protein": <grams per serving, number>,
  "carbs": <grams per serving, number>,
  "fat": <grams per serving, number>,
  "fiber": <grams per serving, number>
}

Be realistic. Use standard USDA nutritional values as a reference. Round to the nearest whole number for calories and one decimal place for macros.`;

export async function estimateNutrition(ingredients, servings) {
  logger.info('openai.estimateNutrition', { ingredientCount: ingredients.length, servings });
  try {
    const ingredientList = ingredients
      .map((i) => {
        const qty = i.quantity != null ? String(i.quantity) : '';
        const unit = i.unit ? ` ${i.unit}` : '';
        return `- ${qty}${unit} ${i.name}`.trim();
      })
      .join('\n');

    const raw = await callOpenAI(
      [
        { role: 'system', content: NUTRITION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Recipe makes ${servings} serving${servings !== 1 ? 's' : ''}.\n\nIngredients:\n${ingredientList}`,
        },
      ],
      { jsonMode: true }
    );

    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    const parsed = JSON.parse(text);

    const result = {
      calories: typeof parsed.calories === 'number' ? Math.round(parsed.calories) : null,
      protein: typeof parsed.protein === 'number' ? Math.round(parsed.protein * 10) / 10 : null,
      carbs: typeof parsed.carbs === 'number' ? Math.round(parsed.carbs * 10) / 10 : null,
      fat: typeof parsed.fat === 'number' ? Math.round(parsed.fat * 10) / 10 : null,
      fiber: typeof parsed.fiber === 'number' ? Math.round(parsed.fiber * 10) / 10 : null,
    };
    logger.info('openai.estimateNutrition.success', { calories: result.calories });
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('openai.estimateNutrition.timeout', {});
      throw new Error('Nutrition estimation timed out.');
    }
    logger.error('openai.estimateNutrition.error', { error: err.message });
    throw err;
  }
}

// ── Recipe lightener ──────────────────────────────────────────────────────────

const LIGHTEN_SYSTEM_PROMPT = `You are a culinary nutritionist who specialises in making recipes healthier while preserving their flavour and character. Given a recipe, suggest ingredient substitutions that reduce calories and fat without sacrificing taste.

Return ONLY a JSON object — no markdown, no explanation:
{
  "recipe": { <same full recipe structure as input, with substitutions applied> },
  "changes": [ "Replaced sour cream with Greek yogurt (-120 cal)", "Reduced butter from 4 tbsp to 1 tbsp (-300 cal)" ],
  "originalCalories": <estimated original calories per serving>,
  "lightenedCalories": <estimated lightened calories per serving>
}`;

export async function lightenRecipe(recipe) {
  logger.info('openai.lightenRecipe', { title: recipe.title });
  try {
    const raw = await callOpenAI(
      [
        { role: 'system', content: LIGHTEN_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(recipe) },
      ],
      { jsonMode: true, timeoutMs: TIMEOUT_MS }
    );

    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    const parsed = JSON.parse(text);

    logger.info('openai.lightenRecipe.success', {
      title: recipe.title,
      changes: parsed.changes?.length ?? 0,
      calorieDelta: (parsed.originalCalories ?? 0) - (parsed.lightenedCalories ?? 0),
    });
    return parsed;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('openai.lightenRecipe.timeout', {});
      throw new Error('Request timed out. Please try again.');
    }
    logger.error('openai.lightenRecipe.error', { error: err.message });
    throw err;
  }
}

// Generates a minimalist flat cookbook illustration for a recipe step via fal.ai FLUX.
export async function generateStepIllustration(stepText, recipeTitle) {
  logger.info('openai.generateStepIllustration', {
    recipeTitle,
    stepPreview: stepText.slice(0, 60),
  });
  const prompt =
    `Minimalist flat 2D cookbook illustration. Recipe: "${recipeTitle}". ` +
    `Step: "${stepText}". ` +
    `Style: clean line art, soft pastel colors, simple geometric shapes, ` +
    `no text or labels, white background, professional cookbook aesthetic.`;
  try {
    const url = await falGenerateImage(prompt, 'square_hd');
    logger.info('openai.generateStepIllustration.success', { recipeTitle });
    return url;
  } catch (err) {
    logger.error('openai.generateStepIllustration.error', { error: err.message });
    throw err;
  }
}

// Fires all step illustrations in parallel via fal.ai FLUX.
// Returns [{stepId, url}] for every step that succeeded; failures are silently skipped.
export async function generateAllStepIllustrations(steps, recipeTitle) {
  logger.info('openai.generateAllStepIllustrations', { recipeTitle, stepCount: steps.length });
  const settled = await Promise.allSettled(
    steps.map((step) => {
      const prompt =
        `Minimalist flat 2D cookbook illustration. Recipe: "${recipeTitle}". ` +
        `Step: "${step.instruction}". ` +
        `Style: clean line art, soft pastel colors, simple geometric shapes, ` +
        `no text or labels, white background, professional cookbook aesthetic.`;
      return falGenerateImage(prompt, 'square_hd').then((url) => ({ stepId: step.id, url }));
    })
  );
  const fulfilled = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  logger.info('openai.generateAllStepIllustrations.done', {
    total: steps.length,
    succeeded: fulfilled.length,
  });
  return fulfilled;
}

// ── Recipe thumbnail (fal.ai FLUX, landscape) ─────────────────────────────────

// Generates a food-photography-style hero thumbnail for a recipe.
export async function generateRecipeThumbnail(title, cuisine, ingredients) {
  logger.info('openai.generateRecipeThumbnail', { title });

  const ingredientSnippet = (ingredients ?? [])
    .slice(0, 5)
    .map((i) => i.name)
    .join(', ');

  const prompt =
    `Beautifully plated, professionally photographed dish of "${title}". ` +
    (cuisine ? `${cuisine} cuisine. ` : '') +
    (ingredientSnippet ? `Key ingredients: ${ingredientSnippet}. ` : '') +
    `Warm studio lighting, shallow depth of field, clean white plate or rustic wooden surface, ` +
    `restaurant-quality presentation. No text, no watermarks.`;

  try {
    const url = await falGenerateImage(prompt, 'landscape_16_9');
    logger.info('openai.generateRecipeThumbnail.success', { title });
    return url;
  } catch (err) {
    logger.error('openai.generateRecipeThumbnail.error', { error: err.message });
    throw err;
  }
}
