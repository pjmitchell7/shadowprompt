# Shelfday shopping and chat review

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
