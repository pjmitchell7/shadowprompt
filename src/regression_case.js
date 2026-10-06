// Portable browser-local incident case. It does not run a model or fetch sources.
export const CASE_KIND = 'shadowprompt.regression-case';
export const CASE_VERSION = 1;
export const MAX_CASE_FILE_BYTES = 100_000;

const limits = {
  title: 160, question: 4_000, cleanContext: 16_000,
  poisonedContext: 16_000, attackerIntent: 2_000,
  sourceNotes: 4_000, model: 200, revision: 200, settings: 4_000,
  cleanResponse: 16_000, poisonedResponse: 16_000,
  requiredText: 4_000, forbiddenText: 4_000,
};

export function validateCase(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Case must be a JSON object.');
  if (value.kind !== CASE_KIND || value.schemaVersion !== CASE_VERSION) throw new Error('Unsupported case kind or version.');
  const allowed = new Set(['kind', 'schemaVersion', ...Object.keys(limits)]);
  if (Object.keys(value).some(key => !allowed.has(key))) throw new Error('Case contains unsupported fields.');
  const result = { kind: CASE_KIND, schemaVersion: CASE_VERSION };
  for (const [key, maximum] of Object.entries(limits)) {
    const item = value[key];
    if ((key === 'cleanResponse' || key === 'poisonedResponse') && item === null) {
      result[key] = null;
      continue;
    }
    if (typeof item !== 'string' || item.length > maximum) throw new Error(`${key} must be text of at most ${maximum} characters.`);
    result[key] = item;
  }
  for (const key of ['title', 'question', 'cleanContext', 'poisonedContext']) {
    if (!result[key].trim()) throw new Error(`${key} is required.`);
  }
  if (result.cleanContext === result.poisonedContext) throw new Error('Clean and poisoned context must differ.');
  if (new TextEncoder().encode(JSON.stringify(result, null, 2)).length > MAX_CASE_FILE_BYTES) {
    throw new Error('Case exceeds the exported file size limit.');
  }
  return result;
}

export function serializeCase(value) {
  return JSON.stringify(validateCase(value), null, 2);
}

export function parseCaseJson(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_CASE_FILE_BYTES) {
    throw new Error('Case file exceeds 100,000 bytes.');
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Case file is not valid JSON.'); }
  return validateCase(parsed);
}

export function checkResponse(response, requiredText, forbiddenText) {
  if (response === null) return { state: 'not-evaluated', reasons: ['No observed response supplied.'] };
  if (!response.trim()) return { state: 'fail', reasons: ['Observed response is empty.'] };
  if (!requiredText && !forbiddenText) return { state: 'not-evaluated', reasons: ['No literal response contract supplied.'] };
  const reasons = [];
  if (requiredText && !response.includes(requiredText)) reasons.push('Required literal text is absent.');
  if (forbiddenText && response.includes(forbiddenText)) reasons.push('Forbidden literal text is present.');
  return reasons.length ? { state: 'fail', reasons } : { state: 'pass', reasons: ['Literal text checks passed.'] };
}

export function compareCase(value) {
  const item = validateCase(value);
  return {
    clean: checkResponse(item.cleanResponse, item.requiredText, item.forbiddenText),
    poisoned: checkResponse(item.poisonedResponse, item.requiredText, item.forbiddenText),
  };
}

export function issueSummary(value) {
  const item = validateCase(value);
  const checks = compareCase(item);
  return [
    `# ${item.title}`,
    'Browser-local regression case; observed answers are user supplied. No model was called.',
    `Question:\n${item.question}`,
    `Attacker intent:\n${item.attackerIntent || '(not supplied)'}`,
    `Required literal text:\n${item.requiredText || '(none)'}`,
    `Forbidden literal text:\n${item.forbiddenText || '(none)'}`,
    `Model / revision / settings: ${item.model || '(not supplied)'} / ${item.revision || '(not supplied)'} / ${item.settings || '(not supplied)'}`,
    `Source notes:\n${item.sourceNotes || '(not supplied)'}`,
    `Clean context:\n${item.cleanContext}`,
    `Clean observed response: ${checks.clean.state}\n${item.cleanResponse ?? '(not supplied)'}`,
    `Poisoned context:\n${item.poisonedContext}`,
    `Poisoned observed response: ${checks.poisoned.state}\n${item.poisonedResponse ?? '(not supplied)'}`,
  ].join('\n\n');
}
