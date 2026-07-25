"""Identifier policy (docs/extensibility.md §4).

Identifiers are opaque and permanent and carry the segmentation scheme they
belong to. Position (surah, ayah) is an *attribute*, not the identity — but for
v0.1.0 the identity string is derived from position under a named scheme.

    work     quran
    surah    quran:2
    verse    quran:tanzil-uthmani:2:43

Token identifiers (``...:2:43:4``) are a later prompt; not built here.
"""

from __future__ import annotations

from .sources import SEGMENTATION_SOURCE_ID

WORK_ID = "quran"


def work_id() -> str:
    return WORK_ID


def surah_id(surah: int) -> str:
    return f"{WORK_ID}:{surah}"


def verse_id(surah: int, ayah: int) -> str:
    return f"{WORK_ID}:{SEGMENTATION_SOURCE_ID}:{surah}:{ayah}"
