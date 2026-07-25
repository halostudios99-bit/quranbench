"""Stage — segment.

Split verse ``text_uthmani`` into whitespace-delimited word tokens. This is
*word* segmentation only: a token is a whitespace-delimited word exactly as it
appears in the Uthmani text. Morphological prefix/suffix splitting is a later
prompt and must not be pre-empted here.

Marks that are not words:
  - Standalone waqf/pause marks (U+06D6–U+06ED): the Uthmani text carries these
    as space-separated glyphs (ۖ ۗ ۚ ۛ ۜ ۘ ۙ …). They are not tokens. They are
    excluded from the token stream and recorded as ``following_marks`` on the
    preceding token — or, when a verse *begins* with one (the waqf of the previous
    ayah rendered at the head of the line), as the verse's ``leading_marks``.
  - Sajda (۩ U+06E9) and rub-el-hizb (۞ U+06DE) fall in that range and are handled
    the same way.
  - Arabic-Indic and extended digits (U+0660–U+0669, U+06F0–U+06F9) and any
    verse-end marker are likewise not tokens. None occur in the txt-2 format, but
    they are excluded defensively so a future format change cannot inject them.

A "mark run" is a whitespace-delimited piece composed *solely* of characters in
the non-token set. Real words that merely *carry* such marks as combining glyphs
are never touched — only whole standalone mark-runs are removed.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .identifiers import BASMALA_SLOT, segment_id, token_id
from .normalise import derive_token_fields

# Codepoints that never, on their own, constitute a token.
_NON_TOKEN_RANGES: tuple[tuple[int, int], ...] = (
    (0x06D6, 0x06ED),  # small high/low signs, pause marks, sajda, rub-el-hizb
    (0x0660, 0x0669),  # Arabic-Indic digits
    (0x06F0, 0x06F9),  # extended Arabic-Indic digits
)


def _is_mark_char(ch: str) -> bool:
    o = ord(ch)
    return any(a <= o <= b for a, b in _NON_TOKEN_RANGES)


def is_mark_run(piece: str) -> bool:
    return bool(piece) and all(_is_mark_char(ch) for ch in piece)


@dataclass
class Token:
    surah: int
    #: Segment slot within the surah: an ordinal ayah number as a string, or a
    #: named slot such as ``"basmala"``. Never an integer, so the identity of a
    #: named-slot token never resembles an ordinal.
    slot: str
    position: int
    text: str
    char_start: int
    char_end: int
    following_marks: list[str] = field(default_factory=list)
    is_basmala: bool = False

    def record(self) -> dict:
        return {
            "id": token_id(self.surah, self.slot, self.position),
            "segment_id": segment_id(self.surah, self.slot),
            "surah": self.surah,
            "slot": self.slot,
            "position": self.position,
            **derive_token_fields(self.text),
            "char_start": self.char_start,
            "char_end": self.char_end,
            "following_marks": list(self.following_marks),
            "is_basmala": self.is_basmala,
        }


@dataclass
class SegmentedVerse:
    tokens: list[Token]
    leading_marks: list[str]
    marks_excluded: int


def segment_verse(
    surah: int, slot: str, text: str, *, is_basmala: bool = False
) -> SegmentedVerse:
    """Segment one segment (a verse or a separated basmala) into tokens.

    ``slot`` is the segment slot within the surah — an ordinal ayah number as a
    string, or a named slot. Offsets are into ``text``. Assumes single-space
    separation and no leading or trailing whitespace — both are asserted by the
    build against the real source.
    """
    tokens: list[Token] = []
    leading_marks: list[str] = []
    marks_excluded = 0
    position = 0
    offset = 0

    if not text:
        raise ValueError(f"{surah}:{slot}: empty segment text")

    for piece in text.split(" "):
        start = offset
        offset += len(piece) + 1  # +1 for the space we split on
        if is_mark_run(piece):
            marks_excluded += 1
            if tokens:
                tokens[-1].following_marks.append(piece)
            else:
                leading_marks.append(piece)
            continue
        position += 1
        tokens.append(
            Token(
                surah=surah,
                slot=slot,
                position=position,
                text=piece,
                char_start=start,
                char_end=start + len(piece),
                is_basmala=is_basmala,
            )
        )

    if not tokens:
        raise ValueError(f"{surah}:{slot}: segment produced zero tokens: {text!r}")

    return SegmentedVerse(tokens, leading_marks, marks_excluded)


def segment_basmala(surah: int, text: str) -> SegmentedVerse:
    """Tokens for a separated surah-opening basmala, addressed by the named
    ``basmala`` segment slot — never an ordinal ayah number."""
    seg = segment_verse(surah, BASMALA_SLOT, text, is_basmala=True)
    if seg.leading_marks or any(t.following_marks for t in seg.tokens):
        raise ValueError(f"surah {surah}: basmala unexpectedly carries marks: {text!r}")
    return seg
