import { logger } from '../utils/logger';

export async function scrapeRecipeUrl(url) {
  logger.info('scraper.scrapeRecipeUrl', { url });
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }
    const html = await response.text();
    const text = stripHtml(html);
    if (text.length < 20) {
      throw new Error('Could not extract meaningful text from URL');
    }
    logger.info('scraper.scrapeRecipeUrl.success', { url, textLength: text.length });
    return text;
  } catch (err) {
    logger.error('scraper.scrapeRecipeUrl.error', { url, error: err.message });
    throw err;
  }
}

function stripHtml(html) {
  let cleaned = html;
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  cleaned = cleaned.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  cleaned = cleaned.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  cleaned = cleaned.replace(/<header[\s\S]*?<\/header>/gi, ' ');
  cleaned = cleaned.replace(/<aside[\s\S]*?<\/aside>/gi, ' ');
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.replace(/&nbsp;/gi, ' ');
  cleaned = cleaned.replace(/&amp;/gi, '&');
  cleaned = cleaned.replace(/&lt;/gi, '<');
  cleaned = cleaned.replace(/&gt;/gi, '>');
  cleaned = cleaned.replace(/&#\d+;/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned.trim();
}
