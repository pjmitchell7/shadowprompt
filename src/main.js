import "../css/style.css";
import { Arena } from "./arena.js";
import { inspectPayload } from "./inspection.js";
import { SCENARIOS } from "./scenarios.js";

const app = document.querySelector("#app");
// This template is static. Every payload, rule and scenario string uses textContent.
app.innerHTML = /* HTML */ ` <header class="app-header">
    <a class="brand" href="./" aria-label="ShadowPrompt console"
      ><svg aria-hidden="true" viewBox="0 0 32 32">
        <path fill="currentColor" d="M5 5h22v7H12v8h15v7H5v-7h15v-8H5Z" /></svg
      >ShadowPrompt</a
    >
    <span class="header-label">Adversarial inspection</span>
    <nav class="header-links" aria-label="Product resources">
      <a
        href="https://github.com/pjmitchell7/shadowprompt#readme"
        target="_blank"
        rel="noopener noreferrer"
        >Documentation</a
      ><a
        href="https://github.com/pjmitchell7/shadowprompt"
        target="_blank"
        rel="noopener noreferrer"
        >Source</a
      ><span class="mode">LOCAL REPLAY</span>
    </nav>
  </header>
  <main class="shell" id="workspace">
    <div class="page-intro">
      <div>
        <p class="eyebrow">ShadowPrompt / Prompt injection inspection</p>
        <h1>See how prompts try to redirect an AI</h1>
        <p class="intro-copy">
          Prompt injection is text that tries to redirect an AI from its
          instructions. ShadowPrompt helps you test examples or your own text
          against local rules and inspect what gets flagged.
        </p>
      </div>
      <div class="intro-start">
        <p class="field-label">Start here</p>
        <p class="intro-guide">
          Choose an example and press <strong>Play sequence</strong>, or
          <a id="try-own-text" href="#custom-payload">try your own text</a>.
        </p>
        <p class="intro-mode">
          Runs in your browser. No live AI model is connected.
        </p>
      </div>
    </div>
    <section class="control-bar" aria-label="Scenario and replay controls">
      <div class="scenario-field">
        <label class="field-label" for="scenario">Example to replay</label
        ><select id="scenario"></select>
      </div>
      <div class="replay-controls">
        <span class="replay-position" id="replay-position"></span
        ><button id="play" class="primary">Play sequence</button
        ><button id="step">Step</button
        ><button id="reset" class="quiet">Reset</button
        ><button id="export" class="quiet">Export trace</button>
      </div>
    </section>
    <section class="panel metrics" aria-label="Measured inspection telemetry">
      <div class="metric">
        <p class="metric-label">Local inspection</p>
        <p class="metric-value">
          <span id="metric-latency">0.000</span><small>ms</small>
        </p>
        <span class="metric-note" id="latency-note"
          >Measured in this browser</span
        >
      </div>
      <div class="metric">
        <p class="metric-label">Gambit depth</p>
        <p class="metric-value">
          <span id="metric-depth">01</span><small>turns</small>
        </p>
        <span class="metric-note">Cumulative scenario path</span>
      </div>
      <div class="metric">
        <p class="metric-label">Lexical cosine</p>
        <p class="metric-value" id="metric-similarity">0.000</p>
        <span class="metric-note" id="similarity-note">Threshold 0.72</span>
      </div>
      <div class="metric">
        <p class="metric-label">Payload entropy</p>
        <p class="metric-value">
          <span id="metric-entropy">0.00</span><small>bits</small>
        </p>
        <span class="metric-note">Per Unicode code point</span>
      </div>
    </section>
    <div class="workspace-grid">
      <div>
        <section class="panel arena-panel" aria-labelledby="arena-heading">
          <div class="panel-header">
            <h2 class="panel-title" id="arena-heading">
              <span class="section-id">01</span>Tactical arena
            </h2>
            <span class="panel-meta" id="replay-state">Paused</span>
          </div>
          <div class="arena-frame" id="arena">
            <div class="arena-overlay">
              <div class="arena-caption">
                <strong>ADVERSARIAL PATH</strong>INPUT / BOUNDARY / MODEL
              </div>
              <div class="arena-caption" id="arena-turn">TURN 01</div>
            </div>
            <p class="arena-help">
              Drag to orbit. Scroll to zoom. Select a node to inspect its role.
            </p>
          </div>
          <div class="arena-toolbar">
            <div class="view-controls" aria-label="Camera views">
              <button data-view="isometric" aria-pressed="true">
                Isometric</button
              ><button data-view="top" aria-pressed="false">Plan</button
              ><button data-view="attacker" aria-pressed="false">Attack</button>
            </div>
            <button id="reset-camera" class="quiet reset-camera">
              Reset view
            </button>
          </div>
          <div class="node-controls" aria-label="Select arena role">
            <button data-node="attacker" aria-pressed="false">
              <i class="role-mark" aria-hidden="true"></i>Attacker</button
            ><button data-node="guardrail" aria-pressed="true">
              <i class="role-mark guard" aria-hidden="true"></i
              >Guardrail</button
            ><button data-node="target" aria-pressed="false">
              <i class="role-mark target" aria-hidden="true"></i>Target model
            </button>
          </div>
          <p class="selection-info" id="selection-info">
            Guardrail: local heuristic and lexical inspection boundary.
          </p>
        </section>

        <section class="panel sequence" aria-labelledby="sequence-heading">
          <div class="panel-header">
            <h2 class="panel-title" id="sequence-heading">
              <span class="section-id">02</span>Turn sequence
            </h2>
            <span class="panel-meta" id="sequence-count"></span>
          </div>
          <ol class="sequence-list" id="turn-list"></ol>
        </section>
      </div>
      <aside
        class="panel inspection-panel"
        aria-labelledby="inspection-heading"
      >
        <div class="panel-header">
          <h2 class="panel-title" id="inspection-heading">
            <span class="section-id">03</span>Payload inspector
          </h2>
          <span class="panel-meta">Local engine</span>
        </div>
        <div class="inspection-summary">
          <div class="summary-top">
            <span class="verdict" id="verdict"></span
            ><span class="turn-ref" id="turn-ref"></span>
          </div>
          <h3 id="turn-title"></h3>
          <p id="turn-description"></p>
          <div class="expected" id="expected"></div>
        </div>
        <div
          class="inspector-tabs"
          role="tablist"
          aria-label="Inspection evidence"
        >
          <button
            id="tab-raw"
            role="tab"
            aria-selected="true"
            aria-controls="evidence"
            data-tab="raw"
          >
            Raw input</button
          ><button
            id="tab-normalized"
            role="tab"
            aria-selected="false"
            aria-controls="evidence"
            data-tab="normalized"
            tabindex="-1"
          >
            Normalized</button
          ><button
            id="tab-rules"
            role="tab"
            aria-selected="false"
            aria-controls="evidence"
            data-tab="rules"
            tabindex="-1"
          >
            Rules</button
          ><button
            id="tab-vector"
            role="tab"
            aria-selected="false"
            aria-controls="evidence"
            data-tab="vector"
            tabindex="-1"
          >
            Vector log
          </button>
        </div>
        <div
          class="evidence-body"
          id="evidence"
          role="tabpanel"
          aria-labelledby="tab-raw"
          tabindex="0"
        ></div>
        <form class="custom-inspection" id="inspect-form">
          <div class="custom-heading">
            <h3><label for="custom-payload">Try your own text</label></h3>
            <span>LOCAL ONLY</span>
          </div>
          <textarea
            id="custom-payload"
            rows="4"
            maxlength="16000"
            placeholder="Paste a message to check, or load the selected example..."
            spellcheck="false"
            aria-describedby="custom-help"
          ></textarea>
          <div class="custom-options">
            <label for="threshold">Lexical similarity threshold</label
            ><input
              id="threshold"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value="0.72"
              required
            />
          </div>
          <div class="custom-actions">
            <button class="primary" type="submit">Run inspection</button
            ><button type="button" id="load-payload" class="quiet">
              Load selected turn
            </button>
          </div>
          <p class="feedback" id="feedback" role="status">
            Ready. Payloads remain in this browser.
          </p>
          <p class="sr-only" id="custom-help">
            Maximum 16,000 characters. Custom inspection uses the preceding
            scenario turns as context.
          </p>
        </form>
        <div class="methodology">
          <strong>Evidence, with boundaries.</strong> Rules and lexical cosine
          are local heuristics. A no-match result is not a safety guarantee. No
          remote model, embedding service or network defense is connected.
        </div>
      </aside>
    </div>
    <footer class="workspace-footer">
      <p>
        SHADOWPROMPT / INSPECTION CONSOLE<br />Local timing includes
        normalization, rules and lexical analysis. Model inference is not
        measured.
      </p>
      <p class="footer-state" id="renderer-status">
        Initializing tactical renderer
      </p>
    </footer>
    <p class="sr-only" id="announcement" role="status" aria-live="polite"></p>
  </main>`;

const $ = (id) => document.getElementById(id);
const verdictLabels = {
  quarantine: "QUARANTINE",
  review: "REVIEW",
  "no-match": "NO RULE MATCHED",
};
const nodeDescriptions = {
  attacker: "Attacker: the active turn supplies untrusted prompt content.",
  guardrail: "Guardrail: local heuristic and lexical inspection boundary.",
  target: "Target: the model endpoint is conceptual. No LLM is connected.",
};
const state = {
  scenario: SCENARIOS[0],
  turn: 0,
  results: [],
  playing: false,
  timer: null,
  tab: "raw",
  custom: null,
  customTrace: [],
  threshold: 0.72,
};
let arena;
let exportUrl;
let exportTimer;
let disposed = false;
const events = new AbortController();
const on = (element, type, callback) =>
  element.addEventListener(type, callback, { signal: events.signal });
const text = (tag, value, className) => {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
};
const safeDisplay = (value) =>
  String(value).replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu,
    (character) =>
      `\\u${character.codePointAt(0).toString(16).padStart(4, "0").toUpperCase()}`,
  );
const feedback = (message, error = false) => {
  $("feedback").textContent = message;
  $("feedback").classList.toggle("error", error);
};
const announce = (message) => {
  $("announcement").textContent = message;
};
const currentResult = () => state.custom ?? state.results[state.turn];

function stopPlayback() {
  clearTimeout(state.timer);
  state.timer = null;
  state.playing = false;
}

function inspectScenario() {
  state.results = state.scenario.turns.map((turn, index) =>
    inspectPayload(turn.payload, {
      history: state.scenario.turns
        .slice(0, index)
        .map((prior) => prior.payload),
      threshold: state.threshold,
    }),
  );
}

function renderEvidence() {
  const result = currentResult();
  const body = $("evidence");
  body.replaceChildren();
  body.setAttribute("aria-labelledby", `tab-${state.tab}`);
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const selected = button.dataset.tab === state.tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  if (state.tab === "raw" || state.tab === "normalized") {
    body.append(
      text(
        "p",
        state.tab === "raw"
          ? "Untrusted input. Invisible controls are shown as Unicode escapes."
          : "Canonical form for inspection. Normalization does not make a payload safe.",
        "evidence-note",
      ),
    );
    body.append(
      text(
        "pre",
        safeDisplay(state.tab === "raw" ? result.raw : result.normalized),
        "payload",
      ),
    );
  } else if (state.tab === "rules") {
    if (!result.rules.length)
      body.append(
        text(
          "p",
          "No heuristic rule matched this turn. Review the full context before relying on this result.",
          "evidence-note",
        ),
      );
    result.rules.forEach((rule) => {
      const item = text("article", "", "rule");
      item.append(
        text("span", `${rule.id} / ${rule.severity}`, "rule-id"),
        text("h4", rule.name),
        text(
          "pre",
          safeDisplay(
            typeof rule.evidence === "string"
              ? rule.evidence
              : JSON.stringify(rule.evidence, null, 2),
          ),
        ),
      );
      body.append(item);
    });
  } else {
    body.append(
      text(
        "p",
        "Lexical cosine over local reference text. No embeddings or remote vector database.",
        "evidence-note",
      ),
    );
    result.vectorLog.forEach((line) =>
      body.append(text("p", safeDisplay(line), "vector-line")),
    );
  }
}

function render() {
  const focusedTurn = document.activeElement?.dataset?.turn;
  const result = currentResult();
  const turn = state.scenario.turns[state.turn];
  const count = state.scenario.turns.length;
  $("replay-position").textContent =
    `TURN ${String(state.turn + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
  $("replay-state").textContent = state.playing
    ? "Replay running"
    : state.turn === count - 1
      ? "Sequence complete"
      : "Replay paused";
  $("play").textContent = state.playing
    ? "Pause"
    : state.turn === count - 1
      ? "Replay sequence"
      : "Play sequence";
  $("play").setAttribute("aria-pressed", String(state.playing));
  $("step").disabled = state.turn === count - 1;
  $("arena-turn").textContent = state.custom
    ? "CUSTOM INPUT"
    : `TURN ${String(state.turn + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
  $("metric-latency").textContent = result.parseMs.toFixed(3);
  $("latency-note").textContent =
    result.parseMs === 0
      ? "Below browser timer resolution"
      : "Measured in this browser";
  $("metric-depth").textContent = String(state.turn + 1).padStart(2, "0");
  $("metric-similarity").textContent = result.similarity.toFixed(3);
  $("similarity-note").textContent = `Threshold ${result.threshold.toFixed(2)}`;
  $("metric-entropy").textContent = result.entropy.toFixed(2);
  $("verdict").textContent = verdictLabels[result.verdict];
  $("verdict").dataset.verdict = result.verdict;
  $("turn-ref").textContent = state.custom
    ? "CUSTOM INPUT"
    : `TURN ${String(state.turn + 1).padStart(2, "0")}`;
  $("turn-title").textContent = state.custom
    ? "Custom payload inspection"
    : turn.label;
  $("turn-description").textContent = state.custom
    ? `Inspected with ${state.turn} preceding scenario turn${state.turn === 1 ? "" : "s"} as context. This result does not replace the recorded scenario.`
    : state.scenario.description;
  $("expected").classList.toggle(
    "mismatch",
    !state.custom &&
      Boolean(turn.expectedVerdict) &&
      turn.expectedVerdict !== result.verdict,
  );
  $("expected").textContent = state.custom
    ? `${result.rules.length} rule match${result.rules.length === 1 ? "" : "es"} / threshold ${result.threshold.toFixed(2)}`
    : turn.expectedVerdict
      ? `Expected: ${verdictLabels[turn.expectedVerdict] ?? turn.expectedVerdict} / ${turn.expectedVerdict === result.verdict ? "Observed match" : "Observed disagreement"}`
      : `${result.rules.length} rule match${result.rules.length === 1 ? "" : "es"} / fixture expectation not specified`;
  $("sequence-count").textContent =
    `${count} turns / ${state.scenario.category}`;
  $("turn-list").replaceChildren(
    ...state.scenario.turns.map((item, index) => {
      const li = document.createElement("li");
      const button = text("button", "", "turn-button");
      button.type = "button";
      button.setAttribute("aria-current", String(index === state.turn));
      button.setAttribute("aria-label", `Turn ${index + 1}: ${item.label}`);
      button.dataset.turn = String(index);
      const copy = text("span", "", "turn-copy");
      copy.append(
        text("span", item.label, "turn-label"),
        text(
          "span",
          `${state.results[index].rules.length} rule matches / ${Array.from(item.payload).length} code points`,
          "turn-category",
        ),
      );
      const decision = text(
        "span",
        verdictLabels[state.results[index].verdict],
        "turn-verdict",
      );
      decision.dataset.verdict = state.results[index].verdict;
      button.append(
        text("span", String(index + 1).padStart(2, "0"), "turn-number"),
        copy,
        decision,
      );
      li.append(button);
      return li;
    }),
  );
  renderEvidence();
  if (focusedTurn !== undefined) {
    document
      .querySelector(`[data-turn="${focusedTurn}"]`)
      ?.focus({ preventScroll: true });
  }
  arena?.setEvent({
    turn: state.turn + 1,
    total: count,
    verdict: result.verdict,
  });
}

function selectTurn(index, message = true) {
  stopPlayback();
  state.turn = index;
  state.custom = null;
  render();
  if (message)
    announce(`Turn ${index + 1}. ${verdictLabels[currentResult().verdict]}.`);
}

function scheduleAdvance() {
  state.timer = setTimeout(() => {
    if (!state.playing || disposed) return;
    state.turn += 1;
    state.custom = null;
    if (state.turn >= state.scenario.turns.length - 1) stopPlayback();
    render();
    announce(
      `Turn ${state.turn + 1}. ${verdictLabels[currentResult().verdict]}.${state.playing ? "" : " Sequence complete."}`,
    );
    if (state.playing) scheduleAdvance();
  }, 1800);
}

SCENARIOS.forEach((scenario, index) => {
  const option = text(
    "option",
    `${String(index + 1).padStart(2, "0")} / ${scenario.name}`,
  );
  option.value = scenario.id;
  $("scenario").append(option);
});

on($("scenario"), "change", () => {
  stopPlayback();
  state.scenario = SCENARIOS.find(
    (scenario) => scenario.id === $("scenario").value,
  );
  state.turn = 0;
  state.custom = null;
  state.customTrace = [];
  inspectScenario();
  render();
  feedback("Scenario loaded. Replay is paused at the first turn.");
});
on($("play"), "click", () => {
  if (state.playing) stopPlayback();
  else {
    if (state.turn === state.scenario.turns.length - 1) state.turn = 0;
    state.custom = null;
    state.playing = true;
    scheduleAdvance();
  }
  render();
});
on($("step"), "click", () =>
  selectTurn(Math.min(state.turn + 1, state.scenario.turns.length - 1)),
);
on($("reset"), "click", () => {
  selectTurn(0);
  feedback("Sequence reset. Playback stopped.");
});
on($("turn-list"), "click", (event) => {
  const button = event.target.closest("[data-turn]");
  if (button) selectTurn(Number(button.dataset.turn));
});
document.querySelectorAll("[data-tab]").forEach((button) => {
  on(button, "click", () => {
    state.tab = button.dataset.tab;
    renderEvidence();
  });
  on(button, "keydown", (event) => {
    const tabs = [...document.querySelectorAll("[data-tab]")];
    const index = tabs.indexOf(button);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (next !== null) {
      event.preventDefault();
      tabs[next].click();
      tabs[next].focus();
    }
  });
});
document.querySelectorAll("[data-view]").forEach((button) =>
  on(button, "click", () => {
    arena?.setView(button.dataset.view);
    document
      .querySelectorAll("[data-view]")
      .forEach((view) =>
        view.setAttribute("aria-pressed", String(view === button)),
      );
    announce(`${button.textContent} selected.`);
  }),
);
on($("reset-camera"), "click", () => {
  arena?.resetView();
  document
    .querySelectorAll("[data-view]")
    .forEach((view) =>
      view.setAttribute(
        "aria-pressed",
        String(view.dataset.view === "isometric"),
      ),
    );
  announce("Camera reset to isometric view.");
});
const selectNode = (id) => {
  $("selection-info").textContent =
    nodeDescriptions[id] ?? nodeDescriptions.guardrail;
  document
    .querySelectorAll("[data-node]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.node === id)),
    );
};
document.querySelectorAll("[data-node]").forEach((button) =>
  on(button, "click", () => {
    arena?.selectNode(button.dataset.node);
    selectNode(button.dataset.node);
  }),
);
on($("try-own-text"), "click", (event) => {
  event.preventDefault();
  $("custom-payload").scrollIntoView({ block: "center", behavior: "instant" });
  $("custom-payload").focus({ preventScroll: true });
});
on($("load-payload"), "click", () => {
  $("custom-payload").value = state.scenario.turns[state.turn].payload;
  $("custom-payload").focus();
  feedback("Selected payload loaded. Edit it, then run inspection.");
});
on($("inspect-form"), "submit", (event) => {
  event.preventDefault();
  const payload = $("custom-payload").value;
  const threshold = Number($("threshold").value);
  if (!payload.trim()) {
    feedback("Enter a payload before running inspection.", true);
    $("custom-payload").focus();
    return;
  }
  if (payload.length > 16000) {
    feedback("Payload exceeds the 16,000-character limit.", true);
    return;
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    feedback("Threshold must be between 0 and 1.", true);
    return;
  }
  stopPlayback();
  try {
    const result = inspectPayload(payload, {
      history: state.scenario.turns
        .slice(0, state.turn)
        .map((turn) => turn.payload),
      threshold,
    });
    state.custom = result;
    state.customTrace.push({
      atTurn: state.turn + 1,
      inspectedAt: new Date().toISOString(),
      result,
    });
    state.customTrace = state.customTrace.slice(-50);
    state.tab = "raw";
    render();
    feedback(`Inspection complete. ${verdictLabels[result.verdict]}.`);
  } catch (error) {
    feedback(
      error.message || "Inspection failed. Check the payload and try again.",
      true,
    );
  }
});
on($("export"), "click", () => {
  try {
    const trace = {
      schemaVersion: 1,
      product: "ShadowPrompt",
      mode: "browser-local-replay",
      exportedAt: new Date().toISOString(),
      scenario: {
        id: state.scenario.id,
        name: state.scenario.name,
        category: state.scenario.category,
      },
      selectedTurn: state.turn + 1,
      provenance: {
        timing:
          "performance.now; full local inspection; milliseconds; browser timer resolution applies",
        entropy: "Shannon bits per Unicode code point",
        similarity: "local lexical cosine; no embedding model",
        modelConnection: false,
        customHistory: "preceding scenario turns",
        retainedCustomInspectionLimit: 50,
      },
      turns: state.scenario.turns.map((turn, index) => ({
        turn: index + 1,
        label: turn.label,
        raw: turn.payload,
        expectedVerdict: turn.expectedVerdict ?? null,
        result: state.results[index],
      })),
      decisions: state.results.reduce(
        (counts, result) => {
          counts[result.verdict] += 1;
          return counts;
        },
        { quarantine: 0, review: 0, "no-match": 0 },
      ),
      customInspections: state.customTrace,
    };
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    clearTimeout(exportTimer);
    exportUrl = URL.createObjectURL(
      new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = exportUrl;
    anchor.download = `shadowprompt-${state.scenario.id}-trace.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    exportTimer = setTimeout(() => {
      URL.revokeObjectURL(exportUrl);
      exportUrl = null;
    }, 1000);
    feedback(
      `Trace exported: ${trace.turns.length} scenario turns and ${trace.customInspections.length} custom inspections.`,
    );
    announce("Trace exported as JSON.");
  } catch {
    feedback(
      "Trace export failed. Try again in a browser that supports file downloads.",
      true,
    );
  }
});

inspectScenario();
render();
function setRendererStatus(status) {
  $("renderer-status").textContent = status;
  const unavailable = /unavailable|context lost/i.test(status);
  document.querySelectorAll("[data-view], #reset-camera").forEach((button) => {
    button.disabled = unavailable;
    button.title = unavailable
      ? "3D camera unavailable. Inspection remains available."
      : "";
  });
  document.querySelector(".arena-help").textContent = unavailable
    ? "3D camera unavailable. Use the role controls and turn sequence to inspect."
    : "Drag to orbit. Scroll to zoom. Select a node to inspect its role.";
}
try {
  arena = new Arena($("arena"), {
    onSelect: selectNode,
    onStatus: setRendererStatus,
  });
  arena.setEvent({
    turn: 1,
    total: state.scenario.turns.length,
    verdict: currentResult().verdict,
  });
} catch {
  $("arena").append(
    text(
      "p",
      "The 3D renderer is unavailable. Use the turn sequence and role controls to inspect the full scenario.",
      "arena-fallback",
    ),
  );
  setRendererStatus("Text inspection available / WebGL unavailable");
}
on(document, "visibilitychange", () => {
  if (document.hidden && state.playing) {
    stopPlayback();
    render();
  }
});
function dispose() {
  disposed = true;
  stopPlayback();
  clearTimeout(exportTimer);
  if (exportUrl) URL.revokeObjectURL(exportUrl);
  arena?.dispose();
  events.abort();
}
on(window, "pagehide", (event) => {
  if (event.persisted) {
    stopPlayback();
    render();
  } else dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
