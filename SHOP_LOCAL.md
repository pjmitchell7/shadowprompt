# Shelfday local slice

Shelfday is a fictional four-product lamp store. Pip's recorded assistant shell is separate from the working catalog and shortlist. No accounts, payments, checkout, customer data, model provider or credential access are implemented.

## Run locally

Use the locked frontend dependencies and Node 22.11 or newer:

```sh
npm run dev
```

Open the server's `/shadowprompt/` URL. Hash routes are `#/shop`, `#/inspect` and `#/case`; existing inspection anchors remain supported. The workbench mounts once, retains editor state and stops playback/arena rendering when hidden. Its 3D bundle is loaded only when advanced inspection opens.

The minimal separate backend uses no additional dependencies:

```sh
npm run shop:server
```

It binds only to `127.0.0.1:8787`. Open `http://127.0.0.1:8787/api/shop/catalog` to inspect the seeded catalog/review records, or `/api/shop/status` for the unavailable provider state. The frontend shares these seed and policy modules but operates offline; it does not make automatic requests to this service. The service does not activate Try live.

## Assistant endpoint contract

`POST /api/shop/run` accepts JSON containing only these fields:

```json
{
  "fixtureVersion": "shelfday-1",
  "question": "Find a USB-C lamp that clamps to my desk and costs less than $50.",
  "condition": "poisoned-on",
  "runId": "local-example-1"
}
```

Conditions are `clean`, `poisoned-off` and `poisoned-on`. The server reconstructs catalog, reviews and trusted instructions. It rejects client-supplied allowed-source lists, instructions, arbitrary questions and unknown fields. Missing providers return HTTP 503 with a clear unavailable reason and the actual locally computed context. No authored response substitutes for an unavailable model.

Host and Origin checks restrict access to the bound loopback service. There is no permissive CORS header or Vite proxy. This service is not a public endpoint. Defaults bound requests to 8,192 bytes, 12 POST requests/minute, two concurrent adapter calls, 100 total test-adapter attempts per process, 5-second request/header timeouts and a 2-second adapter timeout. Test adapters must supply token counts and respect 12,000 input/1,000 output token caps; their returned text is limited to 16,000 code units and their response object to 32,000 bytes. Timeout/cancellation propagates through AbortSignal. The CLI never loads a provider SDK or reads credentials.

`createShopServer({testProvider})` is an explicit test seam. It accepts only an adapter marked `kind: 'test-double'` with `generate`, `countInputTokens` and `countOutputTokens`. Mock responses are returned as `origin: 'test-double', testOnly: true`; they cannot enter the production recording manifest or be presented as recorded/live model evidence. Real-provider activation requires a future authorized implementation.

## Evidence contracts

The fixed question, catalog and trusted instructions occupy separate fields from attributed external reviews. The shared policy invokes the existing `inspectPayload` with empty history on each review. Off includes original reviews and labels scanning diagnostic. On excludes quarantined sources, holds review verdicts out of automatic delivery and includes no-match sources without a safety guarantee. Inspection errors fail the context construction. Exact raw source text is preserved; normalized text is never silently forwarded.

Snapshots are deeply frozen. SHA-256 uses stable UTF-8 JSON without source normalization. The poisoned Off/On pair has the same original digest and different delivered-context digests. Local preview exports are `shadowprompt.local-context-preview`, explicitly contain `modelRequest: false`, and never claim a model outcome.

`shadowprompt.shop-trial` version 1 has a 200,000-byte exported UTF-8 limit. It stores exact clean/poisoned originals, three conditions, source decisions, delivered contexts, response digests, UTC attempt times, provider/model/settings/safety/token limits, response identifiers, status, usage, latency and pricing basis when known. Unknown values use null. Paired model/settings/template/scanner mismatches, edited inputs, corrupted digests and test provenance are rejected. Catalog checks separately flag incorrect SKU/price/connector/mount; a structurally qualifying response still requires semantic review of its raw prose.

The production `RECORDINGS` manifest is empty. A future recording must be a genuine reviewed capture, named in the manifest with its digest and review date. The build gate rejects invalid/test records and unlisted files in `public/recordings`. The UI has no authored-answer fallback. Archived response provenance and historical context are disclosed separately from the current local scanner preview.

Fixture handoff to the version-1 case builder leaves response fields unset when no genuine record exists. The protected response is never placed in the clean branch. Applying a fixture over existing work offers a choice and retains a restorable draft, including unchecked response text and imported exact newline values. Navigation preserves the existing import/copy revision guards.

## Limits and remaining dependencies

The local control set has 12 benign and eight malicious authored sources. The existing scanner falsely withholds a benign attack quotation and misses a keyword-free instruction; the UI exposes both actual results. These controls are not a real-model accuracy benchmark. Cross-source and multi-turn attacks are outside this first-slice policy.

Genuine capture and Try live require a selected normal safeguarded provider/model, designated account/project/credential, retention choice, token limits, explicit request/dollar budget and activation approval. The plan's proposed 39 attempts/US$5 ceiling is not authorization. No model request, credential-value read, spending, GitHub push or deployment happened during this implementation.
