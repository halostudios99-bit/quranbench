# Prompt 11 — public API, MCP server, data downloads, method page, PWA

Read `CLAUDE.md`, `docs/architecture.md`, `docs/extensibility.md` and `docs/design-system.md` first.

This is the prompt that turns the site into infrastructure. The test at the end of `docs/extensibility.md` §9 is the acceptance criterion — a stranger should be able to cite, download, reproduce, query and ground an AI on this data.

## Part A — public API

Per `docs/extensibility.md` §5: **the web app consumes the same API third parties do.** No private endpoints returning richer data.

- Versioned under `/api/v1/`
- Read endpoints: verse, verse range, token, root, search, surah, corpus manifest
- No key required for reads. Published, generous rate limits.
- OpenAPI schema **generated from the implementation**, not hand-written, served at `/api/v1/openapi.json`
- Every response carries corpus version and computation parameters
- Content negotiation: corpus pages serve JSON-LD at the same URL under `Accept: application/ld+json`

If the web app currently reaches into `packages/search` directly for anything the API cannot express, add it to the API rather than keeping the shortcut. Report any place you had to do this.

## Part B — MCP server

`packages/mcp` — a thin wrapper over the public API. Not a separate integration.

Tools: search the corpus, fetch a verse, fetch a token with morphology, fetch a root and its occurrences, resolve a reference, get the corpus manifest.

- Every tool response includes corpus version and the query that produced it, so an AI's answer is attributable.
- Document how to connect it in `docs/mcp.md`, with a worked example.
- If it needs anything the API lacks, add it to the API — do not special-case.

## Part C — data downloads

`/data` — the page that makes the project citable.

- Full dataset downloads per corpus version, with sha256 and byte size
- Per-licence separation made obvious: CC-BY text, GPL morphology, per-edition translations. A downloader must be able to take only the parts they can use.
- `Dataset` JSON-LD structured data
- A **How to cite this version** block producing a copyable citation string including version and checksum
- The third-party verification procedure, with the exact command
- Link the identifier policy

## Part D — method page

`/method` — the credibility page. Written for a reader, not a developer.

Explain plainly: which text edition, which morphology source and its licence, how normalisation works, how the basmala is handled and why numbering is a parameter, what is computed versus asserted, how to reproduce any figure on the site, and where the known limitations are — including that verse slot labels remain Kufan-derived and translation alignment is verse-level only.

Be honest about limitations. This page is worth more than any feature.

## Part E — PWA

- Manifest with maskable PNG icons at 192 and 512
- Service worker caching the app shell
- Offline corpus search: cache the corpus artifacts and run search client-side when offline. The index is ~175MB in memory — measure what is actually feasible in a browser and **report honestly**. If full offline search is not viable, ship offline reading of cached pages and say so plainly rather than shipping something that fails on a phone.
- Never cache database-backed content without explicit user action

## Tests

- Every API endpoint returns corpus version and params
- OpenAPI schema matches actual responses — generated, verified
- MCP tools return attributable results
- `/data` checksums match the artifacts on disk
- The citation string round-trips to a resolvable version
- Service worker registers; offline navigation to a cached page works
- No-JS and axe on `/data` and `/method`
- The five-part test in `docs/extensibility.md` §9 — write it as an executable integration test and report which parts pass

## Report back

Which of the five infrastructure tests pass, honest findings on offline search feasibility with measured numbers, any place the app still bypasses the public API, and what remains unbuilt across the whole project.
