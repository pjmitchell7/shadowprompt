import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createShopServer } from '../server/shop_server.js';
import { FIXTURE_VERSION, QUESTION } from '../src/shop_fixtures.js';

const input = condition => ({ fixtureVersion: FIXTURE_VERSION, question: QUESTION, condition, runId: 'test-run' });
const post = (url, body, headers = {}) => fetch(url + '/api/shop/run', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
async function start(options = {}) { const service = createShopServer(options); const address = await service.listen(0); return { service, url: `http://127.0.0.1:${address.port}` }; }
test('local seeded catalog and absent provider are honest; remote bind, cross-origin and client policy are rejected', async () => {
  const { service, url } = await start();
  try {
    assert.throws(() => service.listen(8787, '0.0.0.0'), /127.0.0.1/);
    const catalog = await (await fetch(url + '/api/shop/catalog')).json(); assert.equal(catalog.products.length, 4); assert.equal(catalog.reviews.poisoned.length, 4);
    const status = await (await fetch(url + '/api/shop/status')).json(); assert.equal(status.available, false);
    const response = await post(url, input('poisoned-on')); assert.equal(response.status, 503); const value = await response.json(); assert.match(value.error, /No model request/); assert.equal(value.context.delivered.reviews.length, 3);
    assert.equal((await post(url, { ...input('poisoned-on'), allowedSources: ['review-1'] })).status, 400);
    assert.equal((await post(url, { ...input('clean'), question: 'custom instructions' })).status, 400);
    assert.equal((await post(url, input('clean'), { origin: 'https://attacker.example' })).status, 403);
    const badHost = await new Promise((resolve, reject) => {
      const request = http.request(url + '/api/shop/run', { method: 'POST', headers: { host: 'attacker.example', 'content-type': 'application/json' } }, response => { response.resume(); resolve(response.statusCode); });
      request.on('error', reject); request.end(JSON.stringify(input('clean')));
    });
    assert.equal(badHost, 403);
    assert.equal((await post(url, { padding: 'x'.repeat(9000) })).status, 413);
  } finally { await service.close(); }
});
test('injectable test adapter receives actual server-enforced context, fixed safeguards and token bounds', async () => {
  const seen = []; const testProvider = { kind: 'test-double', countOutputTokens: () => 3, countInputTokens: () => 100, async generate(context, options) { seen.push(context); assert.equal(options.limits.outputTokens, 1000); return { status: 'completed', rawResponse: 'TEST ONLY', recommendation: null }; } };
  const { service, url } = await start({ testProvider });
  try {
    const off = await (await post(url, input('poisoned-off'))).json(); const on = await (await post(url, input('poisoned-on'))).json();
    assert.equal(off.origin, 'test-double'); assert.equal(on.testOnly, true); assert.equal(off.context.originalDigest, on.context.originalDigest); assert.notEqual(off.context.deliveredDigest, on.context.deliveredDigest);
    assert.equal(seen[0].delivered.reviews.length, 4); assert.equal(seen[1].delivered.reviews.length, 3); assert.equal(seen[0].delivered.instructions, seen[1].delivered.instructions);
  } finally { await service.close(); }
});
test('service enforces request rate, attempt and timeout bounds and aborts slow mock adapters', async () => {
  const limited = await start({ rateLimit: 1 });
  try { assert.equal((await post(limited.url, input('clean'))).status, 503); assert.equal((await post(limited.url, input('clean'))).status, 429); } finally { await limited.service.close(); }
  let signal; const slow = await start({ timeoutMs: 20, testProvider: { kind: 'test-double', countOutputTokens: () => 3, countInputTokens: () => 10, generate(_, options) { signal = options.signal; return new Promise(() => {}); } } });
  try { assert.equal((await post(slow.url, input('clean'))).status, 504); assert.equal(signal.aborted, true); } finally { await slow.service.close(); }
  const capped = await start({ maxAttempts: 1, testProvider: { kind: 'test-double', countOutputTokens: () => 3, countInputTokens: () => 1, async generate() { return { status: 'refused', rawResponse: 'TEST refusal' }; } } });
  try { assert.equal((await post(capped.url, input('clean'))).status, 200); assert.equal((await post(capped.url, input('clean'))).status, 429); } finally { await capped.service.close(); }
  const oversized = await start({ testProvider: { kind: 'test-double', countOutputTokens: () => 3, countInputTokens: () => 12001, generate() { throw new Error('Must not be called'); } } });
  try { assert.equal((await post(oversized.url, input('clean'))).status, 413); } finally { await oversized.service.close(); }
});
test('concurrency and output caps fail clearly without certifying mock responses', async () => {
  let started; const entered = new Promise(resolve => { started = resolve; }); let finish;
  const { service, url } = await start({ maxConcurrent: 1, testProvider: { kind: 'test-double', countInputTokens: () => 1, countOutputTokens: () => 1001, generate() { started(); return new Promise(resolve => { finish = resolve; }); } } });
  try {
    const first = post(url, input('clean')); await entered;
    assert.equal((await post(url, input('clean'))).status, 429);
    finish({ status: 'completed', rawResponse: 'TEST output over token cap' });
    assert.equal((await first).status, 502);
  } finally { await service.close(); }
});
