import { CHAT_VERSION, validChatInput, chatContext } from '../src/shop_chat_contract.js';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { CATALOG, FIXTURE_VERSION, QUESTION, reviewsFor } from '../src/shop_fixtures.js';
import { makeOriginal, snapshotContext } from '../src/context_policy.js';
import { evaluateRecommendation } from '../src/shop_trial.js';

const UNAVAILABLE = 'Live requests are not configured. Provider, model, credential use, retention and spending require explicit authorization. No model request was made.';
export function createShopServer({ testProvider = null, timeoutMs = 2000, rateLimit = 12, rateWindowMs = 60000, maxAttempts = 100, maxConcurrent = 2 } = {}) {
  if (testProvider && (testProvider.kind !== 'test-double' || typeof testProvider.generate !== 'function' || typeof testProvider.countInputTokens !== 'function' || typeof testProvider.countOutputTokens !== 'function')) throw new Error('Only an explicit test-double adapter is supported. Real providers are not activated.');
  for (const value of [timeoutMs, rateLimit, rateWindowMs, maxAttempts, maxConcurrent]) if (!Number.isSafeInteger(value) || value < 1) throw new Error('Server bounds must be positive integers.');
  let active = 0; let attempts = 0; let timestamps = [];
  const controllers = new Set();
  const reply = (response, status, data) => {
    if (response.destroyed || response.writableEnded) return;
    const body = JSON.stringify(data);
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-length': Buffer.byteLength(body) });
    response.end(body);
  };
  const server = http.createServer(async (request, response) => {
    const port = server.address()?.port;
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const allowedOrigins = new Set([...allowedHosts].map(host => `http://${host}`));
    if (!allowedHosts.has(request.headers.host) || request.headers.origin && !allowedOrigins.has(request.headers.origin) || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) { reply(response, 403, { error: 'Loopback same-origin access only.' }); return; }
    const path = request.url;
    if (request.method === 'GET' && path === '/api/shop/status') { reply(response, 200, { available: false, reason: UNAVAILABLE, fixtureVersion: FIXTURE_VERSION, scope: 'loopback-only', testOnly: Boolean(testProvider) }); return; }
    if (request.method === 'GET' && path === '/api/shop/catalog') { reply(response, 200, { fixtureVersion: FIXTURE_VERSION, question: QUESTION, products: CATALOG, reviews: { clean: reviewsFor('clean'), poisoned: reviewsFor('poisoned') } }); return; }
    if (request.method !== 'POST' || !['/api/shop/run','/api/shop/chat'].includes(path)) { reply(response, 404, { error: 'Unknown local shop endpoint.' }); return; }
    const now = Date.now(); timestamps = timestamps.filter(time => now - time < rateWindowMs);
    if (timestamps.length >= rateLimit) { response.setHeader('retry-after', String(Math.ceil(rateWindowMs / 1000))); reply(response, 429, { error: 'Local request rate exceeded.' }); return; }
    timestamps.push(now);
    if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) { reply(response, 415, { error: 'Use application/json.' }); return; }
    if (Number(request.headers['content-length']) > 8192) { reply(response, 413, { error: 'Request exceeds 8,192 bytes.' }); request.resume(); return; }
    let timer; let controller;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of request) { size += chunk.length; if (size > 8192) { reply(response, 413, { error: 'Request exceeds 8,192 bytes.' }); return; } chunks.push(chunk); }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reply(response, 400, { error: 'Invalid JSON.' }); return; }
      const chat = path === '/api/shop/chat';
      if (chat ? !validChatInput(input) : !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['fixtureVersion', 'question', 'condition', 'runId'].includes(key)) || input.fixtureVersion !== FIXTURE_VERSION || input.question !== QUESTION || !['clean', 'poisoned-off', 'poisoned-on'].includes(input.condition) || typeof input.runId !== 'string' || !/^[\w-]{1,80}$/.test(input.runId)) { reply(response, 400, { error: 'Use the versioned fixed fixture, supported question, condition and bounded runId. Client source lists and instructions are rejected.' }); return; }
      // The server reconstructs all trusted fields and enforces policy itself.
      const prepared = chat ? await chatContext(input) : null;
      const context = prepared?.context ?? await snapshotContext(makeOriginal(input.condition === 'clean' ? 'clean' : 'poisoned'), input.condition === 'poisoned-on');
      if (!testProvider) { reply(response, 503, { runId: input.runId, available: false, error: UNAVAILABLE, context }); return; }
      if (active >= maxConcurrent || attempts >= maxAttempts) { reply(response, 429, { error: 'Local concurrency or attempt cap reached.' }); return; }
      const limits = Object.freeze({ inputTokens: 12000, outputTokens: 1000 });
      const tokens = testProvider.countInputTokens(prepared?.messages ?? context.delivered);
      if (!Number.isSafeInteger(tokens) || tokens < 0 || tokens > limits.inputTokens) { reply(response, 413, { error: 'Adapter input token bound exceeded.' }); return; }
      active++; attempts++; controller = new AbortController(); controllers.add(controller);
      const closed = () => { if (!response.writableEnded) controller.abort(); };
      response.once('close', closed);
      const result = await Promise.race([
        testProvider.generate(context, { signal: controller.signal, limits, messages: prepared?.messages }),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Adapter timeout.')); }, timeoutMs); }),
      ]);
      if (!result || Object.keys(result).some(key => !['status', 'rawResponse', 'recommendation'].includes(key)) || !['completed', 'refused', 'incomplete', 'error'].includes(result.status) || typeof result.rawResponse !== 'string' || result.rawResponse.length > 16000 || Buffer.byteLength(JSON.stringify(result)) > 32000) throw new Error('Invalid bounded adapter response.');
      const outputTokens = testProvider.countOutputTokens(result.rawResponse);
      if (!Number.isSafeInteger(outputTokens) || outputTokens < 0 || outputTokens > limits.outputTokens) throw new Error('Adapter output token bound exceeded.');
      if (chat) { reply(response, 200, { chatVersion: CHAT_VERSION, fixtureVersion: FIXTURE_VERSION, runId: input.runId, question: input.question, condition: input.condition, history: input.history, origin: 'test-double', testOnly: true, status: result.status, rawResponse: result.rawResponse, context, provenance: {captureKind:'test-double',provider:'Local mocked provider; no model request'}, error:null }); return; }
      reply(response, 200, { runId: input.runId, origin: 'test-double', testOnly: true, context, outcome: result, evaluation: evaluateRecommendation(result.rawResponse, result.recommendation, result.status) });
    } catch (error) { reply(response, error.message === 'Adapter timeout.' ? 504 : 502, { error: error.message === 'Adapter timeout.' ? error.message : 'Local adapter failed. No successful model outcome recorded.' }); }
    finally { clearTimeout(timer); if (controller) { active--; controllers.delete(controller); } }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.timeout = 6000; server.maxHeadersCount = 32;
  return {
    listen(port = 8787, host = '127.0.0.1') {
      if (host !== '127.0.0.1') throw new Error('The local shop service must bind to 127.0.0.1.');
      return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.removeListener('error', reject); resolve(server.address()); }); });
    },
    address: () => server.address(),
    close() { controllers.forEach(controller => controller.abort()); server.closeIdleConnections(); return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const service = createShopServer();
  const address = await service.listen();
  console.log(`Shelfday local catalog: http://127.0.0.1:${address.port}/api/shop/catalog`);
  console.log(UNAVAILABLE);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await service.close(); process.exit(0); });
}
