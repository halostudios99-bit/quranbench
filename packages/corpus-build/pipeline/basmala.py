"""Separate the surah-opening basmala from verse 1.

Tanzil offers no download that omits the basmala; every edition prepends the
basmala to verse 1 of every surah except 9. Merging it into verse 1 shifts every
token position, inflates word and letter counts, and makes basmala inclusion
un-toggleable. So we split it off — but never by index or character count. We
split only on an *exact* match of the canonical basmala string for the edition,
and fail the build loudly if the expected prefix is absent where it should be, or
present where it should not be.

Two orthographic variants occur per edition: the standard form, and a form with a
shadda on the initial ba that Tanzil uses in surahs 95 and 97. Both are canonical
basmalas and both are separated.

Rules:
  - surah 1  — the basmala *is* verse 1:1; keep it, do not separate.
  - surah 9  — has no basmala; represent as absent (None), never empty string.
  - 27:30    — contains the basmala mid-verse as its own content; untouched here,
               because this module only ever inspects verse 1 of a surah.
  - all others (112) — verse 1 begins with ``<basmala> `` (basmala + one space);
               strip that prefix, keep the remainder as verse 1's own content.
"""

from __future__ import annotations

from dataclasses import dataclass

# Canonical basmala strings, per edition. Standard form first, then the
# shadda-on-ba variant Tanzil uses in surahs 95 and 97. Written as explicit
# codepoint escapes copied from the source bytes: the Uthmani text orders each
# shadda *before* its vowel (U+0651 then U+064E), an order a text editor silently
# reorders — which would break the exact-match split. Do not retype as glyphs.
_UTHMANI_BASMALAS: tuple[str, ...] = (
    "\u0628\u0650\u0633\u0652\u0645\u0650\u0020\u0671\u0644\u0644\u0651\u064e\u0647\u0650\u0020\u0671\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0670\u0646\u0650\u0020\u0671\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0645\u0650",
    "\u0628\u0651\u0650\u0633\u0652\u0645\u0650\u0020\u0671\u0644\u0644\u0651\u064e\u0647\u0650\u0020\u0671\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0670\u0646\u0650\u0020\u0671\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0645\u0650",
)
_SIMPLE_BASMALAS: tuple[str, ...] = (
    "\u0628\u0650\u0633\u0652\u0645\u0650\u0020\u0627\u0644\u0644\u0651\u064e\u0647\u0650\u0020\u0627\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0670\u0646\u0650\u0020\u0627\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0645\u0650",
    "\u0628\u0651\u0650\u0633\u0652\u0645\u0650\u0020\u0627\u0644\u0644\u0651\u064e\u0647\u0650\u0020\u0627\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0670\u0646\u0650\u0020\u0627\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0645\u0650",
)

CANONICAL_BASMALA = _UTHMANI_BASMALAS[0]

NO_BASMALA_SURAH = 9
BASMALA_IS_VERSE_SURAH = 1


class BasmalaError(RuntimeError):
    """Raised when a surah's verse 1 does not match the basmala expectation."""


@dataclass(frozen=True)
class BasmalaSplit:
    surah: int
    #: The exact basmala string that opened this surah, or None (surah 9).
    basmala: str | None
    #: verse 1's own content, with any separated basmala prefix removed.
    verse_one: str
    #: True when the basmala was split off verse 1 (the 112 surahs).
    separated: bool


def _match(text: str, candidates: tuple[str, ...]) -> str | None:
    for c in candidates:
        if text == c or text.startswith(c + " "):
            return c
    return None


def _split_one(surah: int, verse_one: str, candidates: tuple[str, ...]) -> BasmalaSplit:
    matched = _match(verse_one, candidates)

    if surah == NO_BASMALA_SURAH:
        if matched is not None:
            raise BasmalaError(
                f"surah {surah} is expected to have no basmala but verse 1 "
                f"begins with one: {verse_one!r}"
            )
        return BasmalaSplit(surah, basmala=None, verse_one=verse_one, separated=False)

    if matched is None:
        raise BasmalaError(
            f"surah {surah}: verse 1 does not begin with any canonical basmala: "
            f"{verse_one!r}"
        )

    if surah == BASMALA_IS_VERSE_SURAH:
        # Al-Fatiha: the basmala IS verse 1. It must be the entire verse.
        if verse_one != matched:
            raise BasmalaError(
                f"surah {surah}: basmala must be the whole of verse 1, got extra "
                f"content: {verse_one!r}"
            )
        return BasmalaSplit(surah, basmala=matched, verse_one=verse_one, separated=False)

    remainder = verse_one[len(matched) + 1 :]
    if not remainder:
        raise BasmalaError(
            f"surah {surah}: nothing remains of verse 1 after separating the basmala"
        )
    return BasmalaSplit(surah, basmala=matched, verse_one=remainder, separated=True)


def split_uthmani(surah: int, verse_one: str) -> BasmalaSplit:
    return _split_one(surah, verse_one, _UTHMANI_BASMALAS)


def split_simple(surah: int, verse_one: str) -> BasmalaSplit:
    return _split_one(surah, verse_one, _SIMPLE_BASMALAS)
