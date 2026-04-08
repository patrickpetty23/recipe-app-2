import { logger } from '../utils/logger';
import { parseFraction } from '../utils/scaler';

const CHAT_API_URL = 'https://api.openai.com/v1/chat/completions';
const IMAGE_API_URL = 'https://api.openai.com/v1/images/generations';
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
    { "name": "ingredient name", "quantity": <number, fraction string like "3/4" or "1 1/2", or null>, "unit": "string or null", "notes": "string or null" }
  ],
  "steps": [
    { "stepNumber": 1, "instruction": "Complete step text." }
  ]
}

Rules:
- Always include realistic quantities and units for every ingredient.
- Write steps as complete, actionable sentences. Aim for 5–12 steps.
- If the image shows a finished dish rather than a written recipe, infer a plausible full recipe.`;

// Instructs GPT to behave as a conversational cooking assistant and full app agent,
// returning structured JSON so the app can branch on recipe / answer / action responses.
function buildChatSystemPrompt(appContext = null) {
  const base = `You are Mise, an AI cooking assistant and full app agent built into a recipe and meal-planning app. Always respond with a single JSON object only — no markdown, no explanation.

RESPONSE TYPES:

1. Recipe extraction — when the user shares or describes a recipe (image, URL, text):
{"type":"recipe","message":"<short friendly message>","recipe":{"title":"...","servings":<int or null>,"prepTime":"...","cookTime":"...","cuisine":"...","ingredients":[{"name":"...","quantity":<number or fraction string or null>,"unit":"...","notes":"..."}],"steps":[{"stepNumber":1,"instruction":"..."}]}}

2. General cooking answer — facts, tips, substitutions, technique help, ingredient questions, or any question answerable in text:
{"type":"answer","message":"<your response — can be multi-line, use \\n for line breaks>"}

3. App actions — navigation or in-app operations:
{"type":"action","action":"open_planner","message":"<friendly confirmation>"}
{"type":"action","action":"open_planner_ai","message":"<friendly confirmation>"}
{"type":"action","action":"open_tab","tab":"list","message":"<friendly confirmation>"}
{"type":"action","action":"open_tab","tab":"tracker","message":"<friendly confirmation>"}
{"type":"action","action":"open_tab","tab":"recipes","message":"<friendly confirmation>"}
{"type":"action","action":"search_library","query":"<search term>","message":"<friendly confirmation>"}
{"type":"action","action":"add_shopping","items":["item 1","item 2"],"message":"<friendly confirmation>"}
{"type":"action","action":"start_timer","seconds":<integer>,"message":"<friendly confirmation>"}

ACTION RULES:
- User asks to see / go to shopping list → open_tab tab="list"
- User says "add X to my shopping list" or "add X to the list" → add_shopping with items array
- User asks about calories, nutrition, what they ate, daily tracker → open_tab tab="tracker"
- User wants to browse or search their recipe library → search_library OR open_tab tab="recipes"
- User wants to see / edit / plan the meal calendar → open_planner
- User wants AI to plan meals for them → open_planner_ai
- User says "set a timer for X minutes/seconds" → start_timer with seconds value
- Substitutions, scaling, technique questions, "what can I make with X" → answer type

COOKING COMPANION RULES:
- If user asks about substituting an ingredient: give practical 1-2 sentence answer in "answer" type.
- If user asks to scale a recipe (I only have 200g instead of 500g): calculate proportions and answer clearly.
- If user asks what they can make with ingredients they have: suggest from their recipe library first, then general ideas.
- During cooking questions (what does "fold in" mean, is the chicken done, etc.): give concise, practical answer.
- Always be warm, concise, and useful. No long preambles.`;

  if (!appContext) return base;

  const lines = [
    `Today's date: ${appContext.today ?? new Date().toISOString().slice(0, 10)}`,
    `Saved recipes: ${appContext.recipeCount ?? 0}${appContext.recipeList ? ` — ${appContext.recipeList}` : ''}`,
    `Shopping list: ${appContext.shoppingCount ?? 0} items pending`,
    `Today's nutrition: ${appContext.todayCalories ?? 0} kcal eaten${appContext.calorieGoal ? ` / ${appContext.calorieGoal} kcal goal` : ''}${appContext.todayProtein != null ? `, ${Math.round(appContext.todayProtein)}g protein` : ''}`,
    appContext.planSummary ? `This week's meal plan: ${appContext.planSummary}` : null,
    appContext.currentRecipe ? `Currently cooking: "${appContext.currentRecipe}"` : null,
  ].filter(Boolean).join('\n- ');

  return base + `\n\nAPP CONTEXT (live device data — use this for personalised answers):\n- ${lines}`;
}

function getApiKey() {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return key;
}

async function dalleGenerateImage(prompt, size = '1024x1024') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ILLUSTRATION_TIMEOUT_MS);
  try {
    const response = await fetch(IMAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        style: 'natural',
        response_format: 'url',
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`DALL-E API error ${response.status}: ${errBody}`);
    }
    const data = await response.json();
    const url = data?.data?.[0]?.url;
    if (!url) throw new Error('DALL-E returned no image URL');
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
        quantity: parseFraction(item.quantity),
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
    if (parsed.type !== 'recipe' && parsed.type !== 'answer' && parsed.type !== 'action') {
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
export async function processChat(messages, imageBase64 = null, appContext = null) {
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
      { role: 'system', content: buildChatSystemPrompt(appContext) },
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

function buildIllustrationPrompt(stepText, stepNumber, totalSteps, recipeTitle, ingredients) {
  const ingredientList = (ingredients || [])
    .slice(0, 8)
    .map((i) => i.name)
    .join(', ');
  return (
    `Cookbook illustration. Absolutely no text, no words, no letters, no labels, no writing of any kind anywhere in the image. ` +
    `Recipe: "${recipeTitle}". ` +
    (ingredientList ? `Key ingredients: ${ingredientList}. ` : '') +
    `Illustrating step ${stepNumber} of ${totalSteps}: "${stepText}". ` +
    `Style: clean flat 2D illustration, soft muted pastel colors, simple clear shapes, white background, ` +
    `shows the cooking action or result clearly and accurately, ` +
    `professional cookbook aesthetic — the viewer should immediately understand what is happening in this step.`
  );
}

// Generates a cookbook illustration for a single recipe step via fal.ai FLUX.
export async function generateStepIllustration(stepText, recipeTitle, allSteps, ingredients) {
  logger.info('openai.generateStepIllustration', {
    recipeTitle,
    stepPreview: stepText.slice(0, 60),
  });
  const stepNumber = (allSteps || []).findIndex((s) => s.instruction === stepText) + 1 || 1;
  const totalSteps = (allSteps || []).length || 1;
  const prompt = buildIllustrationPrompt(stepText, stepNumber, totalSteps, recipeTitle, ingredients);
  try {
    const url = await dalleGenerateImage(prompt);
    logger.info('openai.generateStepIllustration.success', { recipeTitle });
    return url;
  } catch (err) {
    logger.error('openai.generateStepIllustration.error', { error: err.message });
    throw err;
  }
}

// Fires all step illustrations in parallel via fal.ai FLUX.
// Returns [{stepId, url}] for every step that succeeded; failures are silently skipped.
export async function generateAllStepIllustrations(steps, recipeTitle, ingredients) {
  logger.info('openai.generateAllStepIllustrations', { recipeTitle, stepCount: steps.length });
  const total = steps.length;
  const settled = await Promise.allSettled(
    steps.map((step, idx) => {
      const prompt = buildIllustrationPrompt(
        step.instruction,
        (step.stepNumber ?? idx + 1),
        total,
        recipeTitle,
        ingredients
      );
      return dalleGenerateImage(prompt).then((url) => ({ stepId: step.id, url }));
    })
  );
  const fulfilled = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  logger.info('openai.generateAllStepIllustrations.done', {
    total,
    succeeded: fulfilled.length,
  });
  return fulfilled;
}

// ── Meal planner AI chat ──────────────────────────────────────────────────────

function buildMealPlannerSystemPrompt({ prefs, recipeLibrary, weekStart, weekEnd, currentPlan }) {
  const prefLines = [
    prefs?.allergies ? `Allergies / dietary restrictions: ${prefs.allergies}` : '',
    prefs?.budget ? `Budget: ${prefs.budget}` : '',
    prefs?.goal ? `Health goal: ${prefs.goal}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const libraryLines =
    recipeLibrary && recipeLibrary.length > 0
      ? recipeLibrary
          .slice(0, 60)
          .map((r) => `- "${r.title}"${r.cuisine ? ` (${r.cuisine})` : ''}`)
          .join('\n')
      : 'No saved recipes yet.';

  const planLines =
    currentPlan && currentPlan.length > 0
      ? currentPlan.map((p) => `- ${p.plannedDate} ${p.mealType}: ${p.recipeTitle}`).join('\n')
      : 'Nothing planned this week yet.';

  return `You are an expert nutritionist and meal planning assistant inside a recipe app.
Respond ONLY with valid JSON — no markdown, no explanation outside JSON.

${prefLines ? `User preferences:\n${prefLines}\n` : ''}
Planning week: ${weekStart} to ${weekEnd}

User's recipe library (prefer these for suggestions):
${libraryLines}

Current week's meal plan:
${planLines}

Response formats — pick one:

For general answers / advice:
{"type":"answer","message":"<your response>"}

For meal plan suggestions (when user asks to plan meals / fill the week):
{
  "type":"meal_plan",
  "message":"<brief friendly explanation>",
  "items":[
    {"date":"YYYY-MM-DD","meal_type":"breakfast|lunch|dinner|snack","recipe_title":"<title>","servings":1,"notes":"<optional tip>"}
  ]
}

Rules:
- Strictly respect allergies and dietary restrictions.
- Prefer recipes from the library; only invent new ones if the library is empty or insufficient.
- meal_type must be exactly: breakfast, lunch, dinner, or snack.
- dates must be within the planning week (${weekStart} to ${weekEnd}).
- Aim for nutritional balance and variety across the week.
- Keep message warm, concise, and encouraging.`;
}

// Sends a message in the meal planner chat. Returns { type, message, items? }.
export async function chatMealPlanner({ messages, prefs, recipeLibrary, weekStart, weekEnd, currentPlan }) {
  logger.info('openai.chatMealPlanner', { messageCount: messages.length, weekStart });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const systemPrompt = buildMealPlannerSystemPrompt({ prefs, recipeLibrary, weekStart, weekEnd, currentPlan });
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errBody}`);
    }
    const data = await response.json();
    const choice = data?.choices?.[0];
    if (!choice) throw new Error('OpenAI returned no choices');
    const raw = choice.message?.content ?? '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    logger.info('openai.chatMealPlanner.success', { type: parsed.type });
    return parsed;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    logger.error('openai.chatMealPlanner.error', { error: err.message });
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
    const url = await dalleGenerateImage(prompt, '1792x1024');
    logger.info('openai.generateRecipeThumbnail.success', { title });
    return url;
  } catch (err) {
    logger.error('openai.generateRecipeThumbnail.error', { error: err.message });
    throw err;
  }
}
