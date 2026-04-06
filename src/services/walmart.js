import { logger } from '../utils/logger';

const BASE_URL = 'https://developer.api.walmart.com/api-proxy/service/affil/product/v2';
const TIMEOUT_MS = 15000;

const searchCache = {};

function getCredentials() {
  const consumerId = process.env.EXPO_PUBLIC_WALMART_CLIENT_ID || process.env.WALMART_CLIENT_ID;
  const rawPem = process.env.EXPO_PUBLIC_WALMART_PRIVATE_KEY || process.env.WALMART_PRIVATE_KEY;
  const keyVersion = process.env.EXPO_PUBLIC_WALMART_KEY_VERSION || process.env.WALMART_KEY_VERSION || '1';
  if (!consumerId || !rawPem) {
    return null;
  }
  // Handle both quoted multiline (real \n) and escaped \n from different dotenv parsers
  const privateKeyPem = rawPem.includes('\\n') ? rawPem.replace(/\\n/g, '\n') : rawPem;
  return { consumerId, privateKeyPem, keyVersion };
}

export function isWalmartConfigured() {
  return getCredentials() !== null;
}

async function generateAuthHeaders(consumerId, privateKeyPem, keyVersion) {
  const timestamp = Date.now().toString();
  const message = `${consumerId}\n${timestamp}\n${keyVersion}\n`;

  // Strip PEM headers/footers and whitespace, leaving raw base64
  const b64 = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  // Decode base64 → ArrayBuffer (PKCS#8 DER)
  const binaryStr = atob(b64);
  const keyBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) keyBytes[i] = binaryStr.charCodeAt(i);

  // Import key using native WebCrypto (available on RN 0.72+ / Hermes)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );

  // Sign
  const msgBytes = new TextEncoder().encode(message);
  const sigBuffer = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, cryptoKey, msgBytes);

  // Encode signature as base64
  const sigBytes = new Uint8Array(sigBuffer);
  let binary = '';
  for (let i = 0; i < sigBytes.length; i++) binary += String.fromCharCode(sigBytes[i]);
  const signature = btoa(binary);

  return {
    'WM_SEC.AUTH_SIGNATURE': signature,
    'WM_CONSUMER.INTIMESTAMP': timestamp,
    'WM_CONSUMER.ID': consumerId,
    'WM_SEC.KEY_VERSION': keyVersion,
  };
}

export async function searchProduct(ingredientName) {
  logger.info('walmart.searchProduct', { ingredient: ingredientName });

  if (searchCache[ingredientName]) {
    logger.info('walmart.searchProduct.cached', { ingredient: ingredientName });
    return searchCache[ingredientName];
  }

  try {
    const creds = getCredentials();
    if (!creds) {
      const err = new Error(
        'Walmart API keys not configured. Add WALMART_CLIENT_ID and WALMART_PRIVATE_KEY to your .testEnvVars file, then restart the app.'
      );
      err.code = 'WALMART_NOT_CONFIGURED';
      throw err;
    }
    const { consumerId, privateKeyPem, keyVersion } = creds;
    const headers = await generateAuthHeaders(consumerId, privateKeyPem, keyVersion);
    const query = encodeURIComponent(ingredientName);
    const url = `${BASE_URL}/search?query=${query}&numItems=1`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('Walmart API auth error: invalid credentials or expired key');
      }
      if (response.status === 429) {
        throw new Error('Walmart API rate limit exceeded. Try again in a moment.');
      }
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Walmart API error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) {
        logger.info('walmart.searchProduct.noResults', { ingredient: ingredientName });
        return null;
      }

      const item = items[0];
      const product = {
        itemId: String(item.itemId),
        name: item.name,
        price: item.salePrice ?? item.msrp ?? null,
        thumbnailUrl: item.thumbnailImage || null,
        productUrl: item.productUrl || `https://www.walmart.com/ip/${item.itemId}`,
      };

      searchCache[ingredientName] = product;
      logger.info('walmart.searchProduct.success', {
        ingredient: ingredientName,
        itemId: product.itemId,
        price: product.price,
      });
      return product;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('walmart.searchProduct.error', { ingredient: ingredientName, error: 'Request timed out' });
      throw new Error('Walmart search timed out');
    }
    logger.error('walmart.searchProduct.error', { ingredient: ingredientName, error: err.message });
    throw err;
  }
}

export function buildCartLink(itemIds) {
  logger.info('walmart.buildCartLink', { itemCount: itemIds.length });
  if (!itemIds || itemIds.length === 0) {
    throw new Error('No item IDs provided');
  }
  const itemsParam = itemIds.map((id) => `${id}|1`).join(',');
  const url = `https://affil.walmart.com/cart/addToCart?items=${itemsParam}`;
  logger.info('walmart.buildCartLink.success', { url });
  return url;
}
