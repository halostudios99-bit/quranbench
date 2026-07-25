"""Stage — morphology (annotation layer).

Ingest the Quranic Arabic Corpus morphology (Leeds, via the mustafa0x fork) and
layer it onto the tokens produced by the segmentation stage. This is an
*annotation*: token ids, positions and surface text are never changed. Every
token gains a ``morphology`` block; the Quranic text is untouched.

The Leeds data addresses tokens as ``surah:verse:word:segment``. Its *word* level
corresponds to our whitespace tokens; its *segment* level is sub-word morphology
(prefixes, stem, suffixes). Alignment is **verified, not assumed**: every Leeds
word is mapped to one of our token ids by comparing surface forms, and every
divergence is enumerated (see :func:`annotate` and the emitted report).

Licence: the Leeds data is GPL-2.0-or-later. Any artifact carrying it inherits
that copyleft — see docs/licensing.md and morphology/ATTRIBUTION.md.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .identifiers import token_id
from .sources import MORPHOLOGY_SOURCE_ID
from .translit import spaced as spaced_root
from .translit import to_slug

# --- feature vocabulary (from the fork's morphology-terms-ar.json) ------------
# Nominal sub-parts-of-speech: when one heads a nominal stem it IS the pos;
# otherwise a nominal stem's pos is the coarse "N".
_NOUN_SUBPOS = {"PN", "PRON", "DEM", "REL", "T", "LOC", "NV", "COND", "INTG"}
_TENSE = {"PERF", "IMPF", "IMPV"}
_CASE = {"NOM", "ACC", "GEN"}
_DERIVATION = {"ACT_PCPL", "PASS_PCPL", "VN"}
_PGN = re.compile(r"^([123])?([MF])?([SDP])?$")
_NUMBER = {"S": "singular", "D": "dual", "P": "plural"}

# Deterministic feature-key order, so identical morphology always serialises to
# identical bytes (checksums depend on it).
_FEATURE_ORDER = (
    "tense",
    "mood",
    "voice",
    "case",
    "state",
    "person",
    "gender",
    "number",
    "derivation",
    "adjective",
    "verb_form",
    "family",
    "other",
)


def _ordered_features(raw: dict[str, Any]) -> dict[str, Any]:
    return {k: raw[k] for k in _FEATURE_ORDER if k in raw}


@dataclass
class Segment:
    text: str
    type: str  # "prefix" | "stem" | "suffix"
    pos: str
    features: dict[str, Any]
    root: str | None = None  # raw Leeds root, e.g. "زكو"
    lemma: str | None = None

    def record(self) -> dict[str, Any]:
        rec: dict[str, Any] = {"text": self.text, "type": self.type, "pos": self.pos}
        if self.root is not None:
            rec["root"] = spaced_root(self.root)
            rec["root_slug"] = to_slug(self.root)
        if self.lemma is not None:
            rec["lemma"] = self.lemma
        rec["features"] = _ordered_features(self.features)
        return rec


@dataclass
class LeedsWord:
    surah: int
    verse: int
    word: int
    segments: list[Segment]

    @property
    def surface(self) -> str:
        return "".join(s.text for s in self.segments)


def parse_segment(form: str, coarse: str, tokens: list[str]) -> Segment:
    """Turn one morphology line's tag column into a structured :class:`Segment`.

    ``coarse`` is the file's 3-way class (N / V / P). ``tokens`` are the
    pipe-separated tag tokens (empties already removed).
    """
    seg_type = "prefix" if "PREF" in tokens else ("suffix" if "SUFF" in tokens else "stem")
    root: str | None = None
    lemma: str | None = None
    verb_form: str | None = None
    mood: str | None = None
    family: str | None = None
    bare: list[str] = []
    for t in tokens:
        if t in ("PREF", "SUFF"):
            continue
        if t.startswith("ROOT:"):
            root = t[5:]
        elif t.startswith("LEM:"):
            lemma = t[4:]
        elif t.startswith("VF:"):
            verb_form = t[3:]
        elif t.startswith("MOOD:"):
            mood = t[5:]
        elif t.startswith("FAM:"):
            family = t[4:]
        else:
            bare.append(t)

    if seg_type in ("prefix", "suffix"):
        pos = bare[0] if bare else coarse
    elif coarse == "V":
        pos = "V"
    elif coarse == "N":
        pos = bare[0] if (bare and bare[0] in _NOUN_SUBPOS) else "N"
    else:  # coarse == "P"
        pos = bare[0] if bare else "P"

    features: dict[str, Any] = {}
    for t in bare:
        if t == pos:
            continue
        if t in _TENSE:
            features["tense"] = t
        elif t == "PASS":
            features["voice"] = "passive"
        elif t in _DERIVATION:
            features["derivation"] = t
        elif t == "ADJ":
            features["adjective"] = True
        elif t in _CASE:
            features["case"] = t
        elif t == "INDEF":
            features["state"] = "indefinite"
        else:
            m = _PGN.match(t)
            if m and (m.group(1) or m.group(2) or m.group(3)):
                if m.group(1):
                    features["person"] = m.group(1)
                if m.group(2):
                    features["gender"] = m.group(2)
                if m.group(3):
                    features["number"] = _NUMBER[m.group(3)]
            else:
                # Safety net: nothing should land here. If it does, keep it rather
                # than drop it, so a test can catch the unhandled tag.
                features.setdefault("other", []).append(t)
    if verb_form is not None:
        features["verb_form"] = verb_form
    if mood is not None:
        features["mood"] = mood
    if family is not None:
        features["family"] = family

    return Segment(text=form, type=seg_type, pos=pos, features=features, root=root, lemma=lemma)


def parse_morphology(text: str) -> dict[tuple[int, int], list[LeedsWord]]:
    """Parse the morphology file into ``(surah, verse) -> [LeedsWord]`` in order."""
    by_verse: dict[tuple[int, int], dict[int, LeedsWord]] = {}
    for line in text.splitlines():
        if not line.strip():
            continue
        loc, form, coarse, feat = line.split("\t")
        s, v, w, _sg = (int(x) for x in loc.split(":"))
        toks = [t for t in feat.split("|") if t != ""]
        seg = parse_segment(form, coarse, toks)
        verse = by_verse.setdefault((s, v), {})
        word = verse.get(w)
        if word is None:
            word = LeedsWord(surah=s, verse=v, word=w, segments=[])
            verse[w] = word
        word.segments.append(seg)
    return {k: [v[w] for w in sorted(v)] for k, v in by_verse.items()}


# --- surface comparison -------------------------------------------------------
# Two editions (Tanzil / Leeds) spell the same word with different orthography.
# Alignment compares words under a fold, not byte-for-byte. Two tiers: a
# conservative fold that resolves the common hamza-seat and letter differences,
# and an extended fold for the medial dagger-alef / alef-maksura equivalence that
# affects a tiny, enumerated set.
_DIACRITICS = re.compile(
    "["
    + "".join(
        f"{chr(a)}-{chr(b)}"
        for a, b in (
            (0x0610, 0x061A),
            (0x064B, 0x065F),
            (0x0670, 0x0670),
            (0x06D6, 0x06DC),
            (0x06DF, 0x06E8),
            (0x06EA, 0x06ED),
        )
    )
    + "]"
)
_FOLD_LETTERS = str.maketrans(
    {"آ": "ا", "أ": "ا", "إ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"}
)


def afold(s: str) -> str:
    s = _DIACRITICS.sub("", s)
    s = s.replace("ـ", "").replace(" ", "").replace("ء", "")
    return s.translate(_FOLD_LETTERS)


def afold_ext(s: str) -> str:
    # Additionally drop U+0649 (alef maksura) and U+0670 (superscript alef) whole,
    # so Leeds's maksura-seated dagger alef matches Tanzil's bare dagger alef.
    return afold(s.replace("ى", "").replace("ٰ", ""))


# --- word-level fields from a word's segments ---------------------------------
def _primary_stem(segments: list[Segment]) -> Segment | None:
    stems = [s for s in segments if s.type == "stem"]
    for s in stems:
        if s.root is not None:
            return s
    return stems[0] if stems else None


@dataclass
class Annotation:
    """The finished morphology block for one of our tokens, plus how it aligned."""

    block: dict[str, Any]
    root_raw: str | None
    lemma: str | None


def _build_block(segments: list[Segment], kind: str) -> Annotation:
    prim = _primary_stem(segments)
    root_raw = prim.root if prim else None
    lemma = prim.lemma if prim else None
    pos = prim.pos if prim else segments[0].pos
    features = prim.features if prim else {}

    # No `surface` field: a token's morphological surface is exactly the
    # concatenation of its segment texts, so storing it would be redundant. The
    # concat==surface property is asserted against the token's text instead.
    block: dict[str, Any] = {
        "root": spaced_root(root_raw) if root_raw is not None else None,
        "root_slug": to_slug(root_raw) if root_raw is not None else None,
        "lemma": lemma,
        "pos": pos,
        "features": _ordered_features(features),
        "segments": [s.record() for s in segments],
        "morphology_source": MORPHOLOGY_SOURCE_ID,
        "alignment": kind,
    }
    return Annotation(block=block, root_raw=root_raw, lemma=lemma)


def _surface_of(block: dict[str, Any]) -> str:
    return "".join(s["text"] for s in block["segments"])


# --- alignment ----------------------------------------------------------------
@dataclass
class AlignmentStats:
    our_tokens: int = 0
    leeds_words: int = 0
    exact: int = 0
    normalised: int = 0
    extended: int = 0
    merged_words: int = 0
    merged_tokens: int = 0
    basmala_copied: int = 0
    failed: list[tuple[str, str, str]] = field(default_factory=list)
    unaligned_our: list[str] = field(default_factory=list)
    merged_detail: list[tuple[str, str, list[str]]] = field(default_factory=list)
    extended_detail: list[tuple[str, str, str]] = field(default_factory=list)
    multi_root: list[tuple[str, list[str]]] = field(default_factory=list)


def _split_segments(segments: list[Segment], first_surface: str) -> tuple[list[Segment], list[Segment]] | None:
    """Split a Leeds word's segments at the boundary matching ``first_surface``
    (one of our tokens). Returns the two segment groups, or None if no boundary
    lines up — e.g. a single segment that itself contains a space."""
    acc = ""
    for k in range(1, len(segments)):
        acc += segments[k - 1].text
        if afold(acc) == afold(first_surface):
            return segments[:k], segments[k:]
    return None


def annotate(
    token_records: list[dict[str, Any]],
    morphology_text: str,
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]], AlignmentStats]:
    """Align Leeds words to our tokens and build a morphology block for each.

    Returns ``(blocks_by_token_id, roots_records, stats)``. Raises nothing on
    ordinary discrepancies — they are recorded in ``stats`` — but a structural
    impossibility (a verse present in one side and absent in the other) surfaces
    as an unaligned entry to be inspected, never a silent drop.
    """
    morph = parse_morphology(morphology_text)

    # our tokens grouped by (surah, slot), in position order.
    by_seg: dict[tuple[int, str], list[dict[str, Any]]] = {}
    for t in token_records:
        by_seg.setdefault((t["surah"], t["slot"]), []).append(t)
    for toks in by_seg.values():
        toks.sort(key=lambda t: t["position"])

    stats = AlignmentStats(our_tokens=len(token_records))
    stats.leeds_words = sum(len(ws) for ws in morph.values())
    blocks: dict[str, dict[str, Any]] = {}
    # root (raw) -> {"token_ids": [...], "lemmas": set}
    roots: dict[str, dict[str, Any]] = {}

    def record_root(root_raw: str | None, lemma: str | None, token_id_str: str) -> None:
        if root_raw is None:
            return
        entry = roots.setdefault(root_raw, {"token_ids": [], "lemmas": {}})
        entry["token_ids"].append(token_id_str)
        if lemma is not None:
            entry["lemmas"][lemma] = entry["lemmas"].get(lemma, 0) + 1

    def assign(token: dict[str, Any], segments: list[Segment], kind: str) -> None:
        ann = _build_block(segments, kind)
        blocks[token["id"]] = ann.block
        record_root(ann.root_raw, ann.lemma, token["id"])
        roots_in_word = {s.root for s in segments if s.root is not None}
        if len(roots_in_word) > 1:
            stats.multi_root.append((token["id"], sorted(spaced_root(r) for r in roots_in_word)))

    surahs = sorted({t["surah"] for t in token_records})
    fatiha_basmala: dict[int, dict[str, Any]] = {}  # position -> block (template)

    for surah in surahs:
        # Verse segments: our slot is the verse ordinal as a string.
        verse_slots = sorted(
            {slot for (s, slot) in by_seg if s == surah and slot != "basmala"},
            key=lambda x: int(x),
        )
        for slot in verse_slots:
            our_toks = by_seg[(surah, slot)]
            leeds_words = morph.get((surah, int(slot)), [])
            _align_verse(surah, slot, our_toks, leeds_words, assign, stats)

        # Separated basmala: no Leeds word exists. Copy the analysis from
        # al-Fatiha's basmala (verse 1:1), matched by position — the four words
        # are identical up to the recitation shadda variant, which the fold covers.
        basm = by_seg.get((surah, "basmala"))
        if basm:
            for token in basm:
                template = fatiha_basmala.get(token["position"])
                if template is None:
                    stats.failed.append((token["id"], "<basmala>", "<no 1:1 template>"))
                    continue
                block = _copy_basmala(template)
                surface = _surface_of(block)
                if afold(surface) != afold(token["text_uthmani"]):
                    stats.failed.append((token["id"], surface, token["text_uthmani"]))
                    continue
                blocks[token["id"]] = block
                record_root(_raw_root_of(block), block["lemma"], token["id"])
                stats.basmala_copied += 1

        # After surah 1 is aligned, capture its basmala (verse-1 tokens) as the
        # template for every separated basmala.
        if surah == 1:
            for token in by_seg.get((1, "1"), []):
                if token["id"] in blocks:
                    fatiha_basmala[token["position"]] = blocks[token["id"]]

    # unaligned = any of our tokens that never received a block.
    for t in token_records:
        if t["id"] not in blocks:
            stats.unaligned_our.append(t["id"])

    roots_records = _build_roots_records(roots, token_records)
    return blocks, roots_records, stats


def _align_verse(
    surah: int,
    slot: str,
    our_toks: list[dict[str, Any]],
    leeds_words: list[LeedsWord],
    assign,
    stats: AlignmentStats,
) -> None:
    i = 0
    for j, lw in enumerate(leeds_words):
        surface = lw.surface
        loc = f"{surah}:{slot}:{lw.word}"
        if i >= len(our_toks):
            stats.failed.append((loc, surface, "<no our token>"))
            continue
        ot = our_toks[i]
        ou = ot["text_uthmani"]
        if ou == surface:
            assign(ot, lw.segments, "exact")
            stats.exact += 1
            i += 1
        elif afold(ou) == afold(surface):
            assign(ot, lw.segments, "normalised")
            stats.normalised += 1
            i += 1
        elif afold_ext(ou) == afold_ext(surface):
            assign(ot, lw.segments, "extended")
            stats.extended += 1
            stats.extended_detail.append((ot["id"], surface, ou))
            i += 1
        elif i + 1 < len(our_toks) and afold(ou + our_toks[i + 1]["text_uthmani"]) == afold(surface):
            _assign_merged(surah, slot, lw, our_toks, i, assign, stats)
            i += 2
        else:
            stats.failed.append((loc, surface, ou))
            i += 1
    # Our tokens beyond the Leeds words in this verse are left unassigned and
    # surface as unaligned_our — never silently dropped.


def _assign_merged(
    surah: int,
    slot: str,
    lw: LeedsWord,
    our_toks: list[dict[str, Any]],
    i: int,
    assign,
    stats: AlignmentStats,
) -> None:
    """A Leeds word spans two of our whitespace tokens. Distribute its segments to
    the two tokens so each token's segments reproduce its own surface."""
    a, b = our_toks[i], our_toks[i + 1]
    split = _split_segments(lw.segments, a["text_uthmani"])
    if split is not None:
        left, right = split
    else:
        # A single Leeds segment carrying an internal space (e.g. "إِلْ يَاسِينَ").
        # Split its form on whitespace and give each piece the same analysis.
        pieces = lw.segments[0].text.split(" ")
        proto = lw.segments[0]
        if len(pieces) == 2:
            left = [Segment(pieces[0], proto.type, proto.pos, dict(proto.features), proto.root, proto.lemma)]
            right = [Segment(pieces[1], proto.type, proto.pos, dict(proto.features), proto.root, proto.lemma)]
        else:  # pragma: no cover — no such case in the corpus
            stats.failed.append((f"{surah}:{slot}:{lw.word}", lw.surface, a["text_uthmani"]))
            return
    assign(a, left, "merged")
    assign(b, right, "merged")
    stats.merged_words += 1
    stats.merged_tokens += 2
    stats.merged_detail.append((f"{surah}:{slot}:{lw.word}", lw.surface, [a["text_uthmani"], b["text_uthmani"]]))


def _raw_root_of(block: dict[str, Any]) -> str | None:
    """Recover the raw (unspaced) root from a block's spaced root, for roots.json."""
    root = block.get("root")
    return root.replace(" ", "") if root else None


def _copy_basmala(template: dict[str, Any]) -> dict[str, Any]:
    block = {
        "root": template["root"],
        "root_slug": template["root_slug"],
        "lemma": template["lemma"],
        "pos": template["pos"],
        "features": dict(template["features"]),
        "segments": [dict(s) for s in template["segments"]],
        "morphology_source": MORPHOLOGY_SOURCE_ID,
        "alignment": "basmala-copied",
    }
    return block


def _build_roots_records(
    roots: dict[str, dict[str, Any]],
    token_records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    order = {t["id"]: n for n, t in enumerate(token_records)}
    records: list[dict[str, Any]] = []
    for root_raw, entry in roots.items():
        token_ids = sorted(set(entry["token_ids"]), key=lambda tid: order.get(tid, 1 << 30))
        lemmas = sorted(entry["lemmas"], key=lambda lm: (-entry["lemmas"][lm], lm))
        records.append(
            {
                "root": spaced_root(root_raw),
                "root_slug": to_slug(root_raw),
                "lemmas": lemmas,
                "occurrences": len(token_ids),
                "token_ids": token_ids,
            }
        )
    records.sort(key=lambda r: (-r["occurrences"], r["root_slug"]))
    return records


# --- report -------------------------------------------------------------------
def report_stats(stats: AlignmentStats, roots_records: list[dict[str, Any]]) -> dict[str, Any]:
    aligned = stats.exact + stats.normalised + stats.extended + stats.merged_words
    tokens_with_root = sum(r["occurrences"] for r in roots_records)
    return {
        "our_tokens": stats.our_tokens,
        "leeds_words": stats.leeds_words,
        "aligned_leeds_words": aligned,
        "align_rate": aligned / stats.leeds_words if stats.leeds_words else 0.0,
        "exact": stats.exact,
        "normalised": stats.normalised,
        "extended": stats.extended,
        "merged_words": stats.merged_words,
        "merged_tokens": stats.merged_tokens,
        "basmala_copied": stats.basmala_copied,
        "failed": len(stats.failed),
        "unaligned_our": len(stats.unaligned_our),
        "distinct_roots": len(roots_records),
        "tokens_with_root": tokens_with_root,
        "tokens_without_root": stats.our_tokens - tokens_with_root,
    }


def render_report(stats: AlignmentStats, roots_records: list[dict[str, Any]]) -> str:
    s = report_stats(stats, roots_records)
    lines: list[str] = []
    w = lines.append
    w("# Morphology alignment report\n")
    w(
        "Generated by `pipeline.morphology`. Maps every Leeds Quranic Arabic Corpus "
        "word (mustafa0x fork of QAC v0.4) to a quranbench token id, comparing surface "
        "forms. Nothing is dropped silently: every divergence is listed here.\n"
    )
    w("## Totals\n")
    w(f"- our tokens: **{s['our_tokens']}**")
    w(f"- Leeds words: **{s['leeds_words']}**")
    w(
        f"- aligned Leeds words: **{s['aligned_leeds_words']}** "
        f"({100 * s['align_rate']:.4f}%)"
    )
    w(f"  - exact surface match: {s['exact']}")
    w(f"  - matched after normalisation (hamza/letter fold): {s['normalised']}")
    w(f"  - matched after extended fold (dagger-alef/maksura): {s['extended']}")
    w(
        f"  - Leeds word spanning two of our whitespace tokens (merged): "
        f"{s['merged_words']} words -> {s['merged_tokens']} tokens"
    )
    w(f"- separated-basmala tokens annotated by copy from 1:1: **{s['basmala_copied']}**")
    w(f"- unresolved failures: **{s['failed']}**")
    w(f"- our tokens left unaligned: **{s['unaligned_our']}**\n")

    w("## Token count reconciliation vs Leeds\n")
    w(
        "Our corpus counts 77,881 tokens including the 112 separated basmalas "
        "(112 × 4 = 448). Excluding them leaves **77,433**, which still includes "
        "al-Fatiha's basmala (its verse 1:1). Leeds/this fork counts **77,429** "
        "words. The difference of **4** is exactly four places where Tanzil's "
        "whitespace segmentation yields two tokens where Leeds keeps one word:\n"
    )
    for loc, surface, parts in stats.merged_detail:
        w(f"- `{loc}` Leeds `{surface}` = our `{parts[0]}` + `{parts[1]}`")
    w("")

    if stats.extended_detail:
        w("## Tokens aligned only after the extended fold\n")
        w(
            "The same word in each edition, differing only in how a medial long ā is "
            "seated (Leeds: alef-maksura + dagger alef; Tanzil: dagger alef alone). "
            "Aligned deliberately — a documented judgement call.\n"
        )
        for tid, leeds, ours in stats.extended_detail:
            w(f"- `{tid}` Leeds `{leeds}` vs Tanzil `{ours}`")
        w("")

    if stats.multi_root:
        w("## Words with more than one root (judgement call)\n")
        w(
            "A compound word whose segments carry different roots. The token's "
            "head `root` is taken from its first root-bearing stem.\n"
        )
        for tid, rs in stats.multi_root:
            w(f"- `{tid}` roots: {', '.join(rs)}")
        w("")

    if stats.failed:
        w("## Unresolved failures (Leeds form | our form)\n")
        for loc, leeds, ours in stats.failed:
            w(f"- `{loc}` `{leeds}` | `{ours}`")
        w("")
    if stats.unaligned_our:
        w("## Our tokens with no Leeds word\n")
        for tid in stats.unaligned_our:
            w(f"- `{tid}`")
        w("")

    w("## Roots\n")
    w(f"- distinct roots: **{s['distinct_roots']}**")
    w(f"- tokens with a root: **{s['tokens_with_root']}**")
    w(
        f"- tokens with no root (particles, pronouns, proper nouns, muqaṭṭaʿāt): "
        f"**{s['tokens_without_root']}** "
        f"({100 * s['tokens_without_root'] / s['our_tokens']:.1f}%)\n"
    )
    w("### Top 10 roots by occurrence\n")
    w("| root | slug | occurrences |")
    w("| --- | --- | --- |")
    for r in roots_records[:10]:
        w(f"| {r['root']} | {r['root_slug']} | {r['occurrences']} |")
    w("")
    return "\n".join(lines)
