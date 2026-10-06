import { RECORDINGS } from './recordings.js';
import { parseTrial, MAX_TRIAL_BYTES } from './shop_trial.js';

export function createRunState() {
  let revision = 0;
  let controller;
  const state = { status: 'unavailable', condition: 'clean', trial: null, error: null };
  return {
    state,
    cancel() { revision++; controller?.abort(); state.status = state.trial ? 'ready' : 'unavailable'; },
    async load(condition, { manifest = RECORDINGS, fetcher = fetch } = {}) {
      this.cancel(); const request = revision;
      state.condition = condition; state.error = null;
      if (!['clean', 'poisoned-off', 'poisoned-on'].includes(condition)) { state.trial = null; state.status = 'error'; state.error = 'Unknown recorded condition.'; return; }
      const entry = manifest[0];
      if (!entry) { state.trial = null; state.status = 'unavailable'; return; }
      state.status = 'loading'; controller = new AbortController();
      try {
        if (!entry.reviewedAt || !/^[a-f0-9]{64}$/.test(entry.digest) || !/^recordings\/[\w-]+\.json$/.test(entry.path)) throw new Error('Recording manifest is not reviewed or valid.');
        const response = await fetcher((import.meta.env?.BASE_URL ?? '/shadowprompt/') + entry.path, { signal: controller.signal });
        if (!response.ok) throw new Error('Recording file is unavailable.');
        const declaredSize = Number(response.headers.get('content-length'));
        if (declaredSize > MAX_TRIAL_BYTES) throw new Error('Recording exceeds the file limit.');
        const reader = response.body.getReader(); let size = 0; const chunks = [];
        while (true) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > MAX_TRIAL_BYTES) { await reader.cancel(); throw new Error('Recording exceeds the file limit.'); } chunks.push(item.value); }
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const trial = await parseTrial(new TextDecoder('utf-8', { fatal: true }).decode(bytes), { expectedDigest: entry.digest });
        if (trial.origin !== 'recorded' || trial.trialId !== entry.trialId) throw new Error('Recording origin or identity mismatch.');
        if (request === revision) { state.trial = trial; state.status = 'ready'; }
      } catch (error) {
        if (request === revision) { state.trial = null; state.status = 'error'; state.error = error.message; }
      }
    },
  };
}

export const HOSTED_SHOP_URL = 'https://shadowprompt-shelfday.pjmitchell.workers.dev/';
export function recordingAvailability(hasRecording) {
  return hasRecording
    ? { title: 'Recording ready to replay', detail: 'A reviewed genuine model recording is available. Start the guide or choose a recorded run to view it. No new model request is made.' }
    : { title: 'Recording not available', detail: 'No model answer has been recorded yet. You can still shop and compare which review text Pip would receive.' };
}
export function staticLiveNotice(hasRecording) {
  return `${hasRecording ? 'Recorded replay is available here.' : 'No reviewed recording is available here.'} New live comparisons run on the hosted Cloudflare demo. This page makes no live model requests. `;
}
