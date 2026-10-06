import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveState } from '../src/shop_live.js';
import { createShopWorker } from '../server/shop_worker.js';
import { validateTrial } from '../src/shop_trial.js';
import { stableJson } from '../src/context_policy.js';

const site = 'https://shadowprompt-shelfday.test-account.workers.dev';
function service({ generate, mutate, timeoutMs = 200 } = {}) {
  const calls = []; const posts = [];
  const worker = createShopWorker({ testOnly: true, rateLimit: 100, timeoutMs });
  const env = { FREE_ACCOUNT_VERIFIED: 'true', LIVE_ENABLED: 'true', AI: { async run(model, input) { calls.push({ model, input }); return generate ? generate(model, input, calls.length) : { response: JSON.stringify({ sku: 'SD-L01', price: 39, connector: 'USB-C', mount: 'desk clamp', explanation: 'TEST ONLY: mocked binding, no model call.' }) }; } } };
  const fetcher = async (path, options) => {
    if (options.method === 'POST') posts.push(JSON.parse(options.body));
    const response = await worker.fetch(new Request(site + path, { ...options, headers: { ...options.headers, origin: site, 'cf-connecting-ip': '192.0.2.1' } }), env);
    if (!mutate) return response;
    const body = await response.json(); mutate(body, options, posts.length); return Response.json(body, { status: response.status });
  };
  return { fetcher, calls, posts, env };
}

test('live client needs a verified matching readiness response and never accepts mock readiness in production', async () => {
  const mock = service(); const production = createLiveState({ fetcher: mock.fetcher });
  await production.check(); await production.start(); assert.equal(production.state.available, false); assert.equal(mock.posts.length, 0);
  const client = createLiveState({ fetcher: mock.fetcher, testOnly: true }); mock.env.LIVE_ENABLED = 'false';
  await client.check(); await client.start(); assert.equal(client.state.available, false); assert.equal(mock.calls.length, 0);
});

test('live mock comparison makes exactly three fixed requests and selection never reruns a model', async () => {
  const mock = service(); const client = createLiveState({ fetcher: mock.fetcher, testOnly: true });
  await client.check(); assert.equal(mock.calls.length, 0); await client.start(); assert.equal(client.state.status, 'ready');
  assert.deepEqual(mock.posts.map(input => input.condition), ['clean', 'poisoned-off', 'poisoned-on']);
  assert.equal(mock.calls.length, 3); assert.equal(client.state.captures.length, 3);
  const [clean, off, on] = client.state.trial.conditions;
  assert.equal(off.originalDigest, on.originalDigest); assert.notEqual(off.deliveredDigest, on.deliveredDigest);
  assert.equal(stableJson(off.provenance.settings), stableJson(on.provenance.settings));
  assert.equal(clean.delivered.instructions, off.delivered.instructions); assert.equal(off.delivered.instructions, on.delivered.instructions);
  client.select('poisoned-off'); client.select('clean'); client.select('poisoned-on'); assert.equal(mock.calls.length, 3);
  assert.throws(() => { off.delivered.reviews[0].text = 'tamper'; }, TypeError);
  await assert.rejects(validateTrial(client.state.trial), /Genuine provider capture/);
});

test('quota failure retains only actual returns, stops remaining arms and disables further inference', async () => {
  const mock = service({ generate: async (_, __, number) => { if (number === 2) throw { code: '3036' }; return { response: 'TEST ONLY: mock first return.' }; } });
  const client = createLiveState({ fetcher: mock.fetcher, testOnly: true }); await client.check(); await client.start();
  assert.equal(client.state.status, 'quota'); assert.equal(client.state.trial, null); assert.equal(client.state.captures.length, 2); assert.equal(mock.calls.length, 2);
  const partial = client.exportPartial(); assert.equal(partial.completeComparison, false); assert.equal(partial.modelRequest, false); assert.deepEqual(partial.notRequested, ['poisoned-on']); assert.deepEqual(partial.noVerifiedReturn, []);
  await client.check(); assert.equal(client.state.available, false); await client.start(); assert.equal(mock.calls.length, 2);
});

test('corrupt live evidence is rejected and unverified transport returns are kept distinct from unrequested arms', async () => {
  const mock = service({ mutate: (body, options, number) => { if (options.method === 'POST' && number === 2) body.run.deliveredDigest = 'corrupt'; } });
  const client = createLiveState({ fetcher: mock.fetcher, testOnly: true }); await client.check(); await client.start();
  assert.equal(client.state.status, 'error'); assert.equal(client.state.captures.length, 1); assert.equal(mock.calls.length, 2);
  const partial = client.exportPartial(); assert.deepEqual(partial.notRequested, ['poisoned-on']); assert.equal(partial.noVerifiedReturn[0].condition, 'poisoned-off'); assert.match(client.state.error, /Delivered context/);
});

test('live cancellation discards late completion without making a replacement request', async () => {
  let finish; const mock = service({ generate: () => new Promise(resolve => { finish = () => resolve({ response: 'TEST ONLY: late mocked return.' }); }) });
  const client = createLiveState({ fetcher: mock.fetcher, testOnly: true }); await client.check(); const pending = client.start();
  await new Promise(resolve => setTimeout(resolve, 15)); assert.equal(mock.calls.length, 1); client.cancel(); finish(); await pending;
  assert.equal(client.state.status, 'cancelled'); assert.equal(client.state.captures.length, 0); assert.equal(client.state.trial, null); assert.equal(mock.calls.length, 1);
  assert.equal(client.exportPartial().noVerifiedReturn.length, 1);
});

test('live client bounds response bytes and response deadlines without inference retries', async () => {
  const realMock = service(); const client = createLiveState({ testOnly: true, fetcher: (path, options) => options.method === 'POST' ? Promise.resolve(new Response('x'.repeat(200001))) : realMock.fetcher(path, options) });
  await client.check(); await client.start(); assert.equal(client.state.status, 'error'); assert.match(client.state.error, /byte limit/); assert.equal(client.state.attempts.length, 1);
  const slow = createLiveState({ testOnly: true, timeoutMs: 10, fetcher: (path, options) => options.method === 'POST' ? new Promise(() => {}) : realMock.fetcher(path, options) });
  await slow.check(); await slow.start(); assert.equal(slow.state.status, 'timeout'); assert.match(slow.state.error, /may still finish/); assert.equal(slow.state.attempts.length, 1);
});
