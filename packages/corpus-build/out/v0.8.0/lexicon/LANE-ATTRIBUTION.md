# Attribution — Lane's Lexicon

The **Meaning** section on each root page is from **Edward William Lane's *An Arabic-English Lexicon*** (London: Williams and Norgate, 1863–1893), the standard classical Arabic–English lexicon. Lane (d. 1876) is long in the public domain.

The digitisation is the **Perseus Digital Library** (Tufts University) TEI text, taken from the `laneslexicon/lexicon_xml` mirror of Perseus's `originals`, pinned to commit `51e0794420da4f2b20148dc0395d4bfdbe60ee2a`.

## Licence

- **Site-level licence (Perseus):** CC-BY-SA-3.0 (Creative Commons Attribution-ShareAlike 3.0 United States) — <https://creativecommons.org/licenses/by-sa/3.0/us/>
- **File-level terms (embedded in each TEI file):** “This text may be freely distributed, subject to the following restrictions: (1) You credit Perseus, as follows, whenever you use the document: “Text provided by Perseus Digital Library, with funding from The U.S. Department of Education and The Max Planck Society.” (2) You leave this availability statement intact. (3) You offer Perseus any modifications you make.”

Both are attribution + share-alike, so this text is displayable **and** redistributable (unlike a NoDerivatives edition). When you redistribute it, keep this attribution and the Perseus availability statement, credit Perseus and its funders as quoted above, and pass on the same share-alike terms.

## How roots are matched, and coverage

Perseus stores Arabic in a Buckwalter transliteration; we decode each article's root key to Arabic and match it to the corpus's roots by a folded radical fingerprint (`pipeline/lexicon.py`). Coverage is uneven because Lane died before finishing and the later letters were assembled posthumously by Stanley Lane-Poole; the exact fraction of roots with an entry, and every root without one, are listed in `coverage-report.md`. Where a root has no entry, the root page says so explicitly.
