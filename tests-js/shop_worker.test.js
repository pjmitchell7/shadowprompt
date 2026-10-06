import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopWorker, WORKERS_MODEL, MODEL_SETTINGS } from '../server/shop_worker.js';
import { APPLICATION_VERSION } from '../src/context_policy.js';
import { FIXTURE_VERSION, QUESTION, TRUSTED_INSTRUCTIONS } from '../src/shop_fixtures.js';
import { TRIAL_KIND, validateTrial } from '../src/shop_trial.js';

const site = 'https://shadowprompt-shelfday.test-account.workers.dev';
const data = condition => ({ fixtureVersion: FIXTURE_VERSION, question: QUESTION, condition, runId: 'test-' + condition });
const request = (body = data('clean'), headers = {}) => new Request(site + '/api/shop/run', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1', origin: site, ...headers }, body: JSON.stringify(body) });
const setup = (generate = async () => ({ response: '{"sku":"SD-L01","price":39,"connector":"USB-C","mount":"desk clamp","explanation":"Fits the three catalog constraints."}', usage: { prompt_tokens: 1000, completion_tokens: 60, total_tokens: 1060 } })) => {
  const calls = [];
  const env = { FREE_ACCOUNT_VERIFIED: 'true', LIVE_ENABLED: 'true', AI: { async run(model, input) { calls.push({ model, input }); return generate(model, input); } } };
  return { calls, env };
};

test('Workers activation fails closed and static assets stay independent of model availability', async () => {
  const worker = createShopWorker({ testOnly: true }); const { env, calls } = setup();
  for (const partial of [{}, { ...env, FREE_ACCOUNT_VERIFIED: 'false' }, { ...env, LIVE_ENABLED: 'false' }, { ...env, AI: undefined }]) {
    assert.equal((await worker.fetch(request(), partial)).status, 503);
    const status = await (await worker.fetch(new Request(site + '/api/shop/status'), partial)).json(); assert.equal(status.available, false);
  }
  assert.equal(calls.length, 0);
  let assets = 0;
  const response = await worker.fetch(new Request(site + '/'), { ASSETS: { fetch: async () => { assets++; return new Response('storefront'); } } });
  assert.equal(await response.text(), 'storefront'); assert.equal(assets, 1);
  assert.equal((await worker.fetch(new Request(site + '/api/no-such'), env)).status, 404);
});

test('Workers rejects cross-origin, arbitrary inputs, invalid bytes and oversized streaming bodies', async () => {
  const worker = createShopWorker({ testOnly: true, rateLimit: 30 }); const { env, calls } = setup();
  for (const body of [{ ...data('clean'), model: '@other/model' }, { ...data('clean'), question: 'An arbitrary prompt' }, { ...data('clean'), sources: [] }, { ...data('clean'), tools: [] }, { ...data('clean'), condition: 'untrusted' }]) assert.equal((await worker.fetch(request(body), env)).status, 400);
  assert.equal((await worker.fetch(request(undefined, { origin: 'https://other.invalid' }), env)).status, 403);
  assert.equal((await worker.fetch(request(undefined, { 'sec-fetch-site': 'cross-site' }), env)).status, 403);
  const invalid = new Request(site + '/api/shop/run', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1' }, body: new Uint8Array([255, 254]) });
  assert.equal((await worker.fetch(invalid, env)).status, 400);
  const large = new Request(site + '/api/shop/run', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1' }, body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(9000)); controller.close(); } }), duplex: 'half' });
  assert.equal((await worker.fetch(large, env)).status, 413); assert.equal(calls.length, 0);
  const slow = new Request(site + '/api/shop/run', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1' }, body: new ReadableStream({ start() {} }), duplex: 'half' });
  assert.equal((await createShopWorker({ testOnly: true, bodyTimeoutMs: 10 }).fetch(slow, env)).status, 408);
  assert.equal(calls.length, 0);
});

test('Workers mock captures retain immutable paired context, settings and normal safeguards without certifying responses', async () => {
  const worker = createShopWorker({ testOnly: true }); const { env, calls } = setup(); const captures = [];
  for (const id of ['clean', 'poisoned-off', 'poisoned-on']) {
    const response = await worker.fetch(request(data(id)), env); assert.equal(response.status, 200); captures.push(await response.json());
  }
  assert.equal(calls.length, 3);
  for (const call of calls) { assert.equal(call.model, WORKERS_MODEL); assert.equal(call.input.messages[0].content, TRUSTED_INSTRUCTIONS); for (const key of Object.keys(MODEL_SETTINGS)) assert.equal(call.input[key], MODEL_SETTINGS[key]); assert.equal('tools' in call.input, false); assert.equal('gateway' in call.input, false); }
  assert.equal(captures[1].original.digest, captures[2].original.digest);
  assert.notEqual(captures[1].run.deliveredDigest, captures[2].run.deliveredDigest);
  assert.equal(JSON.parse(calls[1].input.messages[1].content).reviews.length, 4);
  assert.equal(JSON.parse(calls[2].input.messages[1].content).reviews.length, 3);
  assert.equal(captures[2].run.evaluation.state, 'review');
  assert.equal(captures[2].run.provenance.returnedModel, null);
  const trial = { kind: TRIAL_KIND, schemaVersion: 1, applicationVersion: APPLICATION_VERSION, fixtureVersion: FIXTURE_VERSION, origin: 'live', trialId: 'mock-worker-trial', pairId: 'mock-worker-pair', originals: captures.slice(0, 2).map(item => item.original), conditions: captures.map(item => item.run) };
  await validateTrial(trial, { allowTest: true });
  await assert.rejects(validateTrial(trial), /Genuine provider capture required/);
});

test('Workers free-quota, paid-plan and capacity errors never retry or select a fallback', async () => {
  for (const [code, expected] of [['3036', 429], ['5035', 503], ['3040', 503], ['unknown', 502]]) {
    const worker = createShopWorker({ testOnly: true }); const { env, calls } = setup(async () => { throw Object.assign(new Error('private provider detail'), { code }); });
    const response = await worker.fetch(request(), env); assert.equal(response.status, expected); const body = await response.json();
    assert.equal(calls.length, 1); assert.equal(body.run.status, 'error'); assert.equal(body.run.rawResponse, null); assert.equal(body.run.provenance.cost, null);
    assert.equal(JSON.stringify(body).includes('private provider detail'), false);
  }
});

test('Workers bounds output, rate, attempts and concurrent asynchronous context preparation', async () => {
  const worker = createShopWorker({ testOnly: true, rateLimit: 1 }); const { env, calls } = setup();
  assert.equal((await worker.fetch(request(), env)).status, 200); assert.equal((await worker.fetch(request(), env)).status, 429); assert.equal(calls.length, 1);
  const limited = createShopWorker({ testOnly: true, maxAttempts: 1 }); const provider = setup();
  assert.equal((await limited.fetch(request(), provider.env)).status, 200); assert.equal((await limited.fetch(request(), provider.env)).status, 429);
  const oversized = setup(async () => ({ response: 'x'.repeat(16001) }));
  assert.equal((await createShopWorker({ testOnly: true }).fetch(request(), oversized.env)).status, 502);
  const tokens = setup(async () => ({ response: 'text', usage: { prompt_tokens: 100, completion_tokens: 257, total_tokens: 357 } }));
  assert.equal((await createShopWorker({ testOnly: true }).fetch(request(), tokens.env)).status, 502);
  let release; const delayed = setup(() => new Promise(resolve => { release = () => resolve({ response: 'finished' }); }));
  const concurrent = createShopWorker({ testOnly: true, maxConcurrent: 1, timeoutMs: 200 });
  const both = [concurrent.fetch(request(), delayed.env), concurrent.fetch(request(), delayed.env)];
  await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(delayed.calls.length, 1); release();
  assert.deepEqual((await Promise.all(both)).map(response => response.status).sort(), [200, 429]);
});

test('Workers deadlines keep pending inference reserved and do not imply binding cancellation', async () => {
  const worker = createShopWorker({ testOnly: true, maxConcurrent: 1, timeoutMs: 10 }); let release;
  const { env, calls } = setup(() => new Promise(resolve => { release = () => resolve({ response: 'late' }); }));
  const first = await worker.fetch(request(), env); assert.equal(first.status, 504);
  assert.match((await first.json()).error, /provider may still be running/);
  assert.equal((await worker.fetch(request(), env)).status, 429); assert.equal(calls.length, 1); release();
});
