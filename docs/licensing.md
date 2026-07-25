# Licensing — what carries which licence

This corpus is built from more than one upstream, and they do not share a licence.
This page says plainly which parts carry which licence and what you must do if you
redistribute them. It is written for a human, not a lawyer; it is not legal advice.

## The short version

| Artifact | What it is | Upstream | Licence |
| --- | --- | --- | --- |
| `verses.jsonl` | verse text, all `text_*` fields | Tanzil (Uthmani + Simple) | **CC BY 3.0** |
| `surahs.json` | surah metadata, basmala text | Tanzil | **CC BY 3.0** |
| token `text_*` fields | per-token Arabic forms | Tanzil (Uthmani) | **CC BY 3.0** |
| token `morphology` block | root, lemma, pos, features, segments | Leeds QAC (mustafa0x fork) | **GPL-2.0-or-later** |
| `morphology/roots.json` | roots and their occurrences | Leeds QAC | **GPL-2.0-or-later** |
| pipeline code (`packages/…`) | the software | this project | (its own repo licence) |

The **Quranic text is never modified** and is always attributed to Tanzil (see the
project's non-negotiable rules). Normalised and segmented forms are separate,
labelled, computed fields — they do not change the source text.

## The one thing that surprises people: `tokens.jsonl` is GPL

`tokens.jsonl` combines two upstreams in one file. Each token carries both:

- Tanzil text fields (`text_uthmani`, `text_simple`, …) — CC BY, **and**
- a `morphology` block derived from the Leeds Quranic Arabic Corpus — GPL.

The GPL is a copyleft licence: a work that combines GPL material is, as a whole,
distributed under the GPL. So **the combined `tokens.jsonl` file is
GPL-2.0-or-later.** This is a deliberate, accepted choice (see
`docs/extensibility.md` §2: "copyleft obligations propagate").

If you want the Tanzil text under CC BY *without* the GPL obligation, take it from
`verses.jsonl` and the `text_*` fields, which contain no Leeds-derived data. The
GPL applies to the morphology, and to any file that embeds it.

## The morphology upstream

The `morphology` block and `roots.json` derive from the **Quranic Arabic Corpus**
(QAC), morphology release v0.4, by **Kais Dukes**, Language Research Group,
University of Leeds — <http://corpus.quran.com/> — which is licensed under the GNU
General Public License.

We ingest it via a GPL redistribution that converts the QAC's Buckwalter
transliteration to Arabic script and applies documented corrections
(<https://github.com/mustafa0x/quran-morphology>, pinned to an immutable commit).
The full GPL text and a detailed attribution live next to the data, in
`out/<version>/morphology/LICENSE` and `out/<version>/morphology/ATTRIBUTION.md`.
The raw source file is recorded in `sources.json` and the manifest with its
SHA-256, distinct from the CC-BY Tanzil entries.

The alignment of that data onto quranbench token ids is described, and every
divergence enumerated, in `out/<version>/morphology/alignment-report.md`.

## If you redistribute

- **Tanzil text (CC BY 3.0):** keep the attribution to the Tanzil Project. You may
  redistribute and adapt, including commercially, with credit.
- **Morphology (GPL-2.0-or-later):** keep this licence and the attribution, pass
  the same GPL rights downstream, and make the corresponding source form available
  (the pipeline that produces it is in `packages/corpus-build`). Because copyleft
  propagates, anything you distribute that embeds the morphology must itself be
  GPL-compatible.
- **Application code and data are kept separate.** The morphology is *data read at
  runtime*, not code linked into the application, so the GPL obligation travels
  with the morphology data — not with an application that merely loads it.

## Why accept the GPL at all

The Leeds QAC is the best open morphology of the Quran, and it is GPL. Rather than
reinvent a weaker one or fabricate roots, this project takes the GPL obligation
deliberately and keeps the copyleft data cleanly labelled and isolated in its own
directory, so a redistributor can see exactly what is affected. A wrong root is
worse than an absent one; a real, attributed, copyleft root is better than either.
