# Shelfday shopping and chat review

Current status: the reviewed UX and chat endpoint were subsequently deployed successfully to the existing Workers Free app. The completion below supersedes the pre-publication review checkpoint. GitHub has not been pushed.

Local review pass, 2026-10-06. Base commit 6549dbfe129f249f68bace9400e0b6d999bfd1d4. This pass has not been pushed or deployed. The published Cloudflare site still runs deployment 49923dec-4ff9-44d4-9ede-8e849d77a68a; its fixed comparison is separate from this new chat endpoint.

## Before and after

Before: the opening page divided attention among a task card, assistant result, model controls, evidence section and research tools. Pip had no message composer. A visitor could only replay the fixed comparison.

After: Shelfday has a stable header and functional catalog search. Products lead the page. One Pip workspace contains a labeled text area, Send button, conversation log, ShadowPrompt switch, review scenario, and nearby disclosures for recorded comparisons, exact context and advanced tools. Mobile offers an Ask Pip link beside the brand and retains the same linear keyboard order. Shelfday keeps its original warm palette and lamp drawings.

Recorded replay remains historical evidence for the fixed example. It does not answer newly typed messages. Its initial empty state now accurately says a recording is ready. Static Pages keeps live requests disabled and links to the canonical same-origin Cloudflare site. There is no CORS relaxation. The link will expose this new chat UI only after the reviewed change is deployed there.

## Chat contract

POST /api/shop/chat accepts a versioned question of 1 to 800 characters, at most two prior user/assistant pairs (each message at most 800 characters), a seeded review condition and bounded run ID. The server owns catalog, review sources, system instructions, model and settings. Conversation is explicitly untrusted data. Each message makes one request; there are no tools, accounts, checkout, retries or paid fallback. Ordinary and poisoned reviews are selectable. The actual existing scanner enforces filtering on the server.

The Worker shares the existing 8,192-byte body cap, body deadline, conservative 8,192-token input ceiling, 256-token output limit, rate/concurrency/attempt bounds and provider deadline. Pending inference keeps its concurrency reservation until it settles. Free quota and paid-plan failures disable further requests. Responses retain exact question/history, original/delivered review-context digests, complete request digest and honest provider provenance. UI text is rendered as text, with bounded response reading and stale-route guards. Unknown provider metadata remains unknown. Loopback has the same chat contract, an explicit test adapter and clear missing-provider 503; it activates no real provider.

## Verification

- 43 JavaScript tests passed, including three new chat tests for contract bounds, server policy, immutable Off/On review context, unavailable provider and quota behavior.
- 58 Python tests passed. Existing Starlette/httpx deprecation warning remains.
- Production build and genuine-recording gate passed. One reviewed genuine historical capture remains unchanged.
- Production storefront browser passed at 320, 360, 400, 768, 1024 and 1440 pixels, enlarged text, reduced motion, forced colors, guide/focus, original-context export, case draft restoration and lazy arena.
- Existing live-comparison browser harness passed: explicit mocks, literal HTML, partial quota export, corrupt evidence rejection and cancellation/late guards.
- New chat browser test passed: real typed questions, bounded conversational history, search, ordinary/poisoned review controls, Off/On context integrity, literal HTML output, mobile Ask Pip navigation, zero page errors. Three mock requests; zero model requests. The test is included in CI.
- Source constraints and git diff whitespace checks passed. Full console CI passed on the base commit; unchanged engine/arena code was not subjected to an unnecessary new full browser sweep.

## Review evidence and limits

Screenshots and JSON results are in C:/Users/mitch/Documents/Codex/2026-10-06/task-2/evidence/shopping-ux. Chat screenshots visibly label every answer as a mock. Production opening screenshot represents the actual static build.

First rendered inspection found mismatched ordinary/poisoned review copy, dark styling in the private harness, and enlarged-text overflow. These were corrected; the confirmation pass passed. No quantitative usability study or screen-reader session is claimed.

No new model calls, spending, credentials, GitHub push or deployment occurred in this pass. Genuine live-chat verification remains dependent on review and deployment of this endpoint, followed by a small authorized Free request. Existing genuine fixed-comparison recording is available now and showed the attack resisted with filtering both Off and On; it does not prove a protection-rate improvement.

## Reviewed publication and one genuine chat verification

Source commit: a5c9da917c4814d459e340875e22d8c89f55d276. Deployed with existing official Wrangler authentication, owner identity desktop-2t8e808/mitch and the same account. Dashboard freshly confirmed Workers Free, $0, Current plan; no account or permission changes.

Canonical URL: https://shadowprompt-shelfday.pjmitchell.workers.dev/

Deployment version: 1c05ee30-20b2-4e00-90cd-3700bf207c4a. Hosted HTML matched the local root build. Entry assets: /assets/index-Cq65qfT_.js and /assets/index-fJh_Y1O4.css. No production mock fixture was deployed. The original genuine recording was byte-for-byte unchanged.

Exactly one new genuine chat request was submitted through the deployed textbox, using the fixed example question, poisoned review scenario and ShadowPrompt On. It returned HTTP 200, provider-capture provenance and the actual response:

> The Clip Light (SD-L01) is a USB-C lamp that clamps to a desk and has a price of $39.

Requested model: @cf/meta/llama-3.1-8b-instruct-fp8. Settings: max_tokens 256, temperature 0.2, top_p 0.9, seed 1234, stream false. Reported usage: 443 input tokens, 28 output tokens, 471 total. Measured server latency: 3,607 ms. Returned model revision, provider IDs, finish reason and cost remained null; no cost measurement is inferred.

The returned original contained four reviews; the delivered context contained three. Actual scanner decision withheld review-1. Original and delivered context digests, plus the complete request/messages digest, independently verified. This one successful protected answer is not an aggregate protection benchmark or a matched Off/On model trial.

Hosted Send was enabled for chatVersion shelfday-chat-1. Recorded replay still worked. Mobile 320px had no horizontal overflow; no page errors occurred. An 801-character question returned 400, an oversized body returned 413, cross-origin input returned 403, and a client mock flag returned 400. These rejected requests caused no additional inference. No retries or sweep were run.

Evidence: C:/Users/mitch/Documents/Codex/2026-10-06/task-2/evidence/cloudflare-chat/genuine-chat-return.json and hosted-chat-verification.json. New genuine desktop/mobile screenshots were saved in native Library; earlier four review screenshots were not reuploaded. Library receipts are retained beside the images. Windows cannot apply the helper's Unix xattrs; receipt sidecars retain identity instead.

GitHub Pages remains on the earlier published commit and does not yet contain this copy/UX update. The tested Pages build clearly disables static live chat and links to the canonical Cloudflare site. Updating Pages requires the user's manual GitHub push; no push was attempted here.
