# Audit — Salat

_salat.md · corpus 0.6.0 · slug `salat`_

Audited against corpus 0.6.0 (Tanzil Uthmani text, Leeds QAC morphology) with @quranbench/audit. Automated checks only; every flag is for human decision and nothing was corrected.

**45 claims checked** — ✅ 42 verified · 🚩 3 flagged · ❔ 0 unchecked · review score **12**

## 🚩 Flagged — needs a human decision

- **Quoted Arabic beside 24:35 does not match that verse — it matches 6:38.**
  - Quoted Arabic · severity: high · line 33
  - source: `Quran Al-Anam 24:35`
  - Word coverage 27%, consonant coverage 29%. Unmatched words: وَمَا دَابَّةٍ الْأَرْضِ طَائِرٍ يَطِيرُ بِجَنَاحَيْهِ إِلَّا أُمَمٌ أَمْثَالُكُم مَّا فَرَّطْنَا الْكِتَابِ ثُمَّ إِلَىٰ رَبِّهِمْ يُحْشَرُونَ. The text is a 100% consonant match to 6:38; the citation may be to the wrong verse.
- **Root claim: article says the root of "Salat (صلاة)" is "تصل", but the corpus root is ص ل و.**
  - Root claim · severity: high · line 46
  - source: `…مُوا الصَّلَاةَ) means establishing contact, Root word for Salat (صلاة) is Tasil (تصل) mea…`
  - The corpus records root ص ل و for "صلاة" (nearby forms also draw on ص ل ي, و ص ل, أ ص ل). "تصل" is not that root — it is likely a derived form, not the triliteral root.
- **Surah name "Al-Anam" does not match surah 24 (An-Noor).**
  - Surah name · severity: medium · line 33
  - source: `Quran Al-Anam 24:35`
  - "Al-Anam" best matches surah 6 (Al-An'aam). The name and the number 24:35 disagree — one of them is wrong.

## ✅ Verified

- **Verse reference** (9)
  - Reference Quran Al-Anam 6:114 resolves to 1 verse(s) in the corpus. _(line 21)_
  - Reference Quran Al-Anam 24:35 resolves to 1 verse(s) in the corpus. _(line 33)_
  - Reference Quran Al-Bakarah 2:43 resolves to 1 verse(s) in the corpus. _(line 47)_
  - Reference Quran Al-Tawba 9:84 resolves to 1 verse(s) in the corpus. _(line 65)_
  - Reference Quran Al-Tawba 9:103 resolves to 1 verse(s) in the corpus. _(line 79)_
  - Reference Quran Al-Bakarah 2:157 resolves to 1 verse(s) in the corpus. _(line 95)_
  - Reference Quran 2:156-157 resolves to 2 verse(s) in the corpus. _(line 104)_
  - Reference Quran Al-Ahzab 33:43 resolves to 1 verse(s) in the corpus. _(line 111)_
  - Reference Quran Al-Ahzab 33:56 resolves to 1 verse(s) in the corpus. _(line 125)_
- **Surah name** (7)
  - Surah name "Al-Anam" matches surah 6 (Al-An'aam). _(line 21)_
  - Surah name "Al-Bakarah" matches surah 2 (Al-Baqara). _(line 47)_
  - Surah name "Al-Tawba" matches surah 9 (At-Tawba). _(line 65)_
  - Surah name "Al-Tawba" matches surah 9 (At-Tawba). _(line 79)_
  - Surah name "Al-Bakarah" matches surah 2 (Al-Baqara). _(line 95)_
  - Surah name "Al-Ahzab" matches surah 33 (Al-Ahzaab). _(line 111)_
  - Surah name "Al-Ahzab" matches surah 33 (Al-Ahzaab). _(line 125)_
- **Quoted Arabic** (18)
  - Quoted Arabic beside 6:114 matches the verse (23/23 words exact, 100% consonant match). _(line 21)_
  - Arabic "صلاة" appears in the corpus (1 word(s)). _(line 46)_
  - Arabic "أَقِيمُوا الصَّلَاةَ" appears in the corpus (2 word(s)). _(line 46)_
  - Arabic "تصل" appears in the corpus (1 word(s)). _(line 46)_
  - Quoted Arabic beside 2:43 matches the verse (6/7 words exact, 100% consonant match). _(line 47)_
  - Quoted Arabic beside 9:84 matches the verse (18/18 words exact, 100% consonant match). _(line 65)_
  - Arabic "تُصَلِّ" appears in the corpus (1 word(s)). _(line 74)_
  - Quoted Arabic beside 9:103 matches the verse (16/16 words exact, 100% consonant match). _(line 79)_
  - Arabic "صَلَاتَ" appears in the corpus (1 word(s)). _(line 88)_
  - Arabic "صَلِّ" appears in the corpus (1 word(s)). _(line 88)_
  - Arabic "بَارَكًا" appears in the corpus (1 word(s)). _(line 88)_
  - Arabic "صَلَوَاتٌ" appears in the corpus (1 word(s)). _(line 92)_
  - Quoted Arabic beside 2:157 matches the verse (9/9 words exact, 100% consonant match). _(line 95)_
  - Arabic "يُصَلِّي" appears in the corpus (1 word(s)). _(line 108)_
  - Quoted Arabic beside 33:43 matches the verse (13/13 words exact, 100% consonant match). _(line 111)_
  - Arabic "ذْكُرْ" appears in the corpus (1 word(s)). _(line 120)_
  - Quoted Arabic beside 33:56 matches the verse (12/14 words exact, 100% consonant match). _(line 125)_
  - Arabic "دُعَا" appears in the corpus (1 word(s)). _(line 150)_
- **Transliteration** (8)
  - Transliteration "Salat" is consistent with "صلاة". _(line 46)_
  - Transliteration "Tasil" is consistent with "تصل". _(line 46)_
  - Transliteration "Baraka" is consistent with "بَارَكًا". _(line 88)_
  - Transliteration "Salat" is consistent with "صَلَاتَ". _(line 88)_
  - Transliteration "Sil" is consistent with "صَلِّ". _(line 88)_
  - Transliteration "Salawat" is consistent with "صَلَوَاتٌ". _(line 92)_
  - Transliteration "Salwat" is consistent with "صَلَوَاتٌ". _(line 104)_
  - Transliteration "Dhikr" is consistent with "ذْكُرْ". _(line 120)_
