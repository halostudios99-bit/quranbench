# @quranbench/audit

A reusable checker that verifies the linguistic claims in an article against the
corpus. It exists because a platform whose promise is reproducibility cannot
republish unverified claims — so before any prose is seeded as an Investigation,
its verse references, quoted Arabic, root claims and transliterations are checked
against the versioned corpus.

**It never corrects anything.** Every problem is reported as a `Finding` for a
human to decide. A false positive costs a reviewer five minutes; a false negative
republishes an error, so the checks are conservative and a claim that cannot be
verified automatically is reported as `unchecked`, never a silent pass.

## What it checks

- **Verse references** (`2:43`, `Quran 2:43`, `Al-Baqarah 2:43`, ranges) — does the
  reference resolve to a real verse? If a surah *name* is given, does it match the
  surah the *number* points to? (This catches `Al-Maida 27:4`, where 27:4 is An-Naml.)
- **Quoted Arabic** — for a verse quoted beside a reference, do its words appear in
  that verse? Matching is reported at three levels: `canonical` (exact Uthmani),
  `normalised`, and `orthographic` (matched only after collapsing Imlaei/Uthmani
  script differences). A quote that matches a *different* verse is named.
- **Root claims** (`the root word for X is Y`) — the claimed root is compared to the
  corpus morphology root for that word. (This catches the 2017 zakat error: the
  article claims the root is `زَكَّىٰ`, a Form II verb; the corpus root is `ز ك و`.)
- **Transliterations** paired with a single Arabic word — a coarse consonant check
  flags gross mismatches for review; it never asserts a scheme is wrong.

## Use

```ts
import { loadCorpus } from '@quranbench/corpus';
import { createContext, auditArticle, renderMarkdown } from '@quranbench/audit';

const ctx = createContext(loadCorpus());
const report = auditArticle(ctx, { file: 'zakat.md', markdown });
console.log(renderMarkdown(report)); // human summary; report itself is the JSON
```

Extraction (`extract`) is pure string work and is tested without the corpus.
Verification reads the loaded corpus and search index. There is no I/O in the
library — the runner script owns reading files and writing reports.

## Running the seed-article audit

From the repo root (Node 24 strips the TypeScript itself; the loader maps the
workspace `@quranbench/*` packages):

```
node --experimental-transform-types --import ./scripts/ts-register.mjs \
  packages/audit/scripts/run-audit.ts
```

This writes `audit-reports/<slug>.md`, `audit-reports/<slug>.json`, a ranked
`audit-reports/SUMMARY.md`, and `audit-reports/index.json`.
