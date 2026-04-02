const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ENV_FILE = path.join(__dirname, '..', '.testEnvVars');
if (fs.existsSync(ENV_FILE)) {
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^export\s+(\w+)=["']?(.*?)["']?\s*$/);
    if (match) process.env[match[1]] = match[2];
  }
}

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT =
  'You are an ingredient extraction assistant. Given a recipe image or text, extract all ingredients and return ONLY a JSON array with no markdown, no explanation. Each item must have: name (string), quantity (number or null), unit (string or null), notes (string or null). If you cannot determine a value, use null.';

const SAMPLE_TEXT =
  '2 cups all-purpose flour, 1 tsp baking soda, 1/2 tsp salt, 1 cup butter softened, 3/4 cup granulated sugar, 2 large eggs, 2 tsp vanilla extract';

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

async function run() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-your')) {
    console.error(JSON.stringify({ status: 'fail', error: 'OPENAI_API_KEY not set or still placeholder. Copy .testEnvVars.example to .testEnvVars and fill in your key.' }));
    process.exit(1);
  }

  console.error(`Calling GPT-4o with sample recipe text (${SAMPLE_TEXT.length} chars)...`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: SAMPLE_TEXT },
        ],
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const body = await response.text();
      console.error(JSON.stringify({ status: 'fail', error: `OpenAI API error ${response.status}`, body }));
      process.exit(1);
    }

    const data = await response.json();
    const raw = data.choices[0].message.content;
    const ingredients = parseIngredientJson(raw);

    if (!ingredients.length) {
      console.error(JSON.stringify({ status: 'fail', error: 'Returned empty ingredient array' }));
      process.exit(1);
    }

    console.log(JSON.stringify({ status: 'pass', count: ingredients.length, ingredients }, null, 2));
    process.exit(0);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(JSON.stringify({ status: 'fail', error: 'Request timed out' }));
    } else {
      console.error(JSON.stringify({ status: 'fail', error: err.message }));
    }
    process.exit(1);
  }
}

run();
