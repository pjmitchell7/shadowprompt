import { APPLICATION_VERSION, freeze } from './context_policy.js';
import { FIXTURE_VERSION, QUESTION } from './shop_fixtures.js';
import { WORKERS_MODEL, WORKERS_VERSION } from './cloud_contract.js';
import { TRIAL_KIND, MAX_TRIAL_BYTES, validateTrial, validateLiveEnvelope } from './shop_trial.js';

export const LIVE_CONDITIONS = Object.freeze(['clean', 'poisoned-off', 'poisoned-on']);
const STOPPED = 'Stopped waiting in this tab. A request already sent may still finish at the provider. No automatic retry was made.';
async function readJson(response, signal, maximum = MAX_TRIAL_BYTES) {
  if (Number(response.headers.get('content-length')) > maximum) throw new Error('Live response exceeds its byte limit.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Live response has no readable body.');
  let size = 0; const chunks = [];
  while (true) {
    if (signal.aborted) { await reader.cancel(); throw new DOMException('Aborted', 'AbortError'); }
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength; if (size > maximum) { await reader.cancel(); throw new Error('Live response exceeds its byte limit.'); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(bytes)); } catch { throw new Error('Live response is not valid UTF-8 JSON.'); }
}
export function createLiveState({ fetcher = fetch, testOnly = false, timeoutMs = 25000 } = {}) {
  if (typeof testOnly !== 'boolean' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('Invalid live client test flag or deadline.');
  let revision = 0; let controller;
  const state = { status: 'unavailable', available: false, reason: 'Cloudflare Free account verification and hosted activation are pending. No model request has been made.', error: null, condition: 'poisoned-on', captures: Object.freeze([]), attempts: Object.freeze([]), trial: null, progress: null };
  async function request(path, options, signal, maximum) {
    const local = new AbortController(); let timer; let timedOut = false;
    const stop = () => local.abort(); signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) local.abort();
    try {
      return await Promise.race([
        (async () => { const response = await fetcher(path, { ...options, signal: local.signal, cache: 'no-store', credentials: 'omit' }); return { response, body: await readJson(response, local.signal, maximum) }; })(),
        new Promise((_, reject) => { timer = setTimeout(() => { timedOut = true; local.abort(); reject(new Error('Client response deadline expired. A request already sent may still finish at the provider. No automatic retry was made.')); }, timeoutMs); }),
        new Promise((_, reject) => { local.signal.addEventListener('abort', () => { if (!timedOut) reject(new DOMException('Aborted', 'AbortError')); }, { once: true }); }),
      ]);
    } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); }
  }
  const api = {
    state,
    testOnly,
    select(condition) { if (!LIVE_CONDITIONS.includes(condition)) throw new Error('Unknown live condition.'); state.condition = condition; },
    cancel() {
      revision++; controller?.abort();
      if (state.status === 'loading') { state.status = 'cancelled'; state.error = STOPPED; state.progress = null; }
    },
    async check(onChange = () => {}) {
      api.cancel(); const current = revision; controller = new AbortController();
      state.available = false; state.reason = 'Checking hosted live availability. No model request is made.'; onChange();
      try {
        const { response, body } = await request('/api/shop/status', { method: 'GET' }, controller.signal, 8192);
        if (current !== revision) return;
        if (!response.ok || !body || body.scope !== 'workers-free' || body.testOnly !== testOnly || body.fixtureVersion !== FIXTURE_VERSION || body.applicationVersion !== APPLICATION_VERSION || body.workerVersion !== WORKERS_VERSION || body.model !== WORKERS_MODEL || typeof body.available !== 'boolean' || typeof body.reason !== 'string' || body.reason.length > 2000) throw new Error('Hosted availability could not be verified for the approved model and fixture.');
        state.available = body.available; state.reason = body.reason;
      } catch (error) { if (current === revision) state.reason = error.name === 'AbortError' ? 'Availability check stopped.' : 'Hosted live mode is unavailable or could not be verified. No model request was made.'; }
      if (current === revision) onChange();
    },
    async start(onChange = () => {}) {
      if (!state.available || state.status === 'loading') return;
      api.cancel(); const current = revision; controller = new AbortController();
      state.status = 'loading'; state.error = null; state.trial = null; state.captures = Object.freeze([]); state.attempts = Object.freeze([]);
      const trialId = crypto.randomUUID(); const pairId = crypto.randomUUID();
      try {
        for (const condition of LIVE_CONDITIONS) {
          if (current !== revision) return;
          state.progress = `Request ${state.captures.length + 1} of 3: ${condition === 'clean' ? 'clean reviews' : condition === 'poisoned-off' ? 'poisoned reviews / filtering Off' : 'poisoned reviews / filtering On'}.`; onChange();
          const runId = crypto.randomUUID();
          state.attempts = freeze([...state.attempts, { condition, runId, requestedAt: new Date().toISOString() }]);
          const { response, body } = await request('/api/shop/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fixtureVersion: FIXTURE_VERSION, question: QUESTION, condition, runId }) }, controller.signal, MAX_TRIAL_BYTES);
          if (current !== revision) return;
          if (!body?.run) {
            if (['free-quota-exhausted', 'paid-plan-required'].includes(body?.errorCode)) {
              state.status = body.errorCode === 'free-quota-exhausted' ? 'quota' : 'error'; state.available = false;
              state.error = body.errorCode === 'free-quota-exhausted' ? 'The shared daily free allowance is exhausted. No paid fallback or automatic retry is used.' : 'The provider requires a paid plan. Live mode is disabled; no upgrade or fallback is permitted.';
              state.reason = state.error; state.progress = null; onChange(); return;
            }
            throw new Error(response.status === 429 ? 'The demo request limit was reached. No automatic retry was made.' : 'The hosted request was unavailable before a model outcome could be verified. No automatic retry was made.');
          }
          const capture = await validateLiveEnvelope(body, { expectedRunId: runId, expectedCondition: condition, allowTest: testOnly });
          if (current !== revision) return;
          state.captures = freeze([...state.captures, capture]);
          if (!response.ok || capture.run.status === 'error') {
            state.status = capture.errorCode === 'free-quota-exhausted' ? 'quota' : capture.errorCode === 'deadline-exceeded' ? 'timeout' : 'error';
            state.error = capture.error || 'Live request failed.';
            if (['free-quota-exhausted', 'paid-plan-required'].includes(capture.errorCode)) { state.available = false; state.reason = state.error; }
            state.progress = null; onChange(); return;
          }
        }
        const originals = state.captures.slice(0, 2).map(capture => capture.original);
        const trial = await validateTrial({ kind: TRIAL_KIND, schemaVersion: 1, applicationVersion: APPLICATION_VERSION, fixtureVersion: FIXTURE_VERSION, origin: 'live', trialId, pairId, originals, conditions: state.captures.map(capture => capture.run) }, { allowTest: testOnly });
        if (current !== revision) return;
        state.trial = trial; state.status = 'ready'; state.progress = null; onChange();
      } catch (error) {
        if (current !== revision) return;
        state.status = error.name === 'AbortError' ? 'cancelled' : /deadline/i.test(error.message) ? 'timeout' : 'error';
        state.error = error.name === 'AbortError' ? STOPPED : error.message; state.progress = null; onChange();
      }
    },
    exportPartial() {
      if (!state.attempts.length || state.trial) throw new Error('No incomplete live attempt is available.');
      return { kind: testOnly ? 'shadowprompt.test-only-incomplete-attempt' : 'shadowprompt.incomplete-live-attempt', schemaVersion: 1, modelRequest: testOnly ? false : state.captures.length ? true : null, testOnly, completeComparison: false, applicationVersion: APPLICATION_VERSION, fixtureVersion: FIXTURE_VERSION, requestedAttempts: state.attempts, captures: state.captures, noVerifiedReturn: state.attempts.filter(attempt => !state.captures.some(capture => capture.run.attemptId === attempt.runId)), notRequested: LIVE_CONDITIONS.filter(id => !state.attempts.some(attempt => attempt.condition === id)), stopReason: state.error };
    },
  };
  return Object.freeze(api);
}
