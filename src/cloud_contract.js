export const WORKERS_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
export const WORKERS_VERSION = 'shelfday-workers-1';
export const MODEL_SETTINGS = Object.freeze({ max_tokens: 256, temperature: 0.2, top_p: 0.9, seed: 1234, stream: false });
export const MODEL_LIMITS = Object.freeze({ inputTokens: 8192, outputTokens: 256 });
