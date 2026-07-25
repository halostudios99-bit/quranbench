# Audit — Ablution

_ablution.md · corpus 0.6.0 · slug `ablution`_

Audited against corpus 0.6.0 (Tanzil Uthmani text, Leeds QAC morphology) with @quranbench/audit. Automated checks only; every flag is for human decision and nothing was corrected.

**8 claims checked** — ✅ 5 verified · 🚩 2 flagged · ❔ 1 unchecked · review score **7**

## 🚩 Flagged — needs a human decision

- **Arabic "وضوء" has 1/1 word(s) not found in the corpus, even allowing for spelling variation.**
  - Quoted Arabic · severity: high · line 8
  - source: `Ablution  وضوء`
  - Not found: وضوء. This may be a typo, a truncated fragment, or non-Quranic text.
- **Surah name "Al-Maida" does not match surah 27 (An-Naml).**
  - Surah name · severity: medium · line 45
  - source: `Quran Al-Maida 27:4`
  - "Al-Maida" best matches surah 5 (Al-Maaida). The name and the number 27:4 disagree — one of them is wrong.

## ❔ Could not be checked automatically

- **Transliteration/gloss "Ablution" for "وضوء" could not be confirmed.**
  - Transliteration · line 8
  - source: `Ablution  وضوء`
  - Consonant overlap only 0%. This may be a translation rather than a transliteration, or a scheme not modelled here — worth a human glance.

## ✅ Verified

- **Verse reference** (2)
  - Reference Quran Al-Maida 5:6 resolves to 1 verse(s) in the corpus. _(line 14)_
  - Reference Quran Al-Maida 27:4 resolves to 1 verse(s) in the corpus. _(line 45)_
- **Surah name** (1)
  - Surah name "Al-Maida" matches surah 5 (Al-Maaida). _(line 14)_
- **Quoted Arabic** (2)
  - Quoted Arabic beside 5:6 matches the verse (60/62 words exact, 100% consonant match). _(line 14)_
  - Quoted Arabic beside 27:4 matches the verse (10/10 words exact, 100% consonant match). _(line 45)_
