# Attribution — word gloss + transliteration

The terse per-word **English gloss** (`morphology.gloss` on each token) and the per-word **transliteration** (`morphology.transliteration`) are derived from the **Quranic Arabic Corpus** (QAC), the same GPL work as the morphology.

- **Original work:** Quranic Arabic Corpus, corpus.quran.com
- **Author:** Kais Dukes, Language Research Group, University of Leeds
- **Licence:** GNU General Public License. corpus.quran.com/download states verbatim: “License: GNU General Public License”, and lists “Word-by-word analysis” and “English translation” among the data it covers. The morphology `LICENSE` (GPL-2.0-or-later) in this directory is that same licence.

## Where the files came from, and an honest licence caveat

The gloss and transliteration are published as data files in the corpus author's own backend repository, `kaisdukes/quranic-corpus-api`, pinned to an immutable commit:

- **Gloss file:** `Quranic Arabic Corpus — word-by-word English gloss (Kais Dukes)`
  - URL: https://raw.githubusercontent.com/kaisdukes/quranic-corpus-api/17a9062416eccc332111ef3e84f74072d709e187/src/main/resources/data/translation/word-by-word.txt
  - SHA-256: `f732efe12ed56c36c2f94525ed28f4b4e9a4290bdf31a2640bc210d6a9e015d5`
- **Transliteration file:** `Quranic Arabic Corpus — word-by-word transliteration (Kais Dukes)`
  - URL: https://raw.githubusercontent.com/kaisdukes/quranic-corpus-api/17a9062416eccc332111ef3e84f74072d709e187/regression/phonetic.txt
  - SHA-256: `192f3fc996cafb3a32ade640a115fe4e09101f5ec79b1c89a8ac2ac24195495b`

Honest caveat: that repository does **not** carry a `LICENSE` file of its own, so at the repository level GitHub reports no licence. The *content*, however, is unambiguously the GPL corpus.quran.com data by the corpus's own author, which is the strongest provenance available for this annotation. We record it under the same GPL-2.0-or-later as the morphology and attribute it to the QAC; copyleft propagates to any artifact that carries it.

## How it is aligned

Both files are strictly positional — one line per word in canonical mushaf order — with no `surah:verse:word` key. Their 77,429 lines line up 1:1 with the 77,429 distinct word-locations of the morphology file in the same order, so line *i* is the gloss/transliteration of the morphology's *i*-th distinct word. From there the **same** word→token alignment as the morphology carries them onto token ids (`pipeline/glosses.py`, `pipeline/morphology.py`). Coverage and every gap are enumerated in `gloss-report.md`.
