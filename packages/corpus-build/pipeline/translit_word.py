"""Word transliteration — the documented computed romanisation scheme.

The primary source of per-word transliteration is the Quranic Arabic Corpus's own
``phonetic.txt`` (``pipeline.glosses``); it is used wherever a token aligns to a
Leeds word. This module is the **fallback** for any token that has no Leeds
transliteration, and the documented, tested scheme the fallback applies.

**Scheme.** A letter-faithful romanisation in the tradition of *DIN 31635* (the
standard German/academic Arabic transliteration): one Latin unit per Arabic
grapheme, long ā/consonant symbols with the conventional diacritics (ṯ ǧ ḥ ḫ ḏ š ṣ
ḍ ṭ ẓ ʿ ġ, hamza ʾ). It is a *transliteration*, not a phonetic transcription: و
and ي are always rendered as their consonant values w/y and ا as ā, so the mapping
is deterministic and the consonant skeleton is exactly reversible (see
``round_trips``). We chose DIN 31635 because it is unambiguous, reversible on the
consonants, and the de-facto standard in Arabic-studies typesetting — so a reader
who knows any academic romanisation can read it, and a test can prove the letter
map is a bijection.

Vowels: fatḥa→a, kasra→i, ḍamma→u; tanwīn→an/in/un; šadda doubles the preceding
consonant; sukūn and tatwīl produce nothing; dagger alef (ٰ) and alif maqṣūra (ى)
→ ā. Diacritics that are not letters (Quranic pause/recitation marks) are dropped.
"""

from __future__ import annotations

# --- consonants + long alef: a bijection, so the skeleton round-trips ---------
LETTER_TO_LATIN: dict[str, str] = {
    "ء": "ʾ",
    "ا": "ā",
    "ب": "b",
    "ت": "t",
    "ث": "ṯ",
    "ج": "ǧ",
    "ح": "ḥ",
    "خ": "ḫ",
    "د": "d",
    "ذ": "ḏ",
    "ر": "r",
    "ز": "z",
    "س": "s",
    "ش": "š",
    "ص": "ṣ",
    "ض": "ḍ",
    "ط": "ṭ",
    "ظ": "ẓ",
    "ع": "ʿ",
    "غ": "ġ",
    "ف": "f",
    "ق": "q",
    "ك": "k",
    "ل": "l",
    "م": "m",
    "ن": "n",
    "ه": "h",
    "و": "w",
    "ي": "y",
}

LATIN_TO_LETTER: dict[str, str] = {v: k for k, v in LETTER_TO_LATIN.items()}
if len(LATIN_TO_LETTER) != len(LETTER_TO_LATIN):  # pragma: no cover — guards a bad edit
    raise AssertionError("word-translit letter map is not a bijection")

# Hamza seats all read as the glottal stop ʾ; the seat is orthographic.
_HAMZA_SEATS = {"أ": "ʾ", "إ": "ʾ", "ؤ": "ʾ", "ئ": "ʾ", "ٱ": ""}
# Long-ā variants seated differently in the orthography.
_LONG_A = {"ٰ": "ā", "ى": "ā"}
# ة (tāʾ marbūṭa): word-final it reads as -a (its -t is contextual); render h.
_TA_MARBUTA = {"ة": "a"}

_FATHA, _KASRA, _DAMMA = "َ", "ِ", "ُ"
_FATHATAN, _KASRATAN, _DAMMATAN = "ً", "ٍ", "ٌ"
_SHORT = {_FATHA: "a", _KASRA: "i", _DAMMA: "u"}
_TANWIN = {_FATHATAN: "an", _KASRATAN: "in", _DAMMATAN: "un"}
_SHADDA = "ّ"
_SUKUN = "ْ"
_TATWEEL = "ـ"


def transliterate(arabic: str) -> str:
    """Romanise a voweled Arabic word by the scheme documented above.

    Unknown diacritics (Quranic pause/recitation marks) are dropped; unknown base
    letters are passed through unchanged so a gap is visible rather than silent.
    """
    out: list[str] = []
    last_consonant: int | None = None

    def emit(unit: str, *, consonant: bool) -> None:
        nonlocal last_consonant
        if consonant:
            last_consonant = len(out)
        out.append(unit)

    for ch in arabic:
        if ch == _SHADDA:
            # Gemination: double the preceding consonant, wherever the vowel sits.
            # This is orthography-order-independent, so a fatḥa written before the
            # šadda (as some editions do) still geminates the consonant, not the vowel.
            if last_consonant is not None:
                out.insert(last_consonant + 1, out[last_consonant])
            continue
        if ch in _SHORT:
            out.append(_SHORT[ch])
            continue
        if ch in _TANWIN:
            out.append(_TANWIN[ch])
            continue
        if ch in (_SUKUN, _TATWEEL) or ch == " ":
            if ch == " ":
                out.append(" ")
            continue
        if ch in LETTER_TO_LATIN:
            emit(LETTER_TO_LATIN[ch], consonant=(ch != "ا"))
            continue
        if ch in _HAMZA_SEATS:
            unit = _HAMZA_SEATS[ch]
            if unit:
                emit(unit, consonant=True)
            continue
        if ch in _LONG_A:
            out.append(_LONG_A[ch])
            continue
        if ch in _TA_MARBUTA:
            out.append(_TA_MARBUTA[ch])
            continue
        # Any remaining combining mark in the Arabic diacritic ranges is a
        # non-letter (waqf/recitation) mark: drop it. Everything else is passed
        # through so an unexpected letter is visible in output, not swallowed.
        code = ord(ch)
        if 0x0610 <= code <= 0x061A or 0x064B <= code <= 0x065F or 0x06D6 <= code <= 0x06ED:
            continue
        out.append(ch)
    return "".join(out)


def letters_to_latin(letters: str) -> str:
    """Transliterate a bare consonant/alef skeleton (no diacritics). Reversible."""
    return "".join(LETTER_TO_LATIN[ch] for ch in letters if not ch.isspace())


def round_trips(letters: str) -> bool:
    """True iff the consonant/alef skeleton survives a Latin round-trip. Proves the
    letter map is a faithful bijection on the reversible set."""
    latin = letters_to_latin(letters)
    recovered = [LATIN_TO_LETTER[out] for out in latin]
    return "".join(recovered) == "".join(ch for ch in letters if not ch.isspace())
