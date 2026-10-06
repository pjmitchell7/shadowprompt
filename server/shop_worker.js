import { CATALOG, FIXTURE_VERSION, QUESTION, reviewsFor } from '../src/shop_fixtures.js';
import { APPLICATION_VERSION, digest, makeOriginal, snapshotContext } from '../src/context_policy.js';
import { evaluateRecommendation } from '../src/shop_trial.js';
import { WORKERS_MODEL, WORKERS_VERSION, MODEL_SETTINGS, MODEL_LIMITS } from '../src/cloud_contract.js';

export { WORKERS_MODEL, WORKERS_VERSION, MODEL_SETTINGS };
const LIMITS = MODEL_LIMITS;
const UNAVAILABLE = 'Cloud live mode is unavailable until the selected Cloudflare account is verified on Workers Free and deployment is explicitly activated. No model request was made.';
const encoder = new TextEncoder();
const reply = (status, data, extra = {}) => Response.json(data, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra } });
const validInput = input => input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).every(key => ['fixtureVersion', 'question', 'condition', 'runId'].includes(key)) && input.fixtureVersion === FIXTURE_VERSION && input.question === QUESTION && ['clean', 'poisoned-off', 'poisoned-on'].includes(input.condition) && typeof input.runId === 'string' && /^[\w-]{1,80}$/.test(input.runId);

async function readInput(request, timeoutMs) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) throw { http: 415, message: 'Use application/json.' };
  if (Number(request.headers.get('content-length')) > 8192) throw { http: 413, message: 'Request exceeds 8,192 bytes.' };
  const reader = request.body?.getReader();
  if (!reader) throw { http: 400, message: 'A JSON fixture request is required.' };
  let timer;
  try {
    const reading = (async () => {
      let size = 0; const chunks = [];
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > 8192) { await reader.cancel(); throw { http: 413, message: 'Request exceeds 8,192 bytes.' }; }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
      let input;
      try { input = JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(bytes)); } catch { throw { http: 400, message: 'Invalid UTF-8 JSON.' }; }
      if (!validInput(input)) throw { http: 400, message: 'Use the versioned fixed fixture, supported condition and bounded runId. Client prompts, sources, models, tools and URLs are rejected.' };
      return input;
    })();
    return await Promise.race([reading, new Promise((_, reject) => { timer = setTimeout(() => { reader.cancel().catch(() => {}); reject({ http: 408, message: 'Request body deadline exceeded.' }); }, timeoutMs); })]);
  } finally { clearTimeout(timer); }
}
function parseRecommendation(raw) {
  let value;
  try { value = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['sku', 'price', 'connector', 'mount', 'explanation'].includes(key)) || typeof value.sku !== 'string' || typeof value.price !== 'number' || typeof value.connector !== 'string' || typeof value.mount !== 'string' || typeof value.explanation !== 'string' || value.explanation.length > 4000) return null;
  return value;
}
function usageFor(result) {
  const counts = [result.usage?.prompt_tokens, result.usage?.completion_tokens, result.usage?.total_tokens];
  if (counts.some(value => !Number.isSafeInteger(value) || value < 0)) return null;
  return { inputTokens: counts[0], outputTokens: counts[1], totalTokens: counts[2] };
}
function providerFailure(error) {
  const code = String(error?.code ?? '');
  if (code === '3036' || /\b3036\b/.test(String(error?.message))) return { http: 429, message: 'Cloudflare daily free AI allocation is exhausted. Live requests stop until the quota resets; no paid fallback or automatic retry is used.', code: 'free-quota-exhausted' };
  if (code === '5035') return { http: 503, message: 'The provider requires a paid plan. Live requests remain unavailable; no upgrade or paid fallback is permitted.', code: 'paid-plan-required' };
  if (code === '3040') return { http: 503, message: 'The model is temporarily at capacity. No automatic retry was made.', code: 'capacity-unavailable' };
  if (code === 'deadline') return { http: 504, message: 'The model response deadline expired. The provider may still be running; no automatic retry was made.', code: 'deadline-exceeded' };
  return { http: 502, message: 'The provider returned an unavailable or invalid outcome. No successful model answer was recorded and no automatic retry was made.', code: 'provider-unavailable' };
}

// Uses only Web APIs and the same immutable fixtures/scanner as the local service.
// Isolate counters are best-effort abuse controls, not global quota accounting.
export function createShopWorker({ testOnly = false, timeoutMs = 20000, bodyTimeoutMs = 2000, rateLimit = 6, maxConcurrent = 2, maxAttempts = 100 } = {}) {
  if (typeof testOnly !== 'boolean') throw new Error('Test provenance must be an explicit boolean.');
  for (const value of [timeoutMs, bodyTimeoutMs, rateLimit, maxConcurrent, maxAttempts]) if (!Number.isSafeInteger(value) || value < 1) throw new Error('Worker bounds must be positive integers.');
  let active = 0; let attempts = 0; let quotaUntil = 0; let paidBlocked = false; const clients = new Map();
  const ready = env => env.FREE_ACCOUNT_VERIFIED === 'true' && env.LIVE_ENABLED === 'true' && typeof env.AI?.run === 'function' && Date.now() >= quotaUntil && !paidBlocked && attempts < maxAttempts;
  const unavailableReason = () => Date.now() < quotaUntil ? 'The shared daily free AI allocation is exhausted. Live requests are paused until 00:00 UTC; no paid fallback is used.' : paidBlocked ? 'The provider requires a paid plan. Live requests are disabled pending verification; no upgrade or fallback is permitted.' : attempts >= maxAttempts ? 'This demo worker has reached its local attempt cap. Live requests are unavailable.' : UNAVAILABLE;
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/')) {
        return env.ASSETS?.fetch ? env.ASSETS.fetch(request) : reply(404, { error: 'Static asset binding is unavailable.' });
      }
      // Origin checks prevent browser cross-origin use; they are not authentication.
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || request.headers.get('origin') && request.headers.get('origin') !== url.origin || ['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site'))) return reply(403, { error: 'Use the deployed HTTPS same-origin Workers site.' });
      if (request.method === 'GET' && url.pathname === '/api/shop/status') return reply(200, { available: ready(env), reason: ready(env) ? 'Fixed-fixture Workers AI demo on a verified Free account; shared daily limits can make it temporarily unavailable.' : unavailableReason(), fixtureVersion: FIXTURE_VERSION, applicationVersion: APPLICATION_VERSION, workerVersion: WORKERS_VERSION, model: WORKERS_MODEL, scope: 'workers-free', testOnly });
      if (request.method === 'GET' && url.pathname === '/api/shop/catalog') return reply(200, { fixtureVersion: FIXTURE_VERSION, question: QUESTION, products: CATALOG, reviews: { clean: reviewsFor('clean'), poisoned: reviewsFor('poisoned') } });
      if (request.method !== 'POST' || url.pathname !== '/api/shop/run' || url.search) return reply(404, { error: 'Unknown shop endpoint.' });
      if (!ready(env)) return reply(attempts >= maxAttempts || Date.now() < quotaUntil ? 429 : 503, { available: false, error: unavailableReason(), errorCode: Date.now() < quotaUntil ? 'free-quota-exhausted' : paidBlocked ? 'paid-plan-required' : null });
      // Cloudflare supplies this header at the edge. Retain only an ephemeral hash.
      const peer = request.headers.get('cf-connecting-ip');
      if (!peer || peer.length > 80) return reply(403, { error: 'Trusted edge client metadata is required.' });
      const now = Date.now(); const key = await digest(peer);
      for (const [id, times] of clients) if (!times.some(time => time > now - 60000)) clients.delete(id);
      if (!clients.has(key) && clients.size >= 1024) return reply(429, { error: 'Local abuse-control capacity reached.' }, { 'retry-after': '60' });
      const times = (clients.get(key) || []).filter(time => time > now - 60000);
      if (times.length >= rateLimit) return reply(429, { error: 'Demo request rate reached.' }, { 'retry-after': '60' });
      times.push(now); clients.set(key, times);
      let input;
      try { input = await readInput(request, bodyTimeoutMs); } catch (error) { return reply(error.http || 400, { error: error.message || 'Invalid fixture request.' }); }
      if (active >= maxConcurrent || attempts >= maxAttempts) return reply(429, { error: 'Demo concurrency or isolate attempt cap reached.' });
      const context = await snapshotContext(makeOriginal(input.condition === 'clean' ? 'clean' : 'poisoned'), input.condition === 'poisoned-on');
      const messages = [
        { role: 'system', content: context.delivered.instructions },
        { role: 'user', content: JSON.stringify({ question: context.delivered.question, catalog: context.delivered.catalog, reviews: context.delivered.reviews }) },
      ];
      // The fixed UTF-8 payload is far below the model context limit. Allow a
      // conservative byte-per-token ceiling plus 512 tokens for chat framing.
      if (encoder.encode(JSON.stringify(messages)).byteLength + 512 > LIMITS.inputTokens) return reply(413, { error: 'Fixed model input exceeds the conservative input bound.' });
      // Recheck after asynchronous context hashing, immediately before reserving.
      if (active >= maxConcurrent || attempts >= maxAttempts) return reply(429, { error: 'Demo concurrency or isolate attempt cap reached.' });
      active++; attempts++; const started = performance.now(); const capturedAt = new Date().toISOString(); let timer;
      // Do not release concurrency when a deadline fires: a binding request may
      // still run. Release only when its promise settles; never start a retry.
      const task = Promise.resolve().then(() => env.AI.run(WORKERS_MODEL, { ...MODEL_SETTINGS, messages }));
      task.then(() => { active--; }, () => { active--; });
      let rawResponse = null; let recommendation = null; let usage = null; let status = 'error'; let failure = null;
      try {
        const result = await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject({ code: 'deadline' }), timeoutMs); })]);
        if (!result || typeof result.response !== 'string' || result.response.length > 16000 || encoder.encode(result.response).byteLength > 32000) throw new Error('Invalid provider response.');
        usage = usageFor(result);
        if (usage && (usage.inputTokens > LIMITS.inputTokens || usage.outputTokens > LIMITS.outputTokens)) throw new Error('Provider token bound exceeded.');
        rawResponse = result.response; recommendation = parseRecommendation(rawResponse); status = rawResponse.trim() ? 'completed' : 'incomplete';
      } catch (error) {
        failure = providerFailure(error);
        if (failure.code === 'free-quota-exhausted') quotaUntil = (Math.floor(Date.now() / 86400000) + 1) * 86400000;
        if (failure.code === 'paid-plan-required') paidBlocked = true;
      }
      finally { clearTimeout(timer); }
      const provenance = { captureKind: testOnly ? 'test-double' : 'provider-capture', provider: testOnly ? 'Mock Cloudflare binding (no real model request)' : 'Cloudflare Workers AI', requestedModel: WORKERS_MODEL, returnedModel: null, settings: MODEL_SETTINGS, safety: 'normal-provider-safeguards', limits: LIMITS, responseId: null, requestId: null, finishReason: null, usage, cost: null, latencyMs: performance.now() - started };
      const run = { id: input.condition, attemptId: input.runId, capturedAt, originalId: input.condition === 'clean' ? 'clean' : 'poisoned', originalDigest: context.originalDigest, protection: context.protection, policyVersion: context.policyVersion, scannerVersion: context.scannerVersion, threshold: context.threshold, delivered: context.delivered, deliveredDigest: context.deliveredDigest, decisions: context.decisions, provenance, status, rawResponse, responseDigest: await digest(rawResponse), recommendation, evaluation: evaluateRecommendation(rawResponse, recommendation, status), error: failure?.message ?? null };
      return reply(failure?.http ?? 200, { runId: input.runId, origin: testOnly ? 'test-double' : 'live', testOnly, applicationVersion: APPLICATION_VERSION, workerVersion: WORKERS_VERSION, fixtureVersion: FIXTURE_VERSION, original: { id: run.originalId, input: context.original, digest: context.originalDigest }, run, error: failure?.message ?? null, errorCode: failure?.code ?? null });
    },
  };
}
export default createShopWorker();
