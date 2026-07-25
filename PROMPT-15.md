## Batch 1 — reading experience (workplan items 1–4)

Read `CLAUDE.md`, `docs/architecture.md`, `docs/design-system.md`, `docs/i18n-spec.md` and `docs/licensing.md` first. Corpus is v0.6.0. All tests currently pass; a local Postgres is running and `apps/web/.env` holds a working `DATABASE_URL`.

### 1. Translations on the reader

Translations currently render only on single-verse pages and `/compare`. They are absent from `/[surah]`, `/[surah]/page/[n]` and `/[surah]/all` — where people actually read. A previous prompt skipped this to avoid forcing ISR pages dynamic.

Solve it properly rather than sidestepping it. Options to weigh: render all enabled editions server-side and toggle visibility with CSS driven by a cookie-set class on `<html>`; or move the preference into the URL for crawlable canonical variants; or partial prerendering. Choose one, justify it in a line, and keep the pages statically renderable and crawlable. Do not introduce client-side fetching of verse content.

### 2. Ingest Talal Itani's ClearQuran

Modern, readable English. Licence **CC BY-NC-ND 4.0**.

- Fetch from a source you can verify, checksum it, record it in `sources.json` with the exact licence string and the URL where you read the licence.
- **Display: permitted. Redistribution in dataset downloads: NOT permitted.** NonCommercial and NoDerivatives are incompatible with the project's open-redistribution promise.
- Add a `redistributable: boolean` field to translation source records. The dataset builder and `/data` must both honour it: Itani is served to readers but excluded from every download and from the full tarball.
- `/data` must state which editions are downloadable and which are display-only, and why, in plain language.
- Corpus becomes **v0.7.0**. Token and verse ids unchanged — assert it. Identity mapping file.
- Update `docs/licensing.md` and `LICENSING.md`.

Itani becomes the default reading translation. Pickthall, Palmer and Rodwell remain selectable.

### 3. Translation selector

Model it on quran.com's, which works well: a button in the reader toolbar opens a panel listing available translations grouped by language, each with translator name and year, multi-select with checkboxes, a filter box, and a clear count of how many are selected.

- Selection persists without an account (cookie), and to the user profile when signed in.
- Every rendered translation is always labelled with translator, year and licence — no anonymous text.
- Works with JavaScript disabled: the panel degrades to a plain form that submits and re-renders.
- Reachable by keyboard, focus trapped while open, Esc closes.

### 4. Reading controls

In the same toolbar:

- **Arabic size** — three steps, persisted, applied via a CSS custom property so no re-render is needed.
- **Display mode** — Arabic only / Arabic + translation / translation only. Persisted.
- Both must survive a full page reload with JavaScript disabled.

### Tests

- Translations render in the surah reader, the paginated reader and `/all`, server-side, with JS disabled
- Itani appears on the site but is absent from every artifact under `out/v0.7.0/` that the dataset builder marks redistributable, and absent from the tarball — assert both
- `/data` names Itani as display-only
- Selector: multi-select persists across reload; works with JS disabled; keyboard and axe clean
- Size and display-mode settings persist across reload
- Token and verse ids identical to v0.6.0
- Full suite green: packages, web unit, e2e

### Report back

Which approach you chose for reader translations and why; Itani's licence string and source URL; how `redistributable` is enforced in the builder; Lighthouse mobile for a reader page with translations on; anything that regressed.
