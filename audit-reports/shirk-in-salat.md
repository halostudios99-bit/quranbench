# Audit — Shirk in Salat

_shirk-in-salat.md · corpus 0.6.0 · slug `shirk-in-salat`_

Audited against corpus 0.6.0 (Tanzil Uthmani text, Leeds QAC morphology) with @quranbench/audit. Automated checks only; every flag is for human decision and nothing was corrected.

**9 claims checked** — ✅ 7 verified · 🚩 2 flagged · ❔ 0 unchecked · review score **7**

## 🚩 Flagged — needs a human decision

- **Quoted Arabic beside 33:52 does not match that verse — it matches 35:22.**
  - Quoted Arabic · severity: high · line 13
  - source: `Quran 33:52`
  - Word coverage 31%, consonant coverage 32%. Unmatched words: وَمَا يَسْتَوِي الْأَحْيَاءُ الْأَمْوَاتُ يُسْمِعُ يَشَاءُ وَمَا أَنتَ بِمُسْمِعٍ فِي الْقُبُورِ. The text is a 100% consonant match to 35:22; the citation may be to the wrong verse.
- **Arabic "التَّحِيَّاتُ لِلّٰهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، اَلسَّ…" has 5/29 word(s) not found in the corpus, even allowing for spelling variation.**
  - Quoted Arabic · severity: medium · line 31
  - source: `التَّحِيَّاتُ لِلّٰهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، اَلسَّلَامُ عَلَيْكَ أَيُّهَا النَّب…`
  - Not found: وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، وَبَرَكَاتُهُ، الصَّالِحِينَ، اللهُ،. This may be a typo, a truncated fragment, or non-Quranic text.

## ✅ Verified

- **Verse reference** (2)
  - Reference Quran 33:52 resolves to 1 verse(s) in the corpus. _(line 13)_
  - Reference Quran 13:14 resolves to 1 verse(s) in the corpus. _(line 65)_
- **Quoted Arabic** (5)
  - Arabic "اَلسَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ" appears in the corpus (4 word(s)). _(line 37)_
  - Arabic "عَلَيْكَ" appears in the corpus (1 word(s)). _(line 39)_
  - Arabic "أَيُّهَا" appears in the corpus (1 word(s)). _(line 41)_
  - Arabic "ٱللَّٰهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ وَعَلَىٰ آلِ مُحَمَّدٍ كَ…" appears in the corpus (34 word(s)). _(line 51)_
  - Quoted Arabic beside 13:14 matches the verse (27/27 words exact, 100% consonant match). _(line 65)_
