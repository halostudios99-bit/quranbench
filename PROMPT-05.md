# Prompt 05 — scope performance and artifact checksums

Paste everything below the line into Claude Code, in the `quranbench` folder.

---

Read `CLAUDE.md` and `docs/architecture.md` first. Prompts 01–04 are complete: corpus v0.3.0 is built, and `packages/corpus` and `packages/search` are implemented and passing.

Two defects to fix. Both were found by independent review after prompt 04.

## Part A — scoped queries are scanning, not intersecting

Measured on the real corpus:

```
normalised:الصلوه                 p95 = 0.02 ms
surah:2 AND normalised:الصلوه     p95 = 13.81 ms
```

Adding a surah scope makes the same query roughly 500× slower and pushes it past the 10 ms budget in `docs/design-system.md`. Scope is currently applied by scanning results rather than intersecting an index.

This matters: scoped search ("search only within selected chapters") is a headline feature, and it is about to be built on.

Required:

- Add index structures that make scope resolution a set intersection: surah → token handle range or sorted handle list, and the equivalent for segments. Because tokens are stored in corpus order, a surah's handles are contiguous — a range check should be sufficient and is preferable to a materialised set.
- Apply scope during evaluation, not as a post-filter, so a scoped query never touches tokens outside the scope.
- The same treatment for segment-range scopes.

Budget after the fix: `surah:2 AND normalised:الصلوه` p95 under 1 ms. Report the measured figure.

**Extend the benchmark to cover every query class**, not just single-term and proximity. The existing benchmark passed while this defect was present, which is the real failure here. Add scoped, boolean, and reference queries with their own budgets, and make the benchmark fail loudly on regression.

## Part B — no output checksums in the manifest

The manifest records `sha256` for upstream sources but not for the artifacts the pipeline emits. The loader can therefore validate structure but not bytes, and a published corpus version cannot be verified by a third party — which the project promises.

Required:

- `packages/corpus-build/pipeline/build.py` writes a `checksums` block into `manifest.json`: sha256 and byte size for every artifact file it emits, excluding the manifest itself.
- `loadCorpus` verifies each artifact against the manifest and fails loudly on mismatch. Keep the existing structural checks in addition.
- Add a `verify` entry point to the pipeline that checks an existing artifact directory against its manifest and exits non-zero on any mismatch. This is what a third party will run.
- Document the verification procedure in `docs/architecture.md` under the corpus artifacts section — a few lines, aimed at an outside researcher.

Rebuild as `out/v0.4.0/`. Segmentation, token count and identifiers must be unchanged from v0.3.0 — this is a metadata addition only. Populate `mapping/v0.3.0-to-v0.4.0.json` with an identity default and no entries, and assert in a test that the token id sets of the two versions are identical before deleting v0.3.0.

## Tests

- `surah:2 AND normalised:الصلوه` returns the same 6 matches as before the change
- Scoped queries return identical results to the previous scan-based implementation across a fixture of at least 20 queries — correctness must not regress while optimising
- Benchmark covers exact, normalised, prefix, suffix, pattern, proximity, adjacency, boolean, scoped and reference, each with a stated budget
- Corrupting one byte of an artifact causes `loadCorpus` to fail with a clear error naming the file
- v0.4.0 token id set equals v0.3.0 token id set
- Total tokens still 77,881

## Report back

State: the before and after p95 for the scoped query, the full benchmark table across all query classes, confirmation that token ids are unchanged, and whether any query class remains above its budget.
