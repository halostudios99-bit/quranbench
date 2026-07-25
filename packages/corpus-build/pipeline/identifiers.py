"""Identifier policy (docs/extensibility.md §4).

Identifiers are opaque and permanent and carry the segmentation scheme they
belong to. Position (surah, segment slot, position) is an *attribute*, not the
identity — but the identity string encodes those attributes under a named scheme.

    work     quran
    surah    quran:2
    verse    quran:tanzil-uthmani:2:43
    token    quran:tanzil-uthmani:2:43:4

The ``<segment>`` component of a verse/token identifier is a *segment slot*
within a surah. It is one of two kinds:

  - an **ordinal** ayah number, e.g. ``43`` in ``quran:tanzil-uthmani:2:43`` —
    used for ordinary verses;
  - a **named slot**, e.g. ``basmala`` in ``quran:tanzil-uthmani:2:basmala:1`` —
    used for the separated surah-opening basmala.

A named slot is deliberately *not* an ordinal. Numbering the separated basmala
(as verse 0, or as verse 1) would bake a contested counting position into a
permanent identifier; the counting traditions disagree, and the basmala is one
of the main reasons they disagree. So the basmala is addressed by a name that
asserts no position, and the ordinal it receives (or does not) is left to each
numbering scheme as data — see ``pipeline/numbering.py`` and ``docs/numbering.md``.

Al-Fatiha is the exception: its basmala *is* verse 1:1 in every counting
tradition we have, so it is addressed ordinally like any other verse and carries
no named slot.
"""

from __future__ import annotations

from .sources import SEGMENTATION_SOURCE_ID

WORK_ID = "quran"
IDENTIFIER_FORMAT = f"{WORK_ID}:{SEGMENTATION_SOURCE_ID}:<surah>:<segment>:<position>"

#: The named segment slot for a separated surah-opening basmala. Not an ordinal.
BASMALA_SLOT = "basmala"


def work_id() -> str:
    return WORK_ID


def surah_id(surah: int) -> str:
    return f"{WORK_ID}:{surah}"


def segment_id(surah: int, slot: int | str) -> str:
    """Identity of a segment (a verse or a named slot) within a surah.

    ``slot`` is either an ordinal ayah number or a named slot such as
    :data:`BASMALA_SLOT`. Both render into the same positional identifier form.
    """
    return f"{WORK_ID}:{SEGMENTATION_SOURCE_ID}:{surah}:{slot}"


def token_id(surah: int, slot: int | str, position: int) -> str:
    return f"{segment_id(surah, slot)}:{position}"
