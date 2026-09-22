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

## First-use clarity follow-up

On 2026-09-21, the opening was revised to define prompt injection, explain the local inspection tool and provide clear starting instructions. A compact desktop guide stacks on mobile and retains the browser-only scope. The custom-text shortcut scrolls to and focuses the existing editor. Inspection and arena behavior are unchanged.

The production build and existing browser regression suite passed. Additional browser inspection covered widths of 1440, 1024, 768, 390, 360 and 320 CSS pixels, with no horizontal overflow, sampled text below 12 pixels or console errors. Keyboard activation of the new shortcut focused a fully visible editor at all six widths. Desktop and mobile screenshots were reviewed; the full default arena viewport remains visible at 1440 by 900. Astra Ultra source review found no blocking issues against the added first-use acceptance criteria.

## Guided evidence and benchmark follow-up

The guided replay starts on the authority-escalation scenario's second turn. It keeps raw input, the normalized tab, the actual `INJ-001` rule evidence and benign turn 1 selected in sequence with the arena and timeline. It explains that normalization leaves this ordinary-text override unchanged and why word similarity below its threshold did not trigger the quarantine. The guide notes that the verdict only changes this local demo. Visitors can move Back, restart, close the guide, or continue with manual controls.

Each measurement now has an expandable definition next to its value. The definitions describe what the value measures and its limitations. Playback is exposed as a native button named Play example, Pause, and Replay example without toggle state.

The public `main` README at commit `877da45` already accurately distinguished browser demo, local Python API and fixture research scripts. For a stronger audit trail, it now names the six fixed fixtures, reproduces the limited single-run counts, and explains why the 100% precision/recall output cannot establish real-world attack detection. The Python report now lists those fixture names, iteration count and total fixture evaluations. Its output field names describe samples rather than attacks blocked. Python aliases preserve existing in-process attribute readers.

The guided replay browser regression verifies each stage, selected scenario, turn, evidence tab, matched rule, below-threshold explanation, benign no-match, backward navigation and close behavior. It also checks that the main playback control is a button, is not exposed as a checkbox, and changes visible names during playback. The metric descriptions are opened and checked in the browser. The opening action is checked in the first viewport at desktop and mobile widths.

On 2026-09-22, the production build passed. `npm test` passed 12 tests, `python -m pytest -q` passed 49 tests, `npm run test:browser` passed in Chromium 151 at 1440, 768, 360 and 320 CSS pixels, and `python scripts/check_source.py` passed for 48 authored text files. The browser run exercised actual WebGL context loss and restoration. Its opening screenshots were reviewed at 1440 by 900 and 360 by 900. The first action remained visible, and neither view had horizontal overflow. `git diff --check` passed.

The benchmark was rerun with `python run_demo.py --cli --iterations 1`. It reported six evaluations across five fixed attack fixtures and one benign fixture: 5 true positives, 0 false positives, 1 true negative and 0 false negatives. Timing measured Python `inspect_stream` only. These counts do not measure model behavior or blocked requests. The current browser still runs local heuristics only.
