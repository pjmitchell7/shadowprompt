import { inspectPayload } from './inspection.js';
import { CATALOG, CATALOG_VERSION, FIXTURE_VERSION, QUESTION, TRUSTED_INSTRUCTIONS, reviewsFor } from './shop_fixtures.js';

export const POLICY_VERSION = 'shop-policy-1';
export const SCANNER_VERSION = 'js-801b2c2';
export const APPLICATION_VERSION = 'shelfday-local-1';
export function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export async function digest(value) {
  const bytes = new TextEncoder().encode(stableJson(value));
  const result = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(result)].map(item => item.toString(16).padStart(2, '0')).join('');
}
export function validateOriginal(original) {
  if (!original || typeof original.question !== 'string' || !original.question.trim() || original.question.length > 4000) throw new Error('Question must be nonempty text of at most 4,000 code units.');
  if (!Array.isArray(original.reviews) || original.reviews.length > 4) throw new Error('At most four review sources are supported.');
  const ids = new Set();
  let total = 0;
  for (const source of original.reviews) {
    if (!source || typeof source.id !== 'string' || !/^[\w-]{1,80}$/.test(source.id) || ids.has(source.id) || source.role !== 'external-review' || !CATALOG.some(item => item.sku === source.sku) || typeof source.revision !== 'string' || source.revision.length > 80 || typeof source.text !== 'string' || source.text.length > 16000) throw new Error('Invalid external review source.');
    ids.add(source.id); total += source.text.length;
  }
  if (total > 32768) throw new Error('Reviews exceed 32,768 code units total.');
  if (original.instructions !== TRUSTED_INSTRUCTIONS || stableJson(original.catalog) !== stableJson(CATALOG) || original.fixtureVersion !== FIXTURE_VERSION || original.catalogVersion !== CATALOG_VERSION) throw new Error('Trusted instructions or catalog version mismatch.');
  return original;
}
export function makeOriginal(condition = 'poisoned') {
  return freeze({ question: QUESTION, instructions: TRUSTED_INSTRUCTIONS, catalog: CATALOG, reviews: reviewsFor(condition), fixtureVersion: FIXTURE_VERSION, catalogVersion: CATALOG_VERSION });
}
export function buildContext(original, protection, { inspect = inspectPayload, threshold = 0.72 } = {}) {
  validateOriginal(original);
  if (typeof protection !== 'boolean' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Invalid context policy settings.');
  // Clone exact source strings. Normalized scanner text is never forwarded.
  const snapshot = structuredClone(original);
  const decisions = snapshot.reviews.map(source => {
    const findings = inspect(source.text, { history: [], threshold });
    if (!findings || !['quarantine', 'review', 'no-match'].includes(findings.verdict) || !Array.isArray(findings.rules)) throw new Error('Inspection failed. Protected context is unavailable.');
    const delivery = !protection || findings.verdict === 'no-match' ? 'included' : findings.verdict === 'review' ? 'held-for-review' : 'withheld';
    return { sourceId: source.id, delivery, enforced: protection, findings };
  });
  const delivered = { instructions: snapshot.instructions, question: snapshot.question, catalog: snapshot.catalog, reviews: snapshot.reviews.filter(source => decisions.find(item => item.sourceId === source.id).delivery === 'included') };
  return freeze({ original: snapshot, protection, policyVersion: POLICY_VERSION, scannerVersion: SCANNER_VERSION, threshold, decisions, delivered });
}
export async function snapshotContext(original, protection, options) {
  const context = buildContext(original, protection, options);
  return freeze({ ...context, originalDigest: await digest(context.original), deliveredDigest: await digest(context.delivered) });
}
export function comparableDecisions(decisions) {
  return decisions.map(({ sourceId, delivery, enforced, findings }) => ({ sourceId, delivery, enforced, verdict: findings.verdict, rules: findings.rules, normalized: findings.normalized, raw: findings.raw, threshold: findings.threshold }));
}
