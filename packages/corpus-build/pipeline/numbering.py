"""Verse numbering schemes (Prompt 03, Part B).

A *numbering scheme* assigns ordinal verse numbers to the segments of a surah.
The platform treats numbering as an explicit, recorded parameter rather than a
fact baked into identifiers, because the counting traditions genuinely disagree —
and the separated surah-opening basmala is one of the main things they disagree
about. See ``docs/numbering.md``.

A scheme is **data, not code**: an id, a name, a source citation, and a small set
of declarative rules. The rules are applied by the single generic function
:func:`assign_ordinals` below. Adding a tradition later is a new
:class:`NumberingScheme` value (emitted as a data file), never new code — so we
do not, and must not, hand-write verse divisions we do not have a source for.

Only **Kufan** is implemented. It corresponds to the Ḥafṣ ʿan ʿĀṣim reading of
the Tanzil Uthmani edition already ingested, and reproduces exactly the 6,236
verses in ``verses.jsonl``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

#: The two segment kinds the numbering layer distinguishes. ``verse`` is an
#: ordinary counted verse; ``basmala`` is a separated surah-opening basmala.
VERSE_KIND = "verse"
BASMALA_KIND = "basmala"


@dataclass(frozen=True)
class Segment:
    """A surah's segment, in textual order, as seen by the numbering layer."""

    surah: int
    slot: str
    kind: str


@dataclass(frozen=True)
class NumberingScheme:
    id: str
    name: str
    full_name: str
    #: Bibliographic citation for the tradition this scheme encodes.
    source: dict[str, Any]
    is_default: bool
    #: Declarative rules, applied by :func:`assign_ordinals`.
    order: str  # "textual" — assign in textual order
    reset_per: str  # "surah" — ordinals restart at each surah
    start_at: int  # first ordinal, typically 1
    #: Which segment kinds this scheme counts as verses.
    counts: dict[str, bool]
    note: str

    def record(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "full_name": self.full_name,
            "source": self.source,
            "is_default": self.is_default,
            "rules": {
                "order": self.order,
                "reset_per": self.reset_per,
                "start_at": self.start_at,
                "counts": dict(self.counts),
            },
            "note": self.note,
        }


KUFAN = NumberingScheme(
    id="kufan",
    name="Kūfan",
    full_name="Kūfan (Kūfī) verse-counting tradition",
    source={
        "tradition": "Kūfan (al-Kūfa), transmitted from ʿAlī ibn Abī Ṭālib",
        "reading": "Ḥafṣ ʿan ʿĀṣim",
        "corresponds_to": "tanzil-uthmani",
        "citation": (
            "The Kūfan count of 6,236 āyāt, as reflected in the Ḥafṣ ʿan ʿĀṣim "
            "reading of the standard Uthmani muṣḥaf (the Tanzil Uthmani edition "
            "ingested here). It is the numbering used by the Madīna muṣḥaf and by "
            "most printed Qurʾāns in circulation today."
        ),
    },
    is_default=True,
    order="textual",
    reset_per="surah",
    start_at=1,
    # Kūfan counts ordinary verses and does NOT count a separated surah-opening
    # basmala as its own verse. In al-Fatiha the basmala is not separated (it is
    # verse 1), so it is a ``verse`` segment and is counted like any other.
    counts={VERSE_KIND: True, BASMALA_KIND: False},
    note=(
        "Assigns 1..N within each surah, in textual order, to ordinary verse "
        "segments. A separated surah-opening basmala receives no ordinal under "
        "this scheme."
    ),
)

SCHEMES: tuple[NumberingScheme, ...] = (KUFAN,)
DEFAULT_SCHEME_ID = "kufan"

SCHEMES_BY_ID: dict[str, NumberingScheme] = {s.id: s for s in SCHEMES}


def assign_ordinals(
    scheme: NumberingScheme, segments_by_surah: dict[int, list[Segment]]
) -> dict[tuple[int, str], int]:
    """Apply ``scheme`` to per-surah, textually-ordered segments.

    Returns a map ``(surah, slot) -> ordinal`` covering exactly the segments the
    scheme counts. Segments the scheme does not count are absent from the map —
    they have no ordinal under this scheme, which is itself the recorded position.
    """
    if scheme.order != "textual":
        raise ValueError(f"unsupported order rule: {scheme.order!r}")
    if scheme.reset_per != "surah":
        raise ValueError(f"unsupported reset rule: {scheme.reset_per!r}")

    ordinals: dict[tuple[int, str], int] = {}
    for surah, segments in segments_by_surah.items():
        n = scheme.start_at
        for seg in segments:
            if not scheme.counts.get(seg.kind, False):
                continue
            ordinals[(seg.surah, seg.slot)] = n
            n += 1
    return ordinals
