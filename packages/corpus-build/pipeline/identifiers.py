"""Identifier policy (docs/extensibility.md §4).

Identifiers are opaque and permanent and carry the segmentation scheme they
belong to. Position (surah, ayah) is an *attribute*, not the identity — but for
v0.1.0 the identity string is derived from position under a named scheme.

    work     quran
    surah    quran:2
    verse    quran:tanzil-uthmani:2:43
    token    quran:tanzil-uthmani:2:43:4

Position (surah, ayah, position) is an *attribute* of the token, not its
identity — the identity string simply encodes those attributes under a named
segmentation scheme. A separated surah-opening basmala is addressed as ayah 0
(``quran:tanzil-uthmani:2:0:1``), since it opens the surah but belongs to no
numbered verse. Al-Fatiha is the exception: its basmala *is* verse 1:1 and keeps
that identity.
"""

from __future__ import annotations

from .sources import SEGMENTATION_SOURCE_ID

WORK_ID = "quran"
IDENTIFIER_FORMAT = f"{WORK_ID}:{SEGMENTATION_SOURCE_ID}:<surah>:<ayah>:<position>"
BASMALA_AYAH = 0  # synthetic ayah for a separated surah-opening basmala


def work_id() -> str:
    return WORK_ID


def surah_id(surah: int) -> str:
    return f"{WORK_ID}:{surah}"


def verse_id(surah: int, ayah: int) -> str:
    return f"{WORK_ID}:{SEGMENTATION_SOURCE_ID}:{surah}:{ayah}"


def token_id(surah: int, ayah: int, position: int) -> str:
    return f"{WORK_ID}:{SEGMENTATION_SOURCE_ID}:{surah}:{ayah}:{position}"
