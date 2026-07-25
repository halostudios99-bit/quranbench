"""Stage 3 — normalise.

Derive labelled text fields as *separate values*. Nothing here mutates the
source: ``text_uthmani`` is always the exact bytes from the Uthmani edition.

Field derivation:

    text_uthmani      exact source (Uthmani edition) — untouched
    text_simple       exact source (Simple edition)
    text_no_tashkeel  Uthmani with diacritics removed
    text_normalised   no tashkeel, tatweel removed, alef/ta-marbuta/alif-maqsura unified

The rules are declared once, as data, in ``NORMALISATION_RULES`` so the build
manifest can list exactly what was applied without the description drifting from
the code.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# --- diacritics stripped for text_no_tashkeel (and, transitively, text_normalised) ---
# Explicit codepoint ranges. Base letters (incl. U+0671 ALEF WASLA) are never in
# this set, so stripping tashkeel never removes a letter.
_DIACRITIC_RANGES: tuple[tuple[int, int], ...] = (
    (0x0610, 0x061A),  # Arabic signs (e.g. sallallahou alayhe wasallam)
    (0x064B, 0x065F),  # harakat, tanwin, shadda, sukun and extended marks
    (0x0670, 0x0670),  # superscript alef
    (0x06D6, 0x06DC),  # small high signs
    (0x06DF, 0x06E8),  # small high/low signs
    (0x06EA, 0x06ED),  # small low signs
)
_DIACRITICS = re.compile(
    "[" + "".join(f"{chr(a)}-{chr(b)}" for a, b in _DIACRITIC_RANGES) + "]"
)

_TATWEEL = "ـ"

# --- letter unifications for text_normalised ---
_ALEF_VARIANTS = {
    "آ": "ا",  # ALEF WITH MADDA ABOVE
    "أ": "ا",  # ALEF WITH HAMZA ABOVE
    "إ": "ا",  # ALEF WITH HAMZA BELOW
    "ٱ": "ا",  # ALEF WASLA
}
_TA_MARBUTA = {"ة": "ه"}  # TEH MARBUTA -> HEH
_ALIF_MAQSURA = {"ى": "ي"}  # ALEF MAKSURA -> YEH
_LETTER_MAP = {**_ALEF_VARIANTS, **_TA_MARBUTA, **_ALIF_MAQSURA}
_LETTER_TABLE = str.maketrans(_LETTER_MAP)


def strip_tashkeel(text: str) -> str:
    return _DIACRITICS.sub("", text)


def normalise(text: str) -> str:
    text = strip_tashkeel(text)
    text = text.replace(_TATWEEL, "")
    return text.translate(_LETTER_TABLE)


@dataclass(frozen=True)
class NormalisationRule:
    id: str
    description: str
    applies_to: tuple[str, ...]
    detail: str


def _hex_ranges() -> str:
    return ", ".join(f"U+{a:04X}..U+{b:04X}" for a, b in _DIACRITIC_RANGES)


def _mapping_detail(mapping: dict[str, str]) -> str:
    return ", ".join(
        f"U+{ord(k):04X}->U+{ord(v):04X}" for k, v in mapping.items()
    )


NORMALISATION_RULES: tuple[NormalisationRule, ...] = (
    NormalisationRule(
        id="strip-tashkeel",
        description="Remove Arabic diacritical marks.",
        applies_to=("text_no_tashkeel", "text_normalised"),
        detail=f"Delete codepoints in ranges: {_hex_ranges()}.",
    ),
    NormalisationRule(
        id="remove-tatweel",
        description="Remove tatweel (kashida) elongation.",
        applies_to=("text_normalised",),
        detail=f"Delete U+{ord(_TATWEEL):04X}.",
    ),
    NormalisationRule(
        id="unify-alef",
        description="Unify alef variants to bare alef.",
        applies_to=("text_normalised",),
        detail=_mapping_detail(_ALEF_VARIANTS),
    ),
    NormalisationRule(
        id="normalise-ta-marbuta",
        description="Map teh marbuta to heh.",
        applies_to=("text_normalised",),
        detail=_mapping_detail(_TA_MARBUTA),
    ),
    NormalisationRule(
        id="normalise-alif-maqsura",
        description="Map alef maksura to yeh.",
        applies_to=("text_normalised",),
        detail=_mapping_detail(_ALIF_MAQSURA),
    ),
)


def derive_text_fields(text_uthmani: str, text_simple: str) -> dict[str, str]:
    return {
        "text_uthmani": text_uthmani,
        "text_simple": text_simple,
        "text_no_tashkeel": strip_tashkeel(text_uthmani),
        "text_normalised": normalise(text_uthmani),
    }
