import { logger } from '../utils/logger';

const BASE_URL = 'https://developer.api.walmart.com/api-proxy/service/affil/product/v2';
const TIMEOUT_MS = 15000;

const searchCache = {};

function getCredentials() {
  const consumerId = process.env.EXPO_PUBLIC_WALMART_CLIENT_ID || process.env.WALMART_CLIENT_ID;
  const privateKeyPem = process.env.EXPO_PUBLIC_WALMART_PRIVATE_KEY || process.env.WALMART_PRIVATE_KEY;
  const keyVersion = process.env.EXPO_PUBLIC_WALMART_KEY_VERSION || process.env.WALMART_KEY_VERSION || '1';
  if (!consumerId || !privateKeyPem) {
    throw new Error(
      'Walmart API credentials not configured. Set WALMART_CLIENT_ID and WALMART_PRIVATE_KEY in .testEnvVars'
    );
  }
  return { consumerId, privateKeyPem, keyVersion };
}

async function generateAuthHeaders(consumerId, privateKeyPem, keyVersion) {
  const timestamp = Date.now().toString();
  const sortedHashString = `${consumerId}\n${timestamp}\n${keyVersion}\n`;

  let signature;
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    const crypto = require('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(sortedHashString);
    signature = sign.sign(privateKeyPem, 'base64');
  } else {
    const forge = require('node-forge');
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const md = forge.md.sha256.create();
    md.update(sortedHashString, 'utf8');
    const signatureBytes = privateKey.sign(md);
    signature = forge.util.encode64(signatureBytes);
  }

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
    const { consumerId, privateKeyPem, keyVersion } = getCredentials();
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
  const url = `https://www.walmart.com/cart?items=${itemIds.join(',')}`;
  logger.info('walmart.buildCartLink.success', { url });
  return url;
}
