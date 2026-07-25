# Attribution — morphology

The morphological annotation in this corpus (the `morphology` block on each token in `tokens.jsonl`, and `roots.json`) is derived from the **Quranic Arabic Corpus** (QAC).

- **Original work:** Quranic Arabic Corpus, morphology release v0.4
- **Author:** Kais Dukes
- **Publisher:** Language Research Group, University of Leeds
- **Original URL:** http://corpus.quran.com/
- **Licence:** GNU General Public License (GPL) — see `LICENSE` in this directory (GPL-2.0-or-later).

It was ingested via a GPL redistribution that converts the QAC's Buckwalter transliteration to Arabic script and applies documented corrections:

- **Redistribution:** Quranic Arabic Corpus — Morphology (mustafa0x fork of Leeds QAC v0.4)
- **Repository:** https://github.com/mustafa0x/quran-morphology
- **Pinned commit:** `8f38b39016824284f9ed16ae15069ff9102c4acf`
- **File:** `quran-morphology.txt`
- **SHA-256:** `742bfac59941b2cb09736d5b7aae694af50792261fb8450cbf6afafcc340645f`

The list of changes the fork makes to the original QAC is recorded in that repository's `README.md` and `scripts/apply-changes.py`.

## What a redistributor must do

Because this data is GPL, it carries copyleft: if you redistribute the morphology (or any file that embeds it), you must do so under the GPL, keep this attribution and licence, and make the corresponding source form available. The alignment onto quranbench token ids is performed by `packages/corpus-build/pipeline/morphology.py`. See `docs/licensing.md`.
