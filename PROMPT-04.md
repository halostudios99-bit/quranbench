# Prompt 04 — corpus loader and search engine

Paste everything below the line into Claude Code, in the `quranbench` folder.

---

Read `CLAUDE.md`, `docs/architecture.md` and `docs/extensibility.md` first. Corpus v0.3.0 is complete in `packages/corpus-build/out/v0.3.0/`.

This prompt builds the two TypeScript packages that sit on top of it. No UI, no database, no Next.js.

## Part A — `packages/corpus`

A typed loader for corpus artifacts.

- Types mirroring the artifact schemas: `Source`, `Surah`, `Segment`, `Token`, `Manifest`, `NumberingScheme`
- `loadCorpus(version?: string): Corpus` — reads artifacts from disk, validates against the manifest checksums, returns typed in-memory structures
- Fail loudly on checksum mismatch or schema drift. A corrupted corpus must never load silently.
- `Corpus` exposes the manifest, so any consumer can report exactly which version and build parameters produced a result
- No behaviour beyond loading and typing. No search, no computation.

## Part B — `packages/search`

An in-memory index and query engine. Pure functions. No I/O beyond receiving an already-loaded `Corpus`. No database, no network, no Next.js imports.

### Index

Built once from a `Corpus`:

- forward: token id → token
- inverted: exact Uthmani form → token ids
- inverted: normalised form → token ids
- positional structures sufficient for proximity and adjacency without scanning
- segment and surah membership

Design for the corpus being small. Prefer straightforward typed arrays and maps over cleverness. Measure before optimising.

### Query types

Implement all of these:

- **exact** — match `text_uthmani` exactly
- **normalised** — match `text_normalised` (diacritic- and orthography-insensitive)
- **prefix / suffix** — normalised form starts or ends with a string
- **pattern** — wildcard over normalised forms, `*` for any sequence, `?` for one character
- **proximity** — `A NEAR/n B`, both terms within n tokens, same segment by default, with an option to allow crossing segment boundaries
- **adjacency** — `A FOLLOWED_BY B`, ordered
- **boolean** — AND, OR, NOT over the above, correctly nested
- **scoped** — restrict any query to a surah, a surah list, or a segment range
- **reference** — resolve `2:43`, `2:43-45`, `2:255` to segments under the active numbering scheme

Do **not** implement root or lemma queries. Morphology is not ingested yet. Define the interface so they slot in later without changing the shape of `SearchResult`, and leave them unimplemented rather than stubbed with fake behaviour.

### Results

Every result carries:

- matched token ids and their segments
- the `ComputationParams` used (already defined in `packages/search/src/params.ts`)
- the total match count
- the corpus version

A result must be sufficient, on its own, for a reader to reproduce the query. That is the product's core promise expressed as a type.

### Query parsing

A small parser turning a query string into a typed query tree. Keep the syntax close to what the design's example chips imply:

```
zakat NEAR/10 salah
pattern:مف*ول
surah:2,3 AND normalised:الصلوة
"ٱلزَّكَوٰةَ"
2:43
```

Parse errors return a typed error with position information, never throw.

## Tests

- Every query type has unit tests with hand-written expected results — do not generate expectations from the code under test
- `ٱلزَّكَوٰةَ` exact search returns a count; assert the count is stable and record it in the test as a documented figure
- Normalised search for the same word returns at least as many results as exact
- Proximity: a known verse containing both salat and zakat within 10 tokens is found; a control pair far apart is not
- Reference resolution: `2:43` resolves to one segment, `2:43-45` to three, `9:1` exists, `2:0` does not resolve
- Boolean nesting: `A AND (B OR NOT C)` evaluates correctly against a small fixture
- Parser: malformed queries return typed errors, never throw
- Pattern search does not match across token boundaries

## Benchmark

Add a benchmark, run as part of the test suite, asserting hard budgets on the real corpus:

- index build from a loaded corpus: under 2 seconds
- p95 for any single-term query: under 10ms
- p95 for a proximity query: under 25ms

Report actual measured figures. If a budget is missed, report it rather than loosening it — the number matters more than passing.

## Report back

State: index build time, memory footprint of the loaded index, measured p95 latencies for each query class, the match count for `ٱلزَّكَوٰةَ` exact and normalised, and any query type where the implementation is weaker than it should be.
