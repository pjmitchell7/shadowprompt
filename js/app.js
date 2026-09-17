/**
 * ShadowPrompt Master Application Controller (ES6).
 * Features:
 * - Web Audio API synthesized tactical audio clicks and interception chimes
 * - Interactive Unicode / Carrier Byte Grid with live tooltips
 * - STIX 2.1 & ArcSight CEF browser file exporter
 * - Dynamic cURL / Python / Node.js code generator with copy-to-clipboard
 * - Honest 12-vector NIST/OWASP benchmark runner
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

// --- Audio Synthesizer (Web Audio API) ---
class TacticalAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.025);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.025);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.025);
  }

  playInterception() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

const sound = new TacticalAudio();

// DOM elements
const presetSelect = document.getElementById('preset-select');
const promptInput = document.getElementById('prompt-input');
const analyzeBtn = document.getElementById('analyze-btn');
const enableHoneyCheckbox = document.getElementById('enable-honeypot');
const soundToggleBtn = document.getElementById('sound-toggle-btn');

const statusBadge = document.getElementById('status-badge');
const latencyMetric = document.getElementById('latency-metric');
const threatsMetric = document.getElementById('threats-metric');
const invisibleMetric = document.getElementById('invisible-metric');
const entropyMetric = document.getElementById('entropy-metric');

const alertsContainer = document.getElementById('alerts-container');
const honeypotCard = document.getElementById('honeypot-card');
const honeypotContent = document.getElementById('honeypot-content');

const byteGridContainer = document.getElementById('byte-grid-container');
const byteTooltip = document.getElementById('byte-tooltip');
const incidentsTbody = document.getElementById('incidents-tbody');

// Integration snippet elements
const codeLangSelect = document.getElementById('code-lang-select');
const codeSnippet = document.getElementById('code-snippet');
const copyCodeBtn = document.getElementById('copy-code-btn');

// Benchmark elements
const runBenchmarkBtn = document.getElementById('run-benchmark-btn');
const benchmarkResults = document.getElementById('benchmark-results');

// Sound toggle
if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    soundToggleBtn.textContent = sound.enabled ? 'Audio: Active' : 'Audio: Muted';
    soundToggleBtn.className = sound.enabled
      ? 'px-2.5 py-1 rounded text-[11px] font-mono border border-cyan-500/30 text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/40'
      : 'px-2.5 py-1 rounded text-[11px] font-mono border border-slate-700 text-slate-400 bg-slate-900 hover:bg-slate-800';
  });
}

// Render the interactive token/byte grid
function renderByteGrid(annotatedTokens) {
  if (!byteGridContainer) return;
  byteGridContainer.innerHTML = '';

  const maxTokens = Math.min(annotatedTokens.length, 120);
  for (let i = 0; i < maxTokens; i++) {
    const t = annotatedTokens[i];
    const span = document.createElement('span');
    span.className = 'byte-pill inline-flex items-center justify-center min-w-[24px] h-7 px-1.5 rounded text-xs font-mono border text-center transition';

    if (t.isZeroWidth) {
      span.className += ' bg-amber-950/90 text-amber-300 border-amber-500/60 font-bold animate-pulse';
      span.title = `[STEALTH BYTE] ${t.zeroWidthInfo.name} (${t.hex}) | Bit: ${t.zeroWidthInfo.bit}`;
      span.textContent = '·ZW';
    } else if (t.isHomoglyph) {
      span.className += ' bg-cyan-950/90 text-cyan-300 border-cyan-500/60 font-bold';
      span.title = `[HOMOGLYPH] Cyrillic '${t.actualChar}' (${t.hex}) -> Latin '${t.homoglyphTarget}'`;
      span.textContent = t.actualChar;
    } else {
      span.className += ' bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-600';
      span.title = `Char: '${t.actualChar}' (${t.hex})`;
      span.textContent = t.actualChar === ' ' ? '␣' : t.actualChar;
    }

    // Hover tooltip info
    span.addEventListener('mouseenter', (e) => {
      if (byteTooltip) {
        let text = `<strong>Char:</strong> '${t.actualChar}' | <strong>Hex:</strong> ${t.hex}`;
        if (t.isZeroWidth) {
          text += ` | <span class="text-amber-400 font-bold">STEALTH TOKEN: ${t.zeroWidthInfo.name} (Bit: ${t.zeroWidthInfo.bit})</span>`;
        }
        if (t.isHomoglyph) {
          text += ` | <span class="text-cyan-400 font-bold">HOMOGLYPH: Mapped to '${t.homoglyphTarget}'</span>`;
        }
        byteTooltip.innerHTML = text;
        byteTooltip.classList.remove('opacity-0');
      }
    });

    byteGridContainer.appendChild(span);
  }

  if (annotatedTokens.length > maxTokens) {
    const more = document.createElement('span');
    more.className = 'text-xs text-slate-500 font-mono self-center ml-2';
    more.textContent = `+${annotatedTokens.length - maxTokens} more tokens`;
    byteGridContainer.appendChild(more);
  }
}

// Update code integration snippet
function updateCodeSnippet() {
  const lang = codeLangSelect ? codeLangSelect.value : 'curl';
  let snippet = '';

  if (lang === 'curl') {
    snippet = `# Drop-in cURL Pre-Inference Inspection Proxy
curl -X POST "https://api.shadowprompt.dev/v1/scan" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Defense logistics report with concealed payload...", "enable_honeypot": true}'`;
  } else if (lang === 'python') {
    snippet = `# Python SDK Pre-Inference Interceptor (LangGraph / OpenAI)
import requests

def shadowprompt_guard(prompt: str) -> dict:
    resp = requests.post("https://api.shadowprompt.dev/v1/scan", json={"prompt": prompt})
    res = resp.json()
    if not res["is_safe"]:
        raise ValueError(f"Threat Intercepted: {res['threat_details']}")
    return res["sanitized_text"]`;
  } else {
    snippet = `// Node.js / Next.js API Route Guardrail Middleware
export async function verifyPromptSecurity(prompt: string) {
  const res = await fetch("https://api.shadowprompt.dev/v1/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, enable_honeypot: true })
  });
  const data = await res.json();
  if (!data.is_safe) throw new Error("Security Violation: Token Smuggling Intercepted");
  return data.sanitized_text;
}`;
  }

  if (codeSnippet) codeSnippet.textContent = snippet;
}

if (codeLangSelect) {
  codeLangSelect.addEventListener('change', updateCodeSnippet);
}

if (copyCodeBtn) {
  copyCodeBtn.addEventListener('click', () => {
    sound.playClick();
    if (codeSnippet) {
      navigator.clipboard.writeText(codeSnippet.textContent).then(() => {
        copyCodeBtn.textContent = 'Copied!';
        setTimeout(() => (copyCodeBtn.textContent = 'Copy Code'), 2000);
      });
    }
  });
}

function executeScan() {
  const text = promptInput.value;
  sound.playClick();

  const t0 = performance.now();
  const sRes = scanner.scan(text);
  const dRes = guard.inspect(text, sRes.normalizedPayload);
  const totalDuration = Math.round((performance.now() - t0) * 1000) / 1000;

  const threats = [...sRes.threatsDetected.map(t => t.description)];
  for (const d of dRes) {
    threats.push(`[${d.severity}] ${d.patternName}: "${d.matchSnippet}"`);
  }

  const isSafe = threats.length === 0;
  if (!isSafe) {
    sound.playInterception();
  }

  // Update Metrics
  if (statusBadge) {
    statusBadge.className = isSafe
      ? 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
      : 'px-3 py-1 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-500/40 animate-pulse';
    statusBadge.textContent = isSafe ? 'SAFE' : 'INTERCEPTED';
  }

  if (latencyMetric) latencyMetric.textContent = `${totalDuration.toFixed(3)} ms`;
  if (threatsMetric) threatsMetric.textContent = threats.length;
  if (invisibleMetric) invisibleMetric.textContent = sRes.invisibleCharacterCount;
  if (entropyMetric) entropyMetric.textContent = sRes.shannonEntropy;

  // Render Byte Grid
  renderByteGrid(sRes.annotatedTokens);

  // Alerts Render
  alertsContainer.innerHTML = '';
  if (!isSafe) {
    alertsContainer.classList.remove('hidden');
    let html = `<div class="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200">
      <div class="font-bold flex items-center gap-2 mb-2 text-red-400 text-sm">
        <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <span>Adversarial Attack Intercepted (${threats.length} vector${threats.length > 1 ? 's' : ''})</span>
      </div>
      <ul class="list-disc list-inside space-y-1 text-xs font-mono">`;
    for (const t of threats) {
      html += `<li>${t}</li>`;
    }
    html += `</ul>`;
    if (sRes.steganographyDecodedPayload) {
      html += `<div class="mt-3 p-2.5 bg-black/70 rounded-lg border border-red-500/30 text-xs">
        <span class="text-emerald-400 font-bold">Decoded Hidden Payload:</span>
        <code class="text-amber-300 ml-1 bg-amber-950/60 px-1.5 py-0.5 rounded font-mono">${sRes.steganographyDecodedPayload}</code>
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
          <div class="flex flex-wrap items-center justify-between gap-2 text-slate-400 pb-2 border-b border-slate-800 text-[11px]">
            <span>Incident: <strong class="text-white">${incident.incidentId}</strong></span>
            <span>Canary Seed: <strong class="text-amber-400">${incident.canaryPlanted}</strong></span>
            <span>Attacker Budget Wasted: <strong class="text-red-400">${incident.attackerTokensWasted} tokens</strong></span>
          </div>
          <pre class="bg-black/90 p-3.5 rounded-lg text-emerald-400 overflow-x-auto text-[11px] leading-relaxed border border-emerald-500/20">${incident.syntheticOutput}</pre>
        </div>
      `;
      renderIncidentsTable();
    } else {
      honeypotCard.classList.add('hidden');
    }
  } else {
    alertsContainer.classList.remove('hidden');
    alertsContainer.innerHTML = `
      <div class="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200">
        <div class="font-bold flex items-center gap-2 text-emerald-400 text-sm">
          <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Payload Cleared Clean</span>
        </div>
        <p class="text-xs mt-1 text-slate-300">No token smuggling, homoglyphs, or delimiter breakouts detected. Safe for upstream LLM inference.</p>
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
      <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-500/30 text-[10px]">${inc.threatCategory}</span></td>
      <td class="py-2.5 px-3 text-amber-300">${inc.canaryPlanted}</td>
      <td class="py-2.5 px-3 text-slate-400 max-w-[200px] truncate">${inc.rawPromptSnippet}</td>
    `;
    incidentsTbody.appendChild(tr);
  }
}

// Download helpers for STIX and CEF
function downloadFile(content, fileName, contentType) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

const exportStixBtn = document.getElementById('export-stix-btn');
if (exportStixBtn) {
  exportStixBtn.addEventListener('click', () => {
    sound.playClick();
    const stixJson = honeypot.exportToSTIX21();
    downloadFile(stixJson, 'shadowprompt_stix21_bundle.json', 'application/json');
  });
}

const exportCefBtn = document.getElementById('export-cef-btn');
if (exportCefBtn) {
  exportCefBtn.addEventListener('click', () => {
    sound.playClick();
    const cefLog = honeypot.exportToCEF();
    downloadFile(cefLog, 'shadowprompt_cef.log', 'text/plain');
  });
}

// Preset selection
if (presetSelect) {
  presetSelect.addEventListener('change', (e) => {
    sound.playClick();
    const chosen = ATTACK_PRESETS.find(p => p.id === e.target.value);
    if (chosen) {
      promptInput.value = chosen.rawPayload;
      executeScan();
    }
  });
}

if (analyzeBtn) analyzeBtn.addEventListener('click', executeScan);
if (promptInput) promptInput.addEventListener('input', () => {
  const sRes = scanner.scan(promptInput.value);
  renderByteGrid(sRes.annotatedTokens);
});

// Benchmark runner
if (runBenchmarkBtn) {
  runBenchmarkBtn.addEventListener('click', () => {
    sound.playClick();
    runBenchmarkBtn.disabled = true;
    runBenchmarkBtn.textContent = 'Running 48 Adversarial Cycles across 12 Vectors...';

    setTimeout(() => {
      const rep = runFuzzerBenchmark(scanner, guard, 4);
      if (benchmarkResults) benchmarkResults.classList.remove('hidden');

      document.getElementById('bench-recall').textContent = `${rep.recallRate}%`;
      document.getElementById('bench-precision').textContent = `${rep.precisionRate}%`;
      document.getElementById('bench-p99').textContent = `${rep.p99LatencyMs} ms`;
      document.getElementById('bench-nist').textContent = `${rep.nistScore}/100`;

      document.getElementById('bench-total').textContent = rep.totalTested;
      document.getElementById('bench-blocked').textContent = rep.attacksBlocked;
      document.getElementById('bench-passed').textContent = rep.benignPassed;
      document.getElementById('bench-avg').textContent = `${rep.avgLatencyMs} ms`;
      document.getElementById('bench-p50').textContent = `${rep.p50LatencyMs} ms`;
      document.getElementById('bench-p95').textContent = `${rep.p95LatencyMs} ms`;

      runBenchmarkBtn.disabled = false;
      runBenchmarkBtn.textContent = 'Run Continuous Benchmark Suite';
    }, 120);
  });
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sound.playClick();
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
  // Populate preset dropdown
  if (presetSelect) {
    presetSelect.innerHTML = '';
    for (const p of ATTACK_PRESETS) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      presetSelect.appendChild(opt);
    }
  }

  updateCodeSnippet();
  if (promptInput) {
    promptInput.value = ATTACK_PRESETS[0].rawPayload;
    executeScan();
  }
});
