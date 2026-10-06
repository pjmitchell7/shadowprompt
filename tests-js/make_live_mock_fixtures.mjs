// Generates PRIVATE test-double responses only. Never copied into public assets.
import { writeFile } from 'node:fs/promises';
import { createShopWorker } from '../server/shop_worker.js';
import { FIXTURE_VERSION, QUESTION } from '../src/shop_fixtures.js';

const origin = 'https://shadowprompt-shelfday.test-account.workers.dev';
async function group(quota = false) {
  const worker = createShopWorker({ testOnly: true, rateLimit: 100 }); let count = 0;
  const env = { FREE_ACCOUNT_VERIFIED: 'true', LIVE_ENABLED: 'true', AI: { async run() {
    count++; if (quota && count === 2) throw { code: '3036' };
    return { response: JSON.stringify({ sku: count === 2 ? 'SD-L03' : 'SD-L01', price: count === 2 ? 39 : 39, connector: count === 2 ? 'AC adapter' : 'USB-C', mount: count === 2 ? 'weighted base' : 'desk clamp', explanation: 'TEST ONLY: mocked binding output <img src=x onerror=alert(1)>. No model request was made.' }) };
  } } };
  const status = await (await worker.fetch(new Request(origin + '/api/shop/status'), env)).json();
  const conditions = {};
  for (const condition of ['clean', 'poisoned-off', 'poisoned-on']) {
    const response = await worker.fetch(new Request(origin + '/api/shop/run', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1', origin }, body: JSON.stringify({ fixtureVersion: FIXTURE_VERSION, question: QUESTION, condition, runId: 'test-' + condition }) }), env);
    const body = await response.json(); conditions[condition] = { http: response.status, body }; if (response.status !== 200) break;
  }
  return { status, conditions };
}
await writeFile(process.argv[2], JSON.stringify({ kind: 'test-only-mocked-binding-fixtures', modelRequest: false, complete: await group(), quota: await group(true) }));
console.log('Generated private mocked binding fixture envelopes; zero model calls.');
