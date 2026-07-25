"""Translation editions — ingest and emit.

Verse-level translation editions, added in v0.6.0. Each edition is one licensed
human translation, aligned to the corpus by verse id only. **Word-level alignment
data does not exist for these editions and is never fabricated.**

## Licensing is the binding constraint

This project publishes a redistributable dataset. Every edition records, per
``redistributable``, whether its licence permits inclusion in the dataset
downloads:

- **Redistributable** editions (public domain, or a permissive licence that
  clearly allows redistribution) are both displayed to readers *and* shipped in
  the per-file downloads and the full tarball.
- **Display-only** editions are shown to readers but excluded from every
  download. This is for editions whose licence permits display but not open
  redistribution — e.g. Talal Itani's ClearQuran, under CC BY-NC-ND 4.0, whose
  NonCommercial and NoDerivatives terms are incompatible with an openly
  redistributable dataset.

If an edition's licence is unclear, ambiguous or absent, it is not included at
all. Availability is never treated as permission.

Two consequences shaped the source choice, both documented in
``docs/translations-report.md``:

1. **Tanzil's translation collection cannot be redistributed.** Tanzil's own Terms
   of Use restrict the collection to non-commercial use and forbid redistributing
   the list without permission; it carries no per-edition redistribution licence.
   So Tanzil hosting alone qualifies nothing.
2. Every edition here is therefore included on the basis of the *work's own*
   public-domain status (author death + first-publication dates), independently
   verifiable, and retrieved from a public-domain (Unlicense) compilation of
   public-domain texts pinned to an immutable commit.

The alignment for all editions was verified: each has exactly one line per counted
verse, with verse keys identical to ``verses.jsonl`` (see ``tests``).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

# The retrieval source: fawazahmed0/quran-api, released into the public domain
# (Unlicense), a compilation of public-domain translation texts. Pinned to an
# immutable commit so the download is reproducible and checksum-stable — the same
# discipline the morphology source uses. This is a *retrieval* origin; the right
# to redistribute each edition derives from the edition's own public-domain status,
# recorded per edition below, not from where the bytes were fetched.
COMPILATION_COMMIT = "6be8e17f2a0c13b1f33b1c3057f73cb28d5e848e"
COMPILATION_NAME = "fawazahmed0/quran-api"
COMPILATION_LICENCE = "Unlicense (public-domain dedication)"
COMPILATION_URL = "https://github.com/fawazahmed0/quran-api"


def _cdn_url(cdn_id: str) -> str:
    return (
        f"https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@{COMPILATION_COMMIT}"
        f"/editions/{cdn_id}.min.json"
    )


@dataclass(frozen=True)
class Translation:
    """One licensed translation edition and the evidence it may be redistributed.

    ``licence`` is the exact licence string recorded in ``sources.json``.
    ``licence_url`` is where that status was read and can be verified.
    ``licence_note`` is the plain-language basis (author death + publication).
    ``redistributable`` states whether the edition's licence permits including it
    in the dataset downloads. Display in the reader is always permitted; only
    freely-redistributable editions may be shipped in the per-file downloads and
    the full tarball. A display-only edition (e.g. one under a NonCommercial or
    NoDerivatives licence) is served to readers but excluded from every download.
    """

    id: str
    name: str
    translator: str
    language: str
    language_code: str
    year: int
    licence: str
    licence_url: str
    licence_note: str
    redistributable: bool
    #: The edition's identifier in the retrieval compilation.
    cdn_id: str
    filename: str

    @property
    def url(self) -> str:
        return _cdn_url(self.cdn_id)


# The public-domain editions below are redistributable: each translator has been
# dead for well over 70 years and the work was first published before 1 January
# 1931 (so it is also public domain in the United States, before the 95-year term
# and unaffected by URAA restoration). This is the reason each may be shipped in the
# open dataset downloads.
#
# Itani / ClearQuran is different: it is modern, readable English but licensed
# CC BY-NC-ND 4.0 — NonCommercial and NoDerivatives, both incompatible with this
# project's open-redistribution promise. It is included as **display-only**
# (``redistributable=False``): served to readers, excluded from every dataset
# download and from the full tarball. Editions considered and fully rejected —
# including Yusuf Ali (US copyright restored by the URAA until ~2033) and Arberry
# (in copyright to 2040) — are enumerated in docs/translations-report.md.
TRANSLATIONS: tuple[Translation, ...] = (
    Translation(
        id="en-itani",
        name="Quran in English (ClearQuran)",
        translator="Talal Itani",
        language="English",
        language_code="en",
        year=2012,
        licence="CC BY-NC-ND 4.0",
        licence_url="https://creativecommons.org/licenses/by-nc-nd/4.0/",
        licence_note=(
            "Displayed with permission of the licence; NOT redistributable in the "
            "dataset. ClearQuran by Talal Itani is released under Creative Commons "
            "Attribution-NonCommercial-NoDerivatives 4.0 International "
            "(CC BY-NC-ND 4.0). The NonCommercial and NoDerivatives terms are "
            "incompatible with an openly-redistributable dataset, so this edition "
            "is served to readers but excluded from every download and from the "
            "full tarball. Licence terms read at the URL above."
        ),
        redistributable=False,
        cdn_id="eng-talalitani",
        filename="en-itani.json",
    ),
    Translation(
        id="en-pickthall",
        name="The Meaning of the Glorious Koran",
        translator="Marmaduke Pickthall",
        language="English",
        language_code="en",
        year=1930,
        licence="Public Domain",
        licence_url="https://en.wikisource.org/wiki/The_Meaning_of_the_Glorious_Koran_(1930)",
        licence_note=(
            "Public domain worldwide. Translator Marmaduke Pickthall died 1936 "
            "(life+70 term expired 2007); first published 1930, before 1 Jan 1931, "
            "so also public domain in the United States."
        ),
        redistributable=True,
        cdn_id="eng-mohammedmarmadu",
        filename="en-pickthall.json",
    ),
    Translation(
        id="en-rodwell",
        name="The Koran",
        translator="John Medows Rodwell",
        language="English",
        language_code="en",
        year=1861,
        licence="Public Domain",
        licence_url="https://en.wikisource.org/wiki/The_Koran_(Rodwell)",
        licence_note=(
            "Public domain worldwide. Translator John Medows Rodwell died 1900 "
            "(life+70 term expired 1970); first published 1861, so also public "
            "domain in the United States."
        ),
        redistributable=True,
        cdn_id="eng-johnmedowsrodwe",
        filename="en-rodwell.json",
    ),
    Translation(
        id="en-palmer",
        name="The Qur'an (Sacred Books of the East, vols. VI & IX)",
        translator="Edward Henry Palmer",
        language="English",
        language_code="en",
        year=1880,
        licence="Public Domain",
        licence_url="https://en.wikisource.org/wiki/The_Qur%27an_(Palmer)",
        licence_note=(
            "Public domain worldwide. Translator Edward Henry Palmer died 1882 "
            "(life+70 term expired 1952); first published 1880, so also public "
            "domain in the United States."
        ),
        redistributable=True,
        cdn_id="eng-edwardhenrypalm",
        filename="en-palmer.json",
    ),
)

TRANSLATIONS_BY_ID: dict[str, Translation] = {t.id: t for t in TRANSLATIONS}

#: role recorded in sources.json for a translation edition
TRANSLATION_ROLE = "translation"

#: subdirectory of the versioned artifact tree holding translation files
TRANSLATIONS_DIR = "translations"


def parse_edition(raw: str) -> dict[tuple[int, int], str]:
    """Parse a compilation edition file (``{"quran": [{chapter, verse, text}]}``)
    into a mapping ``(surah, ayah) -> text``. Verse text is taken verbatim."""
    data = json.loads(raw)
    verses = data["quran"] if isinstance(data, dict) else data
    out: dict[tuple[int, int], str] = {}
    for row in verses:
        key = (int(row["chapter"]), int(row["verse"]))
        if key in out:
            raise ValueError(f"duplicate verse {key} in translation edition")
        out[key] = row["text"]
    return out


def build_lines(
    edition: dict[tuple[int, int], str],
    verse_rows: list[dict[str, Any]],
    translation_id: str,
) -> list[dict[str, Any]]:
    """Align an edition onto the corpus verse rows, one line per counted verse.

    Verse-level alignment only. The line's ``id`` is the verse id from
    ``verses.jsonl`` — an identity mapping, never a new identifier. Fails loudly if
    the edition does not cover every counted verse exactly, so a partial or
    misaligned edition can never ship silently.
    """
    lines: list[dict[str, Any]] = []
    covered: set[tuple[int, int]] = set()
    for v in verse_rows:
        key = (v["surah"], int(v["slot"]))
        text = edition.get(key)
        if text is None:
            raise ValueError(
                f"translation '{translation_id}' has no line for verse {v['id']}"
            )
        covered.add(key)
        lines.append(
            {
                "id": v["id"],
                "surah": v["surah"],
                "slot": v["slot"],
                "ordinals": v["ordinals"],
                "text": text,
            }
        )
    extra = set(edition) - covered
    if extra:
        raise ValueError(
            f"translation '{translation_id}' has {len(extra)} verses not in the "
            f"corpus, e.g. {sorted(extra)[:3]}"
        )
    return lines


def source_record(t: Translation, sha256: str) -> dict[str, Any]:
    """The edition's ``sources.json`` record: licence, translator, year, checksum.

    Extends the base Source shape with ``translator``, ``language`` and
    ``licence_url`` — the licensing brief requires every ingested edition to record
    its licence, translator, year and checksum, and to cite where the licence was
    read.
    """
    return {
        "id": t.id,
        "name": t.name,
        "publisher": "Public domain" if t.redistributable else t.translator,
        "edition": f"{t.translator} ({t.year})",
        "year": t.year,
        "url": t.url,
        "licence": t.licence,
        "licence_url": t.licence_url,
        "licence_note": t.licence_note,
        "redistributable": t.redistributable,
        "translator": t.translator,
        "language": t.language,
        "language_code": t.language_code,
        "role": TRANSLATION_ROLE,
        "retrieval_source": {
            "name": COMPILATION_NAME,
            "licence": COMPILATION_LICENCE,
            "commit": COMPILATION_COMMIT,
            "url": COMPILATION_URL,
        },
        "sha256": sha256,
    }


def licence_file(t: Translation) -> str:
    """The per-edition LICENSE text emitted next to the edition data."""
    redistribution = (
        "The right to redistribute this edition derives from the work's own "
        "public-domain status recorded above, not from where the bytes were "
        "fetched. It is included in the dataset downloads."
        if t.redistributable
        else (
            "**This edition is display-only and is NOT part of the redistributable "
            "dataset.** Its licence permits display with attribution but not open "
            "redistribution, so it is served to readers on the site but excluded "
            "from every dataset download and from the full tarball. Do not "
            "redistribute this file; obtain the edition from the licensor under its "
            "own terms."
        )
    )
    return (
        f"# Licence — {t.name}\n\n"
        f"- **Translation:** {t.name}\n"
        f"- **Translator:** {t.translator}\n"
        f"- **Language:** {t.language}\n"
        f"- **First published:** {t.year}\n"
        f"- **Licence:** {t.licence}\n"
        f"- **Redistributable in dataset:** {'yes' if t.redistributable else 'no (display-only)'}\n"
        f"- **Basis:** {t.licence_note}\n"
        f"- **Verified at:** {t.licence_url}\n\n"
        "## Retrieval\n\n"
        f"The verse text was retrieved from **{COMPILATION_NAME}** "
        f"({COMPILATION_LICENCE}), pinned to immutable commit "
        f"`{COMPILATION_COMMIT}` ({COMPILATION_URL}).\n\n"
        f"{redistribution} Alignment to the corpus is **verse-level only**: there "
        "is one translation line per counted verse, keyed by the verse identifier. "
        "No word-level alignment is claimed or provided.\n"
    )


def manifest_block(
    records: list[dict[str, Any]], line_counts: dict[str, int]
) -> dict[str, Any]:
    """The manifest's ``translations`` block: which editions, their licences, and
    the alignment method — so provenance is readable from the manifest alone."""
    return {
        "alignment": "verse-level",
        "alignment_note": (
            "Each edition is aligned to the corpus by verse identifier only. "
            "Word-level alignment data does not exist for these editions and is "
            "never fabricated. A translation line's id is the verse id from "
            "verses.jsonl (identity mapping)."
        ),
        "licensing_note": (
            "Each edition records whether it is redistributable. Public-domain "
            "editions are both displayed and shipped in the dataset downloads. "
            "Display-only editions (e.g. Talal Itani's ClearQuran, CC BY-NC-ND 4.0) "
            "are served to readers but excluded from every download and the full "
            "tarball, because their licence forbids open redistribution. Tanzil's "
            "translation collection is NOT used as a licence basis: its Terms of "
            "Use restrict the collection to non-commercial use and forbid "
            "redistribution. See docs/translations-report.md for details."
        ),
        "retrieval_source": {
            "name": COMPILATION_NAME,
            "licence": COMPILATION_LICENCE,
            "commit": COMPILATION_COMMIT,
            "url": COMPILATION_URL,
        },
        "editions": [
            {
                "id": r["id"],
                "language": r["language"],
                "language_code": r["language_code"],
                "translator": r["translator"],
                "year": r["year"],
                "licence": r["licence"],
                "licence_url": r["licence_url"],
                "redistributable": r["redistributable"],
                "verses": line_counts[r["id"]],
                "artifact": f"{TRANSLATIONS_DIR}/{r['id']}.jsonl",
                "licence_file": f"{TRANSLATIONS_DIR}/{r['id']}.LICENSE.md",
                "source_id": r["id"],
            }
            for r in records
        ],
    }
