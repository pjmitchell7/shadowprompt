# ShadowPrompt Renovation Specification

Status: Implemented and locally verified; see VERIFICATION.md for release evidence.

## Product boundary

ShadowPrompt is an adversarial inspection platform with a tactical visualization of multi-turn prompt-injection attempts. The public GitHub Pages application is a browser-local inspection and replay console. It must identify this operating mode clearly. The Python package provides a separate inspection engine and API. Publishing the console does not deploy a live LLM proxy, remote model, SIEM transport, or production security perimeter.

The product must support an analyst's workflow: select an attack scenario, follow its turns, inspect the submitted payload and rule evidence, compare the observed decision with the scenario's expected decision, and export the trace. Controls and metrics must describe implemented behavior.

## Adversarial Complaint Council

### Senior AppSec and SOC lead

- Telemetry currently mixes measurements with invented assurance. `js/app.js:595` supplies hardcoded gambit traces; `js/fuzzer/attack_suite.js:151-162` masks zero recall with a 0.98 fallback and constructs a NIST score. `js/app.js:255` presents conclusive interception language that exceeds the scanner's evidence.
- The page reports a connected SIEM transport at `index.html:791`, but no frontend network transport exists. `shadowprompt/core/proxy.py:138` returns a dictionary rather than transmitting an event.
- Benchmark and latency claims have no defensible deployment scope. A small repeated fixture suite cannot establish general precision, recall, compliance, or a production latency SLA.
- The API bypasses the combined core inspection pipeline. Conversation history must be bounded and separated between sessions; ordinary requests must not contaminate another request's verdict.
- Inspection evidence must expose raw payloads, Unicode transformations, rule matches, and the actual basis for similarity decisions. Lexical similarity is not an embedding model and must never be labeled as one.

### Staff product designer and design systems lead

- Seven marketing-style tabs obscure the operational workflow. The central arena, selected turn, and payload evidence should form one aligned console.
- Matrix rain, CRT scanlines, narration, promotional video, rainbow accents, decorative glyphs, glass panels and glowing effects compete with telemetry and undermine hierarchy.
- Tiny HUD labels and mobile framing require a coherent type scale, spacing system, adequate contrast, keyboard access and deliberate small-screen layout.
- The 3D metaphor must distinguish the attacker, guardrail boundary and target model through geometry, labels and position. Color alone must not communicate roles or verdicts.

### Technical recruiter and engineering hiring manager

- Personal credentials and resume links in `README.md:11,178-184` and `index.html:869-920`, recruiting dossiers and tailored resume assets position the repository as a portfolio. Remove them from the maintained product.
- The API cannot import: `shadowprompt/server/api.py:42` uses the built-in `any` rather than `typing.Any`, causing Pydantic schema generation to fail. The existing sixteen tests miss application startup.
- The published integration is nonfunctional: `README.md:78` passes an unsupported constructor parameter; line 84 unpacks three return values when the implementation returns two. A plain dictionary is also returned from a middleware example that requires an HTTP response.
- Runtime CDN dependencies, unbounded Python requirements, absent frontend package metadata and absent CI prevent reproducible release verification.
- `verify_arena_playwright.py` saves to a developer-specific directory and reports success without functional assertions. Screenshots alone do not prove working controls, error-free startup or mobile usability.

## P0: Evidence integrity and working inspection

1. Remove fabricated compliance scores, unsupported certification language, constant latency percentiles, universal detection claims and claims of connected services. Replace published integration examples with executable examples matching the actual public interfaces.
2. Run each displayed browser inspection through the implemented JavaScript engine. Scenario descriptions and expected outcomes may be fixtures; observed decisions, matches and metrics must come from inspection results. Show disagreement when an expected decision differs from the observed decision.
3. Preserve and display the selected turn's raw text as inert text. Display normalized text separately. Identify matched rule IDs, classifications, exact evidence or offsets where available, and the reason for the inspection decision. Treat payload strings as untrusted data throughout rendering and export.
4. Report parsing duration using the measured monotonic clock interval without a minimum-value clamp or fabricated jitter. If the timer returns zero, explain timer resolution. Clearly scope the duration to local parsing and distinguish it from network, token generation and model inference latency.
5. Calculate payload Shannon entropy in bits per Unicode code point. Calculate displayed path depth from the current scenario turn. Label lexical cosine similarity, its threshold and resulting deflection decision accurately; do not imply embeddings or a remote vector database.
6. Repair Python API startup and route inspection through the actual core pipeline. Bound request input sizes, bound conversation history, and provide explicit session isolation or explicit stateless semantics. Wire every accepted API option into behavior or remove it.
7. Inspect both original and canonical forms so normalization cannot introduce an unreported delimiter. Preserve the original and never represent transformed output as automatically safe. Report `No rule matched` when appropriate and use the observed severity rather than a universal critical-interception label.
8. Benchmark summaries must include actual TP, FP, TN and FN counts and sample count. A zero recall result must remain zero. Do not floor timings, substitute favorable results or derive a compliance score. Update the CLI benchmark to use the same honest reporting principles.

Acceptance: benign and adversarial fixture cases yield inspectable results; custom payload edits change evidence and measurements; unsafe markup never executes; startup/OpenAPI/health/scan paths work; oversized inputs fail clearly; separate conversations cannot change each other's results. No live service claim exists without an actual connection and verifiable state.

## P1: Operational console and visual system

1. Replace the marketing navigation with one operational workspace: a compact product header, scenario selection and replay controls, large tactical arena, measured telemetry, turn sequence and payload inspector. Secondary documentation and source links must resolve to real destinations.
2. Use a matte dark palette based on slate and muted steel. Reserve restrained emerald and amber accents for meaningful state. Use neutral sans-serif headings and high-density monospace telemetry. Set shared spacing, border, radius and type tokens; avoid gratuitous glow, gradients and decorative animation.
3. Model attacker nodes, guardrail firewalls and the target LLM core with distinct code-generated geometry and clear labels. Retain the tactical gambit relationship without relying on Unicode chess symbols, stock icons or emojis.
4. Provide OrbitControls with bounded zoom and camera movement, a reliable reset view, clean matte materials and crisp edges. Keep the selected turn synchronized with arena emphasis and the inspector.
5. Implement finite play, pause, step and reset behavior with immediate visible state. Playback must stop at its final turn. Reset must restore the first turn and cancel any pending advancement. Switching scenarios must not inherit a running timer from the prior scenario.
6. Allow complete trace export containing mode, scenario, raw turns, expected and observed decisions, matched rules and metric provenance. Give clear success and failure feedback for available actions. Remove dead controls and placeholder links.

Acceptance: all visible controls have a meaningful implemented response; payload selection and arena state agree; replay never loops unexpectedly or advances after pause/reset; content is readable without glow; no personal promotion, generic decorative glyphs, matrix effects, CRT, narration or promotional video remains in the product.

## P1: Rendering lifecycle, accessibility and responsiveness

1. Render on demand while idle. Continue rendering only for active transitions, playback or orbit damping, and stop when settled. Suspend unnecessary work when the page is hidden. Cancel animation frames and timers, detach listeners and dispose scene resources on teardown.
2. Respect reduced-motion preferences. Provide an accessible non-WebGL fallback with equivalent scenario, turn and evidence access. Handle renderer creation failure and context loss without breaking inspection controls.
3. Use semantic controls, persistent visible focus, programmatic labels and textual status feedback. Keyboard users must be able to select a scenario, inspect every turn and operate playback. Do not hide essential labels inside the canvas.
4. Support a 360 CSS-pixel mobile viewport without horizontal document overflow or clipped controls. Reflow the arena and inspector deliberately. Ensure contrast meets WCAG AA for text and controls, with legible telemetry rather than tiny HUD copy.
5. Target smooth 60 FPS during active motion on an appropriate modern desktop. Bound pixel ratio and scene complexity. Record the measurement environment and limitations. Do not claim a universal FPS guarantee or treat a single browser run as a hardware-independent benchmark.

Acceptance: idle, hidden, reduced-motion and teardown states do not retain unnecessary animation loops; WebGL failure leaves usable inspection; desktop and mobile checks find no console errors or clipped controls; keyboard navigation remains visible; active-frame measurements and their limitations are recorded.

## P1: Reproducible build and Pages delivery

1. Add a Vite production build with pinned frontend dependencies and a committed lockfile. Bundle Three.js and OrbitControls locally. Use a pure CSS design system; remove the Tailwind runtime CDN and unnecessary remote runtime assets.
2. Configure the public asset base for `/shadowprompt/`. Production output must work from that subpath and contain only required product assets.
3. Add GitHub Actions verification and GitHub Pages deployment on `main`. Deploy the tested build artifact. Preserve least necessary workflow permissions and document local build, test and preview steps.
4. Define a reproducible Python installation with appropriate dependency constraints. Document supported runtime versions, API scope and inspection limitations. Remove claims that installation from an unverified package registry is available.

Acceptance: clean install, frontend tests, production build and Python checks pass; local preview uses the production bundle; asset paths work under the repository subpath; Pages workflow is valid and deployable from `main`.

## P2: Repository hygiene and documentation

1. Remove recruiting dossiers, resumes and obsolete promotional assets from the maintained repository. Remove dead frontend implementations and obsolete verification scripts after replacement. Retire the duplicate Streamlit marketing/recruiter UI in `shadowprompt/ui/app.py`; maintain the browser console and CLI/API. Retain legal notices where required and do not invent or grant license rights.
2. Replace the README with product purpose, operating modes, supported behavior, architecture boundaries, setup, verification and deployment instructions. Document measured metrics and detection limitations without invented enterprise assurances.
3. Enforce zero emojis in maintained authored code, comments, commit messages and UI. Enforce zero em dashes in UI copy and documentation, including encoded HTML entities. Scan authored text sources automatically; dependencies and binary files are not authored product copy.
4. Keep all product copy professional, concise and concrete. Remove student, hackathon, academic credential and personal biography material, as well as inflated marketing phrases.

Acceptance: repository searches and automated source checks find no prohibited copy or symbols; every documented command and integration example matches the shipped behavior; no obsolete resume or promotional asset is included in the Pages output.

## Verification and release gates

Phase 2 implementation uses Astra High and follows the priorities above. Add tests that would catch the observed failures rather than asserting implementation constants. Include engine fixtures, malicious rendering cases, replay state transitions, export content, input bounds, session isolation and API startup. Specifically exercise canonicalization delimiter emergence, benign multilingual formatting, zero-case benchmark results and default stateless request behavior. Preserve useful Python core coverage and add a source-constraint scanner.

Implementation ownership may be split into three independent areas: frontend shell, CSS, Vite and Pages/browser verification; inspection engine, scenarios, arena and JavaScript unit tests; Python API/core, documentation, dependency hygiene and obsolete personal asset removal. Coordinate shared interfaces before editing overlapping files.

### Frontend module contract

- `src/inspection.js` exports `inspectPayload(text, { history = [], threshold = 0.72 } = {})`. Return `{ verdict, rules, parseMs, entropy, similarity, threshold, normalized, raw, depth, vectorLog }`. Verdict is `quarantine`, `review` or `no-match`. Each rule is `{ id, name, severity, evidence }`; `vectorLog` is an array of explanation strings. Metrics follow the provenance requirements above.
- `src/scenarios.js` exports `SCENARIOS`, containing at least four scenarios including a benign control. Each scenario is `{ id, name, category, description, turns }`, and each turn is `{ label, payload }`. Optional expected outcomes must remain separate from observed inspection results.
- `src/arena.js` exports `Arena`, constructed with `(container, { onSelect, onStatus } = {})`. Public methods are `setEvent({ turn, total, verdict })`, `setView('isometric' | 'top' | 'attacker')`, `selectNode('attacker' | 'guardrail' | 'target')`, `resetView()`, `dispose()` and `getStats()`.

Phase 3 uses Astra Ultra to review the complete diff against this specification. Verify the production build in a browser on desktop and a 360-pixel mobile viewport. Exercise custom input, scenario selection, every playback control, camera reset, trace export, reduced motion and WebGL fallback. Capture console/page errors and verify animation termination. Review the visual result for restrained color, readable typography and clear analyst workflow.

Commit and push the verified changes directly to `main` as authorized. Confirm GitHub Pages build readiness and deployment status where accessible. Record test results, measured performance context and any remaining limitations without claiming production certification or deployment of external infrastructure.
