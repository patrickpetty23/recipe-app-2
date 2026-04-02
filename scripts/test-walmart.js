const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.testEnvVars');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^export\s+(\w+)=["']?(.+?)["']?\s*$/);
    if (match) process.env[match[1]] = match[2];
  }
}

const BASE_URL = 'https://developer.api.walmart.com/api-proxy/service/affil/product/v2';

function getCredentials() {
  const consumerId = process.env.WALMART_CLIENT_ID;
  const privateKeyPem = process.env.WALMART_PRIVATE_KEY;
  const keyVersion = process.env.WALMART_KEY_VERSION || '1';
  if (!consumerId || !privateKeyPem) {
    return null;
  }
  return { consumerId, privateKeyPem, keyVersion };
}

function generateAuthHeaders(consumerId, privateKeyPem, keyVersion) {
  const timestamp = Date.now().toString();
  const sortedHashString = `${consumerId}\n${timestamp}\n${keyVersion}\n`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(sortedHashString);
  const signature = sign.sign(privateKeyPem, 'base64');

  return {
    'WM_SEC.AUTH_SIGNATURE': signature,
    'WM_CONSUMER.INTIMESTAMP': timestamp,
    'WM_CONSUMER.ID': consumerId,
    'WM_SEC.KEY_VERSION': keyVersion,
  };
}

async function searchProduct(ingredientName, creds) {
  const headers = generateAuthHeaders(creds.consumerId, creds.privateKeyPem, creds.keyVersion);
  const query = encodeURIComponent(ingredientName);
  const url = `${BASE_URL}/search?query=${query}&numItems=1`;

  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Walmart API error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const items = data.items || [];
  if (items.length === 0) return null;

  const item = items[0];
  return {
    itemId: String(item.itemId),
    name: item.name,
    price: item.salePrice ?? item.msrp ?? null,
    thumbnailUrl: item.thumbnailImage || null,
    productUrl: item.productUrl || `https://www.walmart.com/ip/${item.itemId}`,
  };
}

function buildCartLink(itemIds) {
  return `https://www.walmart.com/cart?items=${itemIds.join(',')}`;
}

async function run() {
  const results = { steps: [], passed: 0, failed: 0 };

  function check(name, condition) {
    if (condition) {
      results.steps.push({ name, status: 'pass' });
      results.passed++;
    } else {
      results.steps.push({ name, status: 'fail' });
      results.failed++;
    }
  }

  const creds = getCredentials();
  if (!creds) {
    console.error('Walmart credentials not set in .testEnvVars — set WALMART_CLIENT_ID and WALMART_PRIVATE_KEY');
    results.steps.push({
      name: 'credentials_check',
      status: 'fail',
      error: 'WALMART_CLIENT_ID and WALMART_PRIVATE_KEY not configured',
    });
    results.failed++;
    results.status = 'fail';
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  try {
    console.error('Searching for "all-purpose flour"...');
    const flour = await searchProduct('all-purpose flour', creds);
    check('search_flour', flour !== null && flour.itemId);
    if (flour) {
      console.error(`  Found: ${flour.name} — $${flour.price}`);
    } else {
      console.error('  No result found');
    }

    console.error('Searching for "large eggs"...');
    const eggs = await searchProduct('large eggs', creds);
    check('search_eggs', eggs !== null && eggs.itemId);
    if (eggs) {
      console.error(`  Found: ${eggs.name} — $${eggs.price}`);
    } else {
      console.error('  No result found');
    }

    const matchedIds = [flour, eggs].filter(Boolean).map((p) => p.itemId);
    if (matchedIds.length > 0) {
      const cartUrl = buildCartLink(matchedIds);
      check('build_cart_link', cartUrl.includes('walmart.com') && cartUrl.includes(matchedIds[0]));
      console.error(`Cart URL: ${cartUrl}`);
    } else {
      check('build_cart_link', false);
    }
  } catch (err) {
    results.steps.push({ name: 'unexpected_error', status: 'fail', error: err.message });
    results.failed++;
    console.error(`Error: ${err.message}`);
  }

  results.status = results.failed === 0 ? 'pass' : 'fail';
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.failed > 0 ? 1 : 0);
}

run();
