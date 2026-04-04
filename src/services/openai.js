import { logger } from '../utils/logger';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT =
  'You are an ingredient extraction assistant. Given a recipe image or text, return ONLY a JSON object with no markdown, no explanation. The object must have: "title" (string — the recipe name if visible, or a descriptive name you create based on the dish, e.g. "Chocolate Chip Cookies" or "Grilled Salmon with Lemon"), and "ingredients" (array where each item has: name (string), quantity (number or null), unit (string or null), notes (string or null)). If you cannot determine a value, use null. Always use standard abbreviations for units: tsp, tbsp, oz, lb, c (cup), qt, gal, ml, L, g, kg, pt. Never write out the full word (e.g. use "tsp" not "teaspoon", "tbsp" not "tablespoon", "oz" not "ounce", "lb" not "pound").';

function getApiKey() {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return key;
}

function parseIngredientJson(raw) {
  let text = raw.trim();

  if (!text.includes('[') && !text.includes('{')) {
    logger.warn('openai.parseIngredientJson.notJson', { preview: text.slice(0, 200) });
    throw new Error('No ingredients found. Make sure the image clearly shows a recipe with ingredients listed.');
  }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  try {
    let parsed = JSON.parse(text);
    let title = null;
    let ingredientsArray = null;

    if (Array.isArray(parsed)) {
      ingredientsArray = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      title = typeof parsed.title === 'string' ? parsed.title : null;
      ingredientsArray = parsed.ingredients || Object.values(parsed).find(Array.isArray);
    }

    if (!ingredientsArray || !Array.isArray(ingredientsArray)) {
      throw new Error('Response does not contain ingredients');
    }

    const ingredients = ingredientsArray.map((item) => ({
      name: typeof item.name === 'string' ? item.name : String(item.name),
      quantity: typeof item.quantity === 'number' ? item.quantity : null,
      unit: typeof item.unit === 'string' ? item.unit : null,
      notes: typeof item.notes === 'string' ? item.notes : null,
    }));

    return { title, ingredients };
  } catch (parseErr) {
    logger.error('openai.parseIngredientJson.rawResponse', { preview: raw.slice(0, 200) });
    throw new Error('No ingredients found. Make sure the image clearly shows a recipe with ingredients listed.');
  }
}

async function callOpenAI(messages, { jsonMode = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = { model: MODEL, messages, max_tokens: 2048 };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const response = await fetch(API_URL, {
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
    const content = data.choices[0].message.content;
    if (!content) {
      const refusal = data.choices[0].message.refusal;
      throw new Error(refusal || 'OpenAI returned empty response');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

export async function parseImageIngredients(base64Image) {
  logger.info('openai.parseImageIngredients', { imageSize: base64Image.length, model: MODEL });
  try {
    const raw = await callOpenAI([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Look at this image. If it shows a recipe with ingredients listed, extract those ingredients exactly. If it shows a prepared dish or meal, identify the dish and generate a complete ingredient list for making it. Always include realistic estimated quantities and units for every ingredient (e.g. 2 cups, 1 tsp, 1 lb). Never leave quantity or unit as null unless truly unknown. Return ONLY a JSON object with an "ingredients" key containing the array.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ]);
    const result = parseIngredientJson(raw);
    logger.info('openai.parseImageIngredients.success', { title: result.title, count: result.ingredients.length });
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('openai.parseImageIngredients.error', { error: 'Request timed out' });
      throw new Error('OpenAI request timed out');
    }
    logger.error('openai.parseImageIngredients.error', { error: err.message });
    throw err;
  }
}

export async function parseTextIngredients(rawText) {
  logger.info('openai.parseTextIngredients', { textLength: rawText.length, model: MODEL });
  try {
    const raw = await callOpenAI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: rawText },
    ], { jsonMode: true });
    const result = parseIngredientJson(raw);
    logger.info('openai.parseTextIngredients.success', { title: result.title, count: result.ingredients.length });
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('openai.parseTextIngredients.error', { error: 'Request timed out' });
      throw new Error('OpenAI request timed out');
    }
    logger.error('openai.parseTextIngredients.error', { error: err.message });
    throw err;
  }
}
