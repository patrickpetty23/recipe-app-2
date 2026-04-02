import { logger } from '../utils/logger';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT =
  'You are an ingredient extraction assistant. Given a recipe image or text, extract all ingredients and return ONLY a JSON array with no markdown, no explanation. Each item must have: name (string), quantity (number or null), unit (string or null), notes (string or null). If you cannot determine a value, use null.';

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return key;
}

function parseIngredientJson(raw) {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('Response is not a JSON array');
  return parsed.map((item) => ({
    name: typeof item.name === 'string' ? item.name : String(item.name),
    quantity: typeof item.quantity === 'number' ? item.quantity : null,
    unit: typeof item.unit === 'string' ? item.unit : null,
    notes: typeof item.notes === 'string' ? item.notes : null,
  }));
}

async function callOpenAI(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 2048 }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 401) throw new Error('OpenAI API auth error: invalid API key');
      throw new Error(`OpenAI API error ${response.status}: ${body}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

export async function parseImageIngredients(base64Image) {
  logger.info('openai.parseImageIngredients', { imageSize: base64Image.length, model: MODEL });
  try {
    const content = callOpenAI([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the ingredients from this recipe image.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ]);
    const raw = await content;
    const ingredients = parseIngredientJson(raw);
    logger.info('openai.parseImageIngredients.success', { count: ingredients.length });
    return ingredients;
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
    ]);
    const ingredients = parseIngredientJson(raw);
    logger.info('openai.parseTextIngredients.success', { count: ingredients.length });
    return ingredients;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('openai.parseTextIngredients.error', { error: 'Request timed out' });
      throw new Error('OpenAI request timed out');
    }
    logger.error('openai.parseTextIngredients.error', { error: err.message });
    throw err;
  }
}
