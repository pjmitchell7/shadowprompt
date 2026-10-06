import { readFile, readdir } from 'node:fs/promises';
import { RECORDINGS } from '../src/recordings.js';
import { parseTrial } from '../src/shop_trial.js';

let recordingFiles = [];
try { recordingFiles = await readdir(new URL('../public/recordings/', import.meta.url)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (recordingFiles.some(name => !RECORDINGS.some(entry => entry.path === 'recordings/' + name))) throw new Error('Unlisted recording asset would enter the production build.');

for (const entry of RECORDINGS) {
  if (!entry.reviewedAt || !/^[a-f0-9]{64}$/.test(entry.digest) || !/^recordings\/[\w-]+\.json$/.test(entry.path)) throw new Error('Unreviewed recording manifest entry.');
  const trial = await parseTrial(await readFile(new URL('../public/' + entry.path, import.meta.url), 'utf8'), { expectedDigest: entry.digest });
  if (trial.origin !== 'recorded' || trial.trialId !== entry.trialId) throw new Error('Invalid recording identity.');
}
console.log(`Recording gate passed: ${RECORDINGS.length} reviewed genuine captures. No authored answer fallback.`);
