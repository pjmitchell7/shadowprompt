# Shelfday guidance-only design review

Reviewed and refined 2026-10-06 on the local uncommitted storefront. The accepted implementation base is `801b2c2dfa0d789c78831de60d08469721a41600`.

## Scope and evidence

Applied the staged Impeccable 4.5.0 guidance at `C:/Users/mitch/Downloads/impeccable-staging`, pinned to `cf3d2fa07d3ad1814ac5fbbbb5b2043b795eaef1`. Read the main skill and relevant critique, onboard, audit, polish and craft guidance. This was a bounded guidance-only review, not completion of the automated audit or critique commands. The detector, launcher, dependency install and downloaded engine were not run. Installed Node remains 22.11.0; the staged engine requires at least 22.18.

Used the approved storefront plan, renovation specification and actual production browser renders as project context. No PRODUCT.md or DESIGN.md was found. Reviewed opening, tutorial and evidence views at 1440 and 320 CSS pixels. A separately authorized read-only reviewer assessed the screenshots and reported usability findings; only the primary implementation task wrote files.

The existing warm Shelfday colors, Plex typography, original lamp illustrations, store/task order and advanced navigation were retained. There was one refinement batch, followed by a bounded render confirmation and a functional guide defect repair.

## Before and after

| Finding | Before | Final behavior |
| --- | --- | --- |
| Useful first action | The prominent task action tried to open a missing recording. | Find a matching lamp checks the catalog, names Clip Light at $39, highlights its card and focuses its Save action. A visible note identifies catalog facts and says no AI request is made. |
| Honest recording affordances | Several active recording buttons led only to an unavailable state. | The missing-recording state explains what remains usable. Recording condition actions are disabled while the manifest is empty. Model modes sit in an expandable section; Try live stays disabled. |
| Assistant density on mobile | Expanded mode controls and trial choices made the assistant panel long before the products. | The working review-inspection action stays visible; filter controls and unavailable model details use separate disclosures. The approved task/assistant/catalog order remains. |
| Contextual tutorial | The guide stayed above the shopping task while later targets appeared much farther down the page. | Each guide card moves directly before its target, opens needed disclosures, highlights the target and offers a descriptive link. Back, Next, Skip, Close, Replay and Escape retain focus behavior. |
| Evidence comprehension | Routine source rows and long input hashes competed with the conclusion. | A plain-language count leads: filtering holds back one of four reviews. The flagged source and scanner match stay visible. The three included reviews and input/context fingerprints are expandable. Exact context exports are preserved. |
| Comparison feedback | Failed shortlist items had only a generic does-not-fit result. | Each failure names the constraints it misses, such as Over $50, AC adapter power and No desk clamp, in a subdued status row. Qualifying Clip Light names all three met needs. |

The ShadowPrompt switch now updates the review inclusion count immediately from the actual shared context policy and marks the selected Off/On preview. This changes delivered review context only; it is not a measured model outcome.

## Verification after refinement

- 27 JavaScript unit/integration tests passed, including bounded local HTTP mock-provider tests.
- Production recording gate passed with zero genuine captures; Vite build passed using existing locked dependencies.
- Production storefront browser checks passed at 320, 360, 400, 768, 1024 and 1440 pixels, including the catalog action, disabled unavailable modes, relocated guide focus/target/Escape, actual filtering exports, case draft restoration and lazy workbench navigation.
- Doubled text at 320 pixels, reduced motion and forced colors passed targeted browser checks. No document overflow or browser errors remained.
- The initial relocated-guide implementation omitted its panel reference. The browser focus assertion caught the error; the reference was fixed and the full relevant storefront check then passed.
- Source constraints and Git whitespace checks passed after the code refinement. Final documentation was checked separately.

Existing Python tests (58 passed) and the full workbench browser suite passed earlier in this implementation task. They were not rerun for these storefront copy/layout changes; the storefront suite still exercises workbench navigation, draft preservation and lazy arena behavior.

Final unthrottled local production sample: LCP 1436 ms, CLS 0, shortlist DOM update 0.60 ms; initial JavaScript 16.95 KB gzip and CSS 6.94 KB gzip. These are lab observations, not physical-device or field performance results. The existing lazy Three.js bundle retains its greater-than-500-KB uncompressed advisory.

## Screenshot evidence

Local opening captures: [desktop before](C:/Users/mitch/Documents/Codex/2026-10-06/task-2/evidence/impeccable/before-opening-1440.png), [desktop after](C:/Users/mitch/Documents/Codex/2026-10-06/task-2/evidence/impeccable/after-opening-1440.png), [mobile before](C:/Users/mitch/Documents/Codex/2026-10-06/task-2/evidence/impeccable/before-opening-320.png), [mobile after](C:/Users/mitch/Documents/Codex/2026-10-06/task-2/evidence/impeccable/after-opening-320.png).

Tutorial captures: [mobile guide after](C:/Users/mitch/Documents/Codex/2026-10-06/task-2/evidence/impeccable/after-guide-320.png), [desktop targeted review after](C:/Users/mitch/Documents/Codex/2026-10-06/task-2/evidence/impeccable/after-review-1440.png). Before/after guide and review captures for both sizes remain in the same folder. Browser assertions and metrics are in `C:/Users/mitch/Documents/Codex/2026-10-06/task-2/evidence/storefront/shop-browser-evidence.json`.

Two final images were successfully saved to ChatGPT Library with the supported direct upload tool, and a read confirmed their names and sizes:

| Library filename | Library identity | Size |
| --- | --- | --- |
| after-opening-1440.png | libfile_b12f861dac8c8191ab48133d35af02d0 | 90,683 bytes |
| after-opening-320.png | libfile_1138eef67ef88191ad68ae6faa6eb86f | 47,489 bytes |

The direct tool was used to honor the instruction excluding new executable tools; no Library upload/helper executable was downloaded or run. The returned identity/version metadata is retained beside the local images in `library-export.json` rather than applying helper-managed extended attributes. This does not affect the successful Library copies.

## Remaining limits

No genuine model response recording exists. The replay adapter remains explicitly unavailable and live mode remains disabled pending authorized provider/model, credential use, request/token/dollar budget, retention and activation. No model call, credential-value read, spending, public hosting, push or deployment occurred. The local backend remains loopback-only, and the browser does not activate its assistant endpoint.

Real screen readers and physical mobile devices were not tested. This is targeted usability and keyboard/reflow evidence, not accessibility certification or proof of general prompt-injection protection.
