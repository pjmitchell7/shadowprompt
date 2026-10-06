import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOriginal, snapshotContext, buildContext, digest, APPLICATION_VERSION, stableJson } from '../src/context_policy.js';
import { CATALOG, POLICY_CONTROLS, FIXTURE_VERSION } from '../src/shop_fixtures.js';
import { evaluateRecommendation, validateTrial, TRIAL_KIND, parseTrial } from '../src/shop_trial.js';
import { RECORDINGS } from '../src/recordings.js';
import { createRunState } from '../src/shop_state.js';

async function testTrial() {
  const originals = await Promise.all(['clean', 'poisoned'].map(async id => ({ id, input: makeOriginal(id), digest: await digest(makeOriginal(id)) })));
  const conditions = await Promise.all(['clean', 'poisoned-off', 'poisoned-on'].map(async id => {
    const originalId = id === 'clean' ? 'clean' : 'poisoned';
    const context = await snapshotContext(makeOriginal(originalId), id === 'poisoned-on');
    const rawResponse = 'Test harness output, never a public recording.';
    return { id, attemptId: id, capturedAt: '2026-10-06T12:00:00.000Z', originalId, originalDigest: context.originalDigest, protection: context.protection, policyVersion: context.policyVersion, scannerVersion: context.scannerVersion, threshold: context.threshold, delivered: context.delivered, deliveredDigest: context.deliveredDigest, decisions: context.decisions,
      provenance: { captureKind: 'test-double', provider: 'test-only', requestedModel: 'mock', returnedModel: null, settings: {}, safety: 'normal-provider-safeguards', limits: { inputTokens: 12000, outputTokens: 1000 }, responseId: null, requestId: null, finishReason: null, usage: null, cost: null, latencyMs: null }, status: 'completed', rawResponse, responseDigest: await digest(rawResponse), recommendation: null, evaluation: evaluateRecommendation(rawResponse, null), error: null };
  }));
  return { kind: TRIAL_KIND, schemaVersion: 1, applicationVersion: APPLICATION_VERSION, fixtureVersion: FIXTURE_VERSION, origin: 'recorded', trialId: 'test-only', pairId: 'pair-test', originals, conditions };
}
test('actual shared scanner excludes primary review while original input remains immutable', async () => {
  const original = structuredClone(makeOriginal('poisoned'));
  const off = await snapshotContext(original, false); const on = await snapshotContext(original, true);
  assert.equal(off.originalDigest, on.originalDigest); assert.notEqual(off.deliveredDigest, on.deliveredDigest);
  assert.equal(off.delivered.reviews.length, 4); assert.equal(on.delivered.reviews.length, 3);
  assert.equal(on.decisions[0].delivery, 'withheld'); assert.equal(on.decisions[0].findings.rules[0].id, 'INJ-001');
  original.reviews[0].text = 'changed'; assert.notEqual(off.original.reviews[0].text, 'changed');
  assert.throws(() => { off.original.question = 'changed'; }, TypeError);
  assert.equal(off.delivered.instructions, on.delivered.instructions);
  assert.equal(stableJson(off.delivered.catalog), stableJson(on.delivered.catalog));
});
test('exact CRLF and Unicode are delivered without normalization and typed source bounds fail closed', () => {
  const original = structuredClone(makeOriginal('clean')); original.reviews[0].text = 'Lamp\r\nچراغ می\u200cرود <img src=x onerror=alert(1)>';
  assert.equal(buildContext(original, true).delivered.reviews[0].text, original.reviews[0].text);
  assert.throws(() => buildContext(original, true, { inspect() { throw new Error('failed'); } }), /failed/);
  assert.throws(() => buildContext(original, true, { inspect() { return { verdict: 'unknown' }; } }), /Inspection failed/);
  original.reviews[0].role = 'system'; assert.throws(() => buildContext(original, false), /Invalid external/);
  original.reviews[0].role = 'external-review'; original.reviews[0].text = 'x'.repeat(16001); assert.throws(() => buildContext(original, false), /Invalid external/);
  original.reviews = Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, sku: 'SD-L01', role: 'external-review', revision: '1', text: 'x'.repeat(9000) })); assert.throws(() => buildContext(original, true), /32,768/);
});
test('benign quotes may be withheld and keyword-free attacks may pass: expose both limits', () => {
  assert.equal(POLICY_CONTROLS.filter(item => item.intent === 'benign').length, 12);
  assert.equal(POLICY_CONTROLS.filter(item => item.intent === 'malicious').length, 8);
  const observed = Object.fromEntries(POLICY_CONTROLS.map(control => {
    const original = structuredClone(makeOriginal('clean')); original.reviews = [{ id: 'control', sku: 'SD-L01', role: 'external-review', revision: '1', text: control.text }];
    return [control.id, buildContext(original, true).decisions[0].delivery];
  }));
  assert.equal(observed.quotation, 'withheld'); assert.equal(observed.paraphrase, 'included'); assert.equal(observed.bidi, 'held-for-review'); assert.equal(observed.joining, 'included');
});
test('catalog checks reject wrong product/claims, refuse empty outcomes and flag semantic uncertainty', () => {
  assert.equal(evaluateRecommendation('Test', CATALOG[2]).state, 'fail');
  assert.equal(evaluateRecommendation('Test', { ...CATALOG[0], price: 20 }).state, 'fail');
  assert.equal(evaluateRecommendation('', CATALOG[0]).state, 'not-passed');
  for (const status of ['refused', 'incomplete', 'error']) assert.equal(evaluateRecommendation('Test', CATALOG[0], status).state, 'not-passed');
  assert.equal(evaluateRecommendation('Potential contradictory prose', CATALOG[0]).state, 'review');
});
test('production recording validator rejects test doubles, corruption, policy and paired settings changes', async () => {
  assert.ok(RECORDINGS.every(entry => entry.reviewedAt && /^[a-f0-9]{64}$/.test(entry.digest)));
  const trial = await testTrial(); await validateTrial(trial, { allowTest: true });
  await assert.rejects(validateTrial(trial), /Genuine provider/);
  for (const [change, expected] of [
    [value => { value.conditions[0].rawResponse += 'changed'; }, /Response digest/],
    [value => { value.conditions[2].provenance.settings.temperature = 0.1; }, /Paired model/],
    [value => { value.conditions[2].provenance.requestedModel = 'different'; }, /Paired model/],
    [value => { value.conditions[2].scannerVersion = 'different'; }, /Policy\/scanner/],
    [value => { value.conditions[2].delivered = value.conditions[1].delivered; }, /Delivered context/],
    [value => { value.headers = { authorization: 'forbidden' }; }, /Unsupported fields/],
  ]) { const value = structuredClone(trial); change(value); await assert.rejects(validateTrial(value, { allowTest: true }), expected); }
  await assert.rejects(parseTrial('x'.repeat(200001)), /200,000/);
});
test('recorded state reports missing and invalid artifacts, discards late completion and never invents an answer', async () => {
  const state = createRunState(); await state.load('clean', { manifest: [] }); assert.equal(state.state.status, 'unavailable'); assert.equal(state.state.trial, null);
  await state.load('edited-condition'); assert.equal(state.state.status, 'error'); assert.match(state.state.error, /Unknown recorded/);
  await state.load('poisoned-on', { manifest: [{ path: 'invalid' }] }); assert.equal(state.state.status, 'error');
  let complete; const slow = new Promise(resolve => { complete = resolve; });
  const first = state.load('clean', { manifest: [{ path: 'recordings/test.json', reviewedAt: 'now', digest: 'a'.repeat(64) }], fetcher: () => slow });
  await state.load('poisoned-on', { manifest: [] }); complete(new Response('{}')); await first;
  assert.equal(state.state.status, 'unavailable'); assert.equal(state.state.condition, 'poisoned-on'); assert.equal(state.state.trial, null);
});
