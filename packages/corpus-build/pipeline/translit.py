"""Root transliteration — the single, authoritative Arabic-root <-> Latin-slug map.

A root has two surface forms in this corpus:

  - the **spaced Arabic** form, e.g. ``ز ك و`` — the canonical display/identity form
    (``root:ز ك و``, see docs/architecture.md);
  - a **Latin slug**, e.g. ``z-k-w`` — what a URL can carry (``/root/z-k-w``).

This module defines the letter-by-letter mapping between them in ONE place, and is
the source of truth for the ``root_slug`` emitted into ``roots.json``. Search reads
those emitted slugs; it does not re-derive them, so the mapping cannot drift.

The map is a bijection over the 31 letters that actually occur in the corpus's
roots (the 28 consonants, the three hamza seats أ ؤ ء, and bare alef ا). Codes are
lowercase ``[a-z0-9]`` only, so a slug is URL-safe, and letters are hyphen-joined
so multi-character codes stay unambiguous. ``round_trips`` proves slug∘spaced is the
identity on every root; a test asserts it over the whole corpus.
"""

from __future__ import annotations

# Arabic root letter -> Latin slug token. Distinct code per distinct letter (a
# bijection): ز/ك/و map to z/k/w to match the documented `root:ز ك و` <-> `z-k-w`.
LETTER_TO_CODE: dict[str, str] = {
    "ا": "a",
    "أ": "e",  # alef-hamza-above — the usual QAC hamza root letter
    "ؤ": "o",  # waw-hamza
    "ء": "c",  # bare hamza
    "ب": "b",
    "ت": "t",
    "ث": "th",
    "ج": "j",
    "ح": "hh",
    "خ": "kh",
    "د": "d",
    "ذ": "dh",
    "ر": "r",
    "ز": "z",
    "س": "s",
    "ش": "sh",
    "ص": "sd",
    "ض": "dd",
    "ط": "tt",
    "ظ": "zh",
    "ع": "aa",
    "غ": "gh",
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

CODE_TO_LETTER: dict[str, str] = {code: letter for letter, code in LETTER_TO_CODE.items()}

if len(CODE_TO_LETTER) != len(LETTER_TO_CODE):  # pragma: no cover — guards a bad edit
    raise AssertionError("translit map is not bijective: duplicate slug codes")

SLUG_SEP = "-"


class TransliterationError(ValueError):
    pass


def letters(root: str) -> list[str]:
    """The individual root letters of a root given as raw (``زكو``) or spaced
    (``ز ك و``) Arabic. Whitespace is a display separator, never a letter."""
    return [ch for ch in root if not ch.isspace()]


def spaced(root: str) -> str:
    """Canonical spaced-Arabic display form: ``زكو`` -> ``ز ك و``."""
    return " ".join(letters(root))


def to_slug(root: str) -> str:
    """Arabic root (raw or spaced) -> URL slug, e.g. ``ز ك و`` -> ``z-k-w``."""
    out: list[str] = []
    for ch in letters(root):
        code = LETTER_TO_CODE.get(ch)
        if code is None:
            raise TransliterationError(f"no slug for root letter {ch!r} (U+{ord(ch):04X})")
        out.append(code)
    return SLUG_SEP.join(out)


def from_slug(slug: str) -> str:
    """URL slug -> canonical spaced-Arabic root, e.g. ``z-k-w`` -> ``ز ك و``."""
    out: list[str] = []
    for code in slug.split(SLUG_SEP):
        letter = CODE_TO_LETTER.get(code)
        if letter is None:
            raise TransliterationError(f"unknown slug token {code!r}")
        out.append(letter)
    return " ".join(out)


def round_trips(root: str) -> bool:
    """True iff ``from_slug(to_slug(root))`` recovers the spaced form of ``root``."""
    return from_slug(to_slug(root)) == spaced(root)
