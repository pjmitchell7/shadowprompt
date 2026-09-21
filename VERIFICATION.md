# Renovation verification

Review date: 2026-09-21.

Decision: local release gates passed. The complete source change, new modules, tests, build configuration and staged removals were reviewed against [RENOVATION_SPEC.md](RENOVATION_SPEC.md). No blocking findings remain within the reviewed scope. This records local verification before the release commit and remote deployment.

## Environment

| Component | Recorded environment |
| --- | --- |
| Operating system | Windows, local development host |
| Node.js / npm | 22.11.0 / 10.9.0 |
| Python | 3.12.6, including a clean isolated environment |
| Browser | Headless Chromium 151.0.7922.34 through Playwright |
| Graphics | ANGLE, Vulkan 1.3.0, SwiftShader Device (Subzero), software rendering |
| Production URL under test | Local Vite preview at the `/shadowprompt/` subpath |

The release workflow independently targets Ubuntu, Node.js 22 and Python 3.12. Local Windows results do not substitute for a successful remote workflow run.

## Release checks

| Check | Result |
| --- | --- |
| Clean `npm ci` | Passed with the committed dependency lockfile |
| `npm audit` | Zero reported vulnerabilities at review time |
| `npm test` | 12 tests passed |
| `npm run build` | Production build passed |
| Clean Python requirements installation | Passed; `pip check` reported no broken requirements |
| `python -m pytest -q` | 49 tests passed |
| `npm run test:browser` | Production browser regression suite passed |
| `python scripts/check_source.py` | Passed for maintained authored text, including this report |
| `git diff --check` | Passed |

The JavaScript tests check raw and canonical delimiters, multilingual joining characters, directional control evidence, Unicode entropy, lexical cosine, zero-duration timing, bounded history, reconstruction, encoded payloads and scenario expectations. Arena restoration tests use real Three.js materials to verify verdict paths, branch visibility, node selection and dimensions after recovery. A disposed arena cannot reactivate through a late restoration callback.

The Python tests cover application import, OpenAPI, health and scan routes; raw and canonical inspection; request and canonical expansion limits; bounded conversation state; concurrent request isolation; option behavior; synthetic canaries; and benchmark count reconciliation, empty samples and zero recall. Existing research fixture tests remain, with hardware-independent duration validity checks replacing unsupported latency assertions.

The browser suite checks finite playback, pause, reset, step, scenario changes, keyboard selection and retained focus, evidence tabs, custom inspection, threshold changes, inert rendering of malicious markup, Unicode-control visibility and JSON trace contents. It also checks camera controls, role selection, responsive layout, reduced motion, idle frame termination, the hidden-document handler and teardown. Forced WebGL initialization failure leaves inspection available. Actual context loss and restoration were exercised using `WEBGL_lose_context`; camera controls disable while unavailable and recover afterward.

## Review findings resolved

- Escaped unpaired Unicode surrogates could produce an API serialization error. Prompt and history validation now return a safe HTTP 422 response; valid supplementary Unicode remains supported.
- API history counts described supplied turns as used context even after eviction. Responses now distinguish supplied history from the prior turns actually retained for the current decision, with count and character eviction tests.
- Uncalibrated confidence constants were removed from the retained Python frontier heuristic results.
- Form boundaries did not meet non-text contrast requirements. Select, textarea and threshold input borders now exceed 3:1 against both their interior and adjacent surfaces, verified from computed browser colors.
- Camera controls remained active without WebGL. Their availability and explanatory text now follow renderer state.
- Changes made during context loss could restore stale arena materials and selection. Restoration now reapplies the latest event and selected role and refreshes dimensions before rendering.

## Visual and accessibility review

Desktop and mobile screenshots show one operational workspace with a matte slate palette, steel borders, neutral sans-serif labels and monospace evidence. The arena uses distinct code-generated attacker, guardrail and target geometry with persistent role labels and equivalent HTML controls. No matrix rain, CRT overlay, glow, decorative icon set, promotional narration, resume or personal biography remains in the maintained product.

The production browser suite passed at widths of 1440, 768, 360 and 320 CSS pixels. Additional layout inspection covered 1024 and 390 pixels. No horizontal document overflow was observed at these six widths, and sampled visible text was at least 12 CSS pixels. At 1440 by 900, the four telemetry cells and complete default arena viewport are visible together. Smaller screens stack the workspace with ordinary page scrolling.

Keyboard selection, tab navigation, visible focus and form boundary contrast were checked. Text colors and hierarchy were reviewed against the dark surfaces. This is targeted accessibility verification, not a complete assistive-technology or WCAG conformance audit.

## Rendering measurements

At 1440 by 900 CSS pixels and device pixel ratio 1, active camera transitions produced 79 positive frame intervals: median 16.7 ms and 95th percentile 16.8 ms. Intervals were measured separately for each transition without removing long positive samples. After settling, zero additional animation frames were delivered during a 500 ms idle observation.

These observations demonstrate approximately 60 Hz scheduling during the sampled transitions on this headless software renderer. They are not a hardware-independent frame-rate guarantee, a physical-device benchmark, or a measurement of model throughput. Renderer pixel ratio is capped at 1.75. Local inspection timings remain measured values and may exceed one millisecond, especially during startup; no minimum clamp, invented jitter or latency SLA is applied.

## Build and deployment boundary

The production base is `/shadowprompt/`; Three.js, OrbitControls and fonts are bundled locally. Third-party license notices are retained. Obsolete frontend implementations, Streamlit promotional UI, recruiting documents, media and tracked bytecode were removed from the maintained tree.

The GitHub Actions workflow installs locked dependencies, checks source constraints, runs Python and JavaScript tests, builds the application and exercises the production browser before uploading the Pages artifact. Deployment is restricted to `main`, depends on verification and uses that tested artifact. The verification job has read-only repository access; the deployment job receives Pages and identity-token permissions.

Remote build and public availability must be confirmed from the release workflow after the verified commit is pushed. A local build alone does not establish deployment. GitHub Pages serves the browser inspection console; it does not deploy the Python API or connect an external LLM, proxy, embedding database or SIEM.

## Remaining scope limits

Browser and Python inspection are separate heuristic implementations with documented coverage differences. Fixture success is not evidence of general prompt-injection prevention. False positives and false negatives remain possible, and a no-match verdict is not proof of safety. The Python API uses request-contained state and the documented localhost binding; authentication, rate limiting, persistent sessions and remote model transport are outside this release.

Source checks cover maintained authored text and encoded HTML entities. Dependencies, binary files and verbatim third-party license notices are excluded. This renovation does not add a repository license grant or claim independent security certification.
