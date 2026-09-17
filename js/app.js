/**
 * ShadowPrompt Master Application Controller (ES6).
 */

import { TokenizerScanner } from './engine/tokenizer_scanner.js';
import { DelimiterGuard } from './engine/delimiter_guard.js';
import { HoneyPotSandbox } from './engine/honeypot.js';
import { GroundingEngine } from './engine/grounding_engine.js';
import { ATTACK_PRESETS, runFuzzerBenchmark } from './fuzzer/attack_suite.js';

const scanner = new TokenizerScanner();
const guard = new DelimiterGuard();
const honeypot = new HoneyPotSandbox();
const grounding = new GroundingEngine();

// DOM elements
const presetSelect = document.getElementById('preset-select');
const promptInput = document.getElementById('prompt-input');
const analyzeBtn = document.getElementById('analyze-btn');
const enableHoneyCheckbox = document.getElementById('enable-honeypot');

const statusBadge = document.getElementById('status-badge');
const latencyMetric = document.getElementById('latency-metric');
const threatsMetric = document.getElementById('threats-metric');
const invisibleMetric = document.getElementById('invisible-metric');

const alertsContainer = document.getElementById('alerts-container');
const honeypotCard = document.getElementById('honeypot-card');
const honeypotContent = document.getElementById('honeypot-content');

const visualView = document.getElementById('visual-view');
const rawBytesView = document.getElementById('raw-bytes-view');
const incidentsTbody = document.getElementById('incidents-tbody');

// Benchmark elements
const runBenchmarkBtn = document.getElementById('run-benchmark-btn');
const benchmarkResults = document.getElementById('benchmark-results');

function escapeUnicode(str) {
  return str.replace(/[\s\S]/g, function(escape) {
    const code = escape.charCodeAt(0);
    if (code > 127 || code < 32) {
      return '\\u' + code.toString(16).toUpperCase().padStart(4, '0');
    }
    return escape;
  });
}

function updateViews(text) {
  visualView.textContent = text || '(Empty prompt)';
  rawBytesView.textContent = escapeUnicode(text) || '(Empty prompt)';
}

function executeScan() {
  const text = promptInput.value;
  updateViews(text);

  const t0 = performance.now();
  const sRes = scanner.scan(text);
  const dRes = guard.inspect(text);
  const totalDuration = Math.round((performance.now() - t0) * 1000) / 1000;

  const threats = [...sRes.threatsDetected.map(t => t.description)];
  for (const d of dRes) {
    threats.push(`[${d.severity}] ${d.patternName}: ${d.matchSnippet}`);
  }

  const isSafe = threats.length === 0;

  // Update Metrics
  statusBadge.className = isSafe
    ? 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
    : 'px-3 py-1 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-500/30 animate-pulse';
  statusBadge.textContent = isSafe ? 'SAFE ✅' : 'INTERCEPTED 🚨';

  latencyMetric.textContent = `${totalDuration.toFixed(3)} ms`;
  threatsMetric.textContent = threats.length;
  invisibleMetric.textContent = sRes.invisibleCharacterCount;

  // Alerts Render
  alertsContainer.innerHTML = '';
  if (!isSafe) {
    alertsContainer.classList.remove('hidden');
    let html = `<div class="p-4 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200">
      <div class="font-bold flex items-center gap-2 mb-2 text-red-400">
        <span>🚨</span> Threat Neutralized (${threats.length} vector${threats.length > 1 ? 's' : ''} intercepted)
      </div>
      <ul class="list-disc list-inside space-y-1 text-sm font-mono">`;
    for (const t of threats) {
      html += `<li>${t}</li>`;
    }
    html += `</ul>`;
    if (sRes.steganographyDecodedPayload) {
      html += `<div class="mt-3 p-2 bg-black/60 rounded border border-red-500/30 text-xs">
        <span class="text-emerald-400 font-bold">Decoded Hidden Payload:</span>
        <code class="text-yellow-300 ml-1">${sRes.steganographyDecodedPayload}</code>
      </div>`;
    }
    html += `</div>`;
    alertsContainer.innerHTML = html;

    // HoneyPot Sandbox
    if (enableHoneyCheckbox.checked) {
      const category = sRes.invisibleCharacterCount > 0 ? 'STEGANOGRAPHY' : 'DELIMITER_HIJACK';
      const incident = honeypot.engage(category, text);
      honeypotCard.classList.remove('hidden');
      honeypotContent.innerHTML = `
        <div class="space-y-2 text-xs font-mono">
          <div class="flex justify-between text-slate-400 pb-2 border-b border-slate-800">
            <span>Incident ID: <strong class="text-white">${incident.incidentId}</strong></span>
            <span>Canary Seed: <strong class="text-amber-400">${incident.canaryPlanted}</strong></span>
            <span>Attacker Compute Burned: <strong class="text-red-400">${incident.attackerTokensWasted} tokens</strong></span>
          </div>
          <pre class="bg-black/80 p-3 rounded text-emerald-400 overflow-x-auto text-[11px] leading-relaxed border border-emerald-500/20">${incident.syntheticOutput}</pre>
        </div>
      `;
      renderIncidentsTable();
    } else {
      honeypotCard.classList.add('hidden');
    }
  } else {
    alertsContainer.classList.remove('hidden');
    alertsContainer.innerHTML = `
      <div class="p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200">
        <div class="font-bold flex items-center gap-2 text-emerald-400">
          <span>✅</span> Payload Cleared Clean
        </div>
        <p class="text-sm mt-1 text-slate-300">Zero steganographic bytes, homoglyphs, or delimiter overrides detected. Safe for upstream LLM inference.</p>
      </div>
    `;
    honeypotCard.classList.add('hidden');
  }
}

function renderIncidentsTable() {
  if (!incidentsTbody) return;
  incidentsTbody.innerHTML = '';
  for (const inc of honeypot.incidents) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-900/40 font-mono text-xs';
    tr.innerHTML = `
      <td class="py-2.5 px-3 text-cyan-400">${inc.incidentId}</td>
      <td class="py-2.5 px-3 text-slate-400">${inc.timestamp}</td>
      <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-500/30">${inc.threatCategory}</span></td>
      <td class="py-2.5 px-3 text-amber-300">${inc.canaryPlanted}</td>
      <td class="py-2.5 px-3 text-slate-400 max-w-[200px] truncate">${inc.rawPromptSnippet}</td>
    `;
    incidentsTbody.appendChild(tr);
  }
}

// Preset selection
presetSelect.addEventListener('change', (e) => {
  const chosen = ATTACK_PRESETS.find(p => p.id === e.target.value);
  if (chosen) {
    promptInput.value = chosen.rawPayload;
    executeScan();
  }
});

analyzeBtn.addEventListener('click', executeScan);
promptInput.addEventListener('input', () => updateViews(promptInput.value));

// Benchmark runner
runBenchmarkBtn.addEventListener('click', () => {
  runBenchmarkBtn.disabled = true;
  runBenchmarkBtn.textContent = 'Running 30 Adversarial Fuzzing Cycles...';

  setTimeout(() => {
    const rep = runFuzzerBenchmark(scanner, guard, 5);
    benchmarkResults.classList.remove('hidden');
    document.getElementById('bench-recall').textContent = `${rep.recallRate}%`;
    document.getElementById('bench-precision').textContent = `${rep.precisionRate}%`;
    document.getElementById('bench-p99').textContent = `${rep.p99LatencyMs} ms`;
    document.getElementById('bench-nist').textContent = `${rep.nistScore}/100`;

    document.getElementById('bench-total').textContent = rep.totalTested;
    document.getElementById('bench-blocked').textContent = rep.attacksBlocked;
    document.getElementById('bench-passed').textContent = rep.benignPassed;
    document.getElementById('bench-avg').textContent = `${rep.avgLatencyMs} ms`;

    runBenchmarkBtn.disabled = false;
    runBenchmarkBtn.textContent = '⚡ Run Live Red-Team Benchmark';
  }, 100);
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('border-cyan-500', 'text-cyan-400');
      b.classList.add('border-transparent', 'text-slate-400');
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

    btn.classList.add('border-cyan-500', 'text-cyan-400');
    btn.classList.remove('border-transparent', 'text-slate-400');
    const target = document.getElementById(btn.dataset.tab);
    if (target) target.classList.remove('hidden');
  });
});

// Initial load
window.addEventListener('DOMContentLoaded', () => {
  promptInput.value = ATTACK_PRESETS[0].rawPayload;
  executeScan();
});
