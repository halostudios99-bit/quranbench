# Licensing — which licence covers which directory

This repository is not under a single licence. It bundles application code we
wrote with data and fonts from several upstreams that do not share a licence.
This file states plainly which licence covers which part and what you must do
if you redistribute it. It is written for a human, not a lawyer; it is not
legal advice. For the data-specific detail (upstream provenance, corrections,
SHA-256s) see [`docs/licensing.md`](docs/licensing.md).

## Summary

| Path | What it is | Licence |
| --- | --- | --- |
| `apps/`, `packages/*/src/`, root config, and all `package.json` | application code we wrote | **MIT** (`LICENSE`) |
| `packages/corpus-build/out/<version>/verses.jsonl`, `surahs.json`, token `text_*` fields | Quranic text (Tanzil) | **CC BY 3.0** |
| `packages/corpus-build/out/<version>/tokens.jsonl` | tokens **with embedded morphology** | **GPL-2.0-or-later** (whole file) |
| `packages/corpus-build/out/<version>/morphology/` | roots, lemmas, features (Leeds QAC) | **GPL-2.0-or-later** |
| `packages/corpus-build/out/<version>/translations/*.jsonl` | translation editions (public-domain, redistributable) | per edition (see each `*.LICENSE.md`) |
| `packages/corpus-build/out/<version>/translations/en-itani.*` | Talal Itani / ClearQuran — **display-only, NOT redistributable** | **CC BY-NC-ND 4.0** |
| `apps/web/public/fonts/*.woff2` | Amiri / Amiri Quran fonts | **SIL OFL 1.1** (`apps/web/public/fonts/OFL.txt`) |
| user-contributed content (investigations, annotations) | community edits | **CC BY-SA 4.0** (per `docs/contributor-terms.md`) |

## Why MIT for the code

MIT because it is permissive and GPL-2.0-compatible, so the application code
composes cleanly with the copyleft Leeds morphology this repository
redistributes as data. (Apache-2.0 was rejected: its patent clause is
incompatible with GPL-2.0, and the morphology is offered as GPL-2.0-**or-later**
but pinned artifacts are labelled at 2.0.) The morphology is *data read at
runtime*, not code linked into the application, so MIT on the code and GPL on
the morphology data coexist without conflict — see `docs/licensing.md`.

## The GPL boundary, stated exactly

`tokens.jsonl` combines two upstreams in one file: Tanzil `text_*` fields
(CC BY 3.0) **and** a `morphology` block derived from the Leeds Quranic Arabic
Corpus (GPL-2.0-or-later). Because the GPL is copyleft, a work that embeds GPL
material is, as a whole, distributed under the GPL. **Therefore the combined
`tokens.jsonl` file is GPL-2.0-or-later in its entirety**, as is anything else
that embeds the morphology (e.g. `morphology/roots.json`). If you want the
Tanzil text under CC BY without the GPL obligation, take it from `verses.jsonl`
and the `text_*` fields, which contain no Leeds-derived data.

## What a redistributor must do

- **Application code (MIT):** keep the `LICENSE` copyright notice with any copy
  or substantial portion. No other obligation.
- **Quranic text (CC BY 3.0 — Tanzil):** credit the Tanzil Project. You may
  redistribute and adapt, including commercially, with attribution.
- **Morphology, and `tokens.jsonl` (GPL-2.0-or-later — Leeds QAC):** keep the
  GPL licence and attribution, pass the same rights downstream, and make the
  corresponding source form available (the pipeline is in
  `packages/corpus-build`). Anything you distribute that embeds the morphology
  must itself be GPL-compatible.
- **Translations (per edition):** honour each edition's note in its
  `*.LICENSE.md`. Only public-domain / freely-redistributable editions are
  **shipped in the downloads**. Some editions are **display-only**: shown on the
  site under a licence that permits display but not redistribution (currently Talal
  Itani's ClearQuran, CC BY-NC-ND 4.0). These carry `redistributable: false` in
  `sources.json` and the manifest, are excluded from the full tarball, and are
  refused by the download route — do not redistribute them.
- **Fonts (SIL OFL 1.1 — Amiri):** redistribute (including subset/embedded)
  with `OFL.txt` carried alongside; do not sell the fonts on their own and do
  not use the reserved font names for modified versions.
- **Contributed content (CC BY-SA 4.0):** credit the contributor(s) and licence
  any adaptation under CC BY-SA 4.0.

The three-way split the docs describe (corpus / editorial / community) is
instantiated here: corpus artifacts are per-source above, application/editorial
code is MIT, and community contributions are CC BY-SA 4.0.
