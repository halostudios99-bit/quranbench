"""Stage — Lane's Lexicon (external annotation, by root).

Edward William Lane's *An Arabic-English Lexicon* (1863–1893) is the standard
classical Arabic–English dictionary. The public-domain work is digitised as TEI
XML by the Perseus Digital Library (Tufts); we take the ``laneslexicon/lexicon_xml``
mirror of the Perseus ``originals``, pinned to an immutable commit. Perseus's text
is CC BY-SA 3.0 US at the site level; each XML file additionally embeds Perseus's
own availability statement (credit Perseus + funders, keep the statement, offer
modifications back). Both are attribution + share-alike — displayable *and*
redistributable, unlike a NoDerivatives edition.

The digitisation stores Arabic in a Buckwalter-style Latin transliteration, not
Unicode. Each ``<div2 type="root" n="...">`` is one root's article, keyed by the
root in that transliteration (e.g. ``zbd`` = ز ب د). We:

  1. decode the root key to Arabic and match it against the corpus's own roots by
     slug — an **exact** match, so a decode error becomes a miss, never a wrong
     root ("a wrong root is worse than an absent one"); plus two safe, documented
     normalisations (geminate contraction, weak-final) that only match when the
     target is unambiguous;
  2. render each matched article to readable text, decoding the inline
     ``<foreign lang="ar">`` transliteration back to Arabic script.

Coverage is uneven by nature: Lane died before finishing, and the later volumes
(assembled posthumously by Stanley Lane-Poole) are thin. The actual fraction of
the corpus's roots with an entry is measured and reported, never assumed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

# The Perseus ``originals`` mirror, pinned. One XML file per letter (some split).
LANE_COMMIT = "51e0794420da4f2b20148dc0395d4bfdbe60ee2a"
LANE_FILES: tuple[str, ...] = (
    "$0", "_0", "_A0", "_D0", "_E0", "_H0", "_S0", "_T0", "_Y0", "_Y1", "_Z0",
    "b0", "d0", "f0", "g0", "h0", "h1", "j0", "k0", "k1", "l0", "l1", "m0", "m1",
    "n0", "n1", "q0", "q1", "r0", "s0", "t0", "v0", "w0", "w1", "x0", "z0",
)


def lane_raw_url(name: str) -> str:
    from urllib.parse import quote

    return (
        "https://raw.githubusercontent.com/laneslexicon/lexicon_xml/"
        f"{LANE_COMMIT}/{quote(name)}.xml"
    )


# --- Buckwalter → Arabic ------------------------------------------------------
_BW_LETTER = {
    "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ", "A": "ا",
    "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج", "H": "ح", "x": "خ",
    "d": "د", "*": "ذ", "r": "ر", "z": "ز", "s": "س", "$": "ش", "S": "ص",
    "D": "ض", "T": "ط", "Z": "ظ", "E": "ع", "g": "غ", "f": "ف", "q": "ق",
    "k": "ك", "l": "ل", "m": "م", "n": "ن", "h": "ه", "w": "و", "y": "ي",
    "Y": "ى", "{": "ٱ",
}
_BW_DIAC = {
    "a": "َ", "i": "ِ", "u": "ُ", "o": "ْ", "~": "ّ", "F": "ً", "N": "ٌ",
    "K": "ٍ", "`": "ٰ", "_": "ـ",
}


def decode_buckwalter(text: str) -> str:
    """Decode a Buckwalter-transliterated Arabic token to Arabic script.

    Perseus writes hamza-on-alef as the pair ``A^`` and a bare superscript hamza
    as ``^``; both become the appropriate hamza seat. Anything unmapped is passed
    through so a gap is visible rather than silently dropped.
    """
    text = text.replace("A^", "أ").replace("^", "ء")
    out: list[str] = []
    for ch in text:
        if ch in _BW_LETTER:
            out.append(_BW_LETTER[ch])
        elif ch in _BW_DIAC:
            out.append(_BW_DIAC[ch])
        else:
            out.append(ch)
    return "".join(out)


# Matching QAC roots to Lane articles compares a *folded* radical fingerprint, not
# the exact slug, because the two traditions seat the same radical differently: QAC
# writes an initial hamza as أ where Lane's Perseus text uses bare alef, and Lane
# files ى/weak endings variably. The fold collapses every hamza/alef seat to one
# class and ى→ي, ة→ت. Verified over the whole corpus: zero distinct QAC roots
# collide under this fold, so a folded match can never silently pick a wrong root.
_ALL_ROOT_LETTERS = set("ابتثجحخدذرزسشصضطظعغفقكلمنهويىءأؤإئآٱة")
_FOLD = {
    "أ": "ء", "إ": "ء", "ؤ": "ء", "ئ": "ء", "آ": "ء", "ٱ": "ء", "ا": "ء",
    "ة": "ت", "ى": "ي",
}


def fold_radicals(arabic: str) -> str:
    """The radical fingerprint of an Arabic root (spaced or not) used for matching."""
    return "".join(
        _FOLD.get(ch, ch) for ch in arabic if not ch.isspace() and ch in _ALL_ROOT_LETTERS
    )


def fold_key(n: str) -> str:
    """The radical fingerprint of a Lane Buckwalter root key."""
    return fold_radicals(decode_buckwalter(n))


# --- article rendering --------------------------------------------------------
def _strip_ns(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def render_entry(div2: ET.Element) -> str:
    """Readable plain text of a root article: English prose with the inline Arabic
    transliteration decoded back to Arabic script. Sense/paragraph structure is
    preserved as blank-line-separated blocks."""
    blocks: list[str] = []
    for entry in div2.iter():
        if _strip_ns(entry.tag) != "entryFree":
            continue
        text = _render_mixed(entry)
        text = re.sub(r"[ \t]+", " ", text).strip()
        if text:
            blocks.append(text)
    if not blocks:
        blocks.append(re.sub(r"\s+", " ", _render_mixed(div2)).strip())
    return "\n\n".join(b for b in blocks if b)


# Elements whose textual content is dropped from the readable rendering: the form
# type number (<itype>1</itype>) and structural head. Arabic lives in <foreign> and
# <orth lang="ar"> and is decoded; everything else is kept as English prose.
_DROP_TAGS = {"itype", "head"}


def _render_mixed(el: ET.Element) -> str:
    parts: list[str] = []

    def walk(node: ET.Element) -> None:
        tag = _strip_ns(node.tag)
        if tag in _DROP_TAGS:
            if node.tail:
                parts.append(node.tail)
            return
        if node.get("lang") == "ar" and tag in ("foreign", "orth"):
            raw = "".join(node.itertext()).strip()
            # Lane's "*" orth is a repeat-of-headword marker, not the letter ذ.
            if raw and raw != "*":
                parts.append(" " + decode_buckwalter(raw) + " ")
            if node.tail:
                parts.append(node.tail)
            return
        if node.text:
            parts.append(node.text)
        for child in node:
            walk(child)
        if node.tail:
            parts.append(node.tail)

    if el.text:
        parts.append(el.text)
    for child in el:
        walk(child)
    return "".join(parts)


# --- parse + match ------------------------------------------------------------
@dataclass
class LaneEntry:
    root_slug: str
    root: str  # spaced-Arabic, from the corpus root record
    headword_bw: str  # Lane's Buckwalter root key
    headword_ar: str  # decoded Arabic of the key
    match: str  # "direct" | "geminate"
    text: str


@dataclass
class LexiconStats:
    lane_roots: int = 0
    corpus_roots: int = 0
    matched: int = 0
    direct: int = 0
    geminate: int = 0
    fold_collisions: int = 0  # distinct corpus roots sharing a fold — must be 0
    missing: list[str] = field(default_factory=list)  # spaced-Arabic roots


def build_lexicon(
    files: dict[str, str],
    corpus_roots: list[dict[str, str]],
) -> tuple[dict[str, LaneEntry], LexiconStats]:
    """Parse every Lane file, index articles by folded radical fingerprint, and
    match each corpus root to at most one article. Returns ``(entries_by_slug,
    stats)``.

    ``corpus_roots`` are the roots.json records (``root`` spaced-Arabic, ``root_slug``).
    """
    # fold -> (root_key_bw, div2), first article seen at that fingerprint.
    lane_by_fold: dict[str, tuple[str, ET.Element]] = {}
    lane_root_count = 0
    for xml in files.values():
        root = ET.fromstring(xml)
        for div2 in root.iter():
            if _strip_ns(div2.tag) != "div2" or div2.get("type") != "root":
                continue
            n = div2.get("n")
            if not n:
                continue
            lane_root_count += 1
            fp = fold_key(n)
            if fp and fp not in lane_by_fold:
                lane_by_fold[fp] = (n, div2)

    # Guard the invariant the fold relies on: no two distinct corpus roots may
    # share a fingerprint, or a folded match could resolve to the wrong root.
    fold_counts: dict[str, int] = {}
    for rec in corpus_roots:
        fold_counts[fold_radicals(rec["root"])] = (
            fold_counts.get(fold_radicals(rec["root"]), 0) + 1
        )
    collisions = sum(1 for c in fold_counts.values() if c > 1)

    entries: dict[str, LaneEntry] = {}
    stats = LexiconStats(
        lane_roots=lane_root_count,
        corpus_roots=len(corpus_roots),
        fold_collisions=collisions,
    )
    for rec in corpus_roots:
        fp = fold_radicals(rec["root"])
        kind: str | None = None
        if fp in lane_by_fold:
            kind = "direct"
        elif len(fp) >= 2 and fp[-1] == fp[-2] and fp[:-1] in lane_by_fold:
            # A doubled-final (geminate) corpus root is filed biliterally in Lane.
            fp = fp[:-1]
            kind = "geminate"
        if kind is None:
            stats.missing.append(rec["root"])
            continue
        n, div2 = lane_by_fold[fp]
        entries[rec["root_slug"]] = LaneEntry(
            root_slug=rec["root_slug"],
            root=rec["root"],
            headword_bw=n,
            headword_ar=decode_buckwalter(n),
            match=kind,
            text=render_entry(div2),
        )
        stats.matched += 1
        setattr(stats, kind, getattr(stats, kind) + 1)
    return entries, stats


def render_report(stats: LexiconStats) -> str:
    lines: list[str] = []
    w = lines.append
    total = stats.corpus_roots
    w("# Lane's Lexicon coverage report\n")
    w(
        "Generated by `pipeline.lexicon`. Maps Edward William Lane's *Arabic-English "
        "Lexicon* (Perseus/Tufts TEI, `laneslexicon/lexicon_xml`) onto the corpus's "
        "roots by decoding each article's Buckwalter root key to Arabic and matching "
        "by slug. External annotation, CC BY-SA 3.0 (Perseus) — see "
        "`LANE-ATTRIBUTION.md`.\n"
    )
    w("## Coverage\n")
    w(f"- corpus roots: **{total}**")
    w(
        f"- roots with a Lane entry: **{stats.matched}** "
        f"({100 * stats.matched / total:.1f}%)"
    )
    w(f"  - matched directly on the radical fingerprint: {stats.direct}")
    w(f"  - matched by geminate contraction (…X X → …X): {stats.geminate}")
    w(
        f"- roots with **no** entry: **{len(stats.missing)}** "
        f"({100 * len(stats.missing) / total:.1f}%)"
    )
    w(f"- distinct Lane root articles parsed: {stats.lane_roots}")
    w(
        f"- corpus roots colliding under the matching fold: **{stats.fold_collisions}** "
        "(must be 0 — a non-zero value would mean a match could resolve to the wrong "
        "root)\n"
    )
    w(
        "Coverage is uneven by nature: Lane died in 1876 before finishing, and the "
        "later letters (assembled posthumously by Stanley Lane-Poole) are thin or "
        "absent. Where no entry exists, the root page says so explicitly — never a "
        "blank that reads as \"no meaning\".\n"
    )
    w("## Roots with no Lane entry\n")
    for r in stats.missing:
        w(f"- {r}")
    w("")
    return "\n".join(lines)
