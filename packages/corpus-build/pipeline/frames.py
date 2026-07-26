"""Evidence packs for the translation method (docs/translation-method.md).

Deterministic. No model, no network, no lexicon, no existing translation.

WHAT THIS DOES AND DOES NOT DO
------------------------------
The engine of the method is Rule 4 — *the frame decides the sense*. Grouping every
occurrence of a word by what follows it is exact, cheap and needs no linguistic
model. That part is fully trustworthy and is where the meaning actually comes from.

Grouping words into roots is the hard part. A first version of this file derived
roots by stripping affixes and dropping weak letters. It over-grouped badly — it
put ريب (doubt), قريب (near) and أربع (four) in with رب, and أموالكم with ملك. So
independent derivation is dropped: correct root extraction from unvocalised Arabic
is a research problem, not a heuristic.

What happens instead, and it is stricter than either alternative:

  * roots come from the corpus's morphology (Leeds QAC) — declared, not hidden
  * an independent consonantal family is computed for the same word
  * where the two DISAGREE, the pack says so loudly

That disagreement list is the valuable output. It is exactly the صل case, where one
consonantal skeleton spanned six unrelated roots, and the عرب case, where a literal
substring search missed أعراب because an alif sits between ر and ب. A human reads
the disagreements and decides; nothing is grouped silently.

Rule 1 consequence: because the root tags are an outside source, every rendering
that depends on a grouping must be marked as resting on it.

Usage:
    python -m pipeline.frames --surah 1
    python -m pipeline.frames --root "ر ح م"
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ARTIFACTS = Path(__file__).resolve().parents[1] / "out"

WEAK = "اوىي"

# Words marking opposition or exclusion: where one sits beside a term the text may
# be defining it by contrast, which after a self-gloss is the strongest evidence.
CONTRAST = {"غير", "ولا", "لا", "أم", "بل", "أو", "دون"}


def latest_version() -> str:
    return sorted(p.name[1:] for p in ARTIFACTS.iterdir() if p.name.startswith("v"))[-1]


def load_tokens(version: str) -> list[dict]:
    path = ARTIFACTS / f"v{version}" / "tokens.jsonl"
    return [json.loads(line) for line in path.open(encoding="utf-8")]


def radicals(root: str | None) -> str:
    return "".join(root.split()) if root else ""


def consonantal_family(core: str, tokens: list[dict]) -> set[str]:
    """Surface forms whose letters contain the radicals in order.

    Weak letters and long vowels may intervene — the omission that made a search
    for عرب miss أعراب. Deliberately permissive: it is a net for collisions, not
    a root deriver.
    """
    if len(core) < 2:
        return set()
    gap = f"[{WEAK}]*"
    pat = re.compile(gap.join(re.escape(c) for c in core))
    return {t["text_no_tashkeel"] for t in tokens if pat.search(t["text_no_tashkeel"])}


def pack(root: str, tokens: list[dict], by_verse: dict) -> dict:
    """Everything admissible about one root."""
    hits = [t for t in tokens if (t.get("morphology") or {}).get("root") == root]
    core = radicals(root)

    forms = Counter(t["text_no_tashkeel"] for t in hits)
    frames: dict[str, list[str]] = defaultdict(list)
    contrasts: list[str] = []
    lemmas = Counter()

    for t in hits:
        m = t.get("morphology") or {}
        lemmas[(m.get("lemma"), m.get("pos"))] += 1
        verse = by_verse[(t["surah"], t["slot"])]
        i = t["position"] - 1
        nxt = verse[i + 1]["text_no_tashkeel"] if i + 1 < len(verse) else "—"
        prv = verse[i - 1]["text_no_tashkeel"] if i > 0 else "—"
        ref = f"{t['surah']}:{t['slot']}"
        frames[nxt].append(ref)
        if prv in CONTRAST or nxt in CONTRAST:
            contrasts.append(f"{ref}  {prv} · [{t['text_no_tashkeel']}] · {nxt}")

    # Forms that share the consonants but are tagged to a DIFFERENT root: the
    # collision set a human must rule on.
    family = consonantal_family(core, tokens)
    other = {t["text_no_tashkeel"] for t in tokens
             if t["text_no_tashkeel"] in family
             and (t.get("morphology") or {}).get("root") not in (root, None)}

    return {
        "root": root,
        "tokens": len(hits),
        "forms": forms.most_common(),
        "lemmas": lemmas.most_common(),
        "frames": sorted(frames.items(), key=lambda kv: -len(kv[1])),
        "contrasts": contrasts[:10],
        "collisions": sorted(other)[:14],
    }


def render(p: dict) -> None:
    print("=" * 66)
    print(f"ROOT {p['root']}    {p['tokens']} tokens")
    print("  forms   : " + ", ".join(f"{f}×{n}" for f, n in p["forms"][:9]))
    print("  senses  : " + ", ".join(f"{l}({pos})×{n}" for (l, pos), n in p["lemmas"][:6]))
    print("  frames  :")
    for nxt, refs in p["frames"][:6]:
        print(f"     + {nxt:<14} ×{len(refs):<4} {', '.join(refs[:5])}")
    if p["contrasts"]:
        print("  contrast (defining by opposition?):")
        for c in p["contrasts"][:3]:
            print(f"     {c}")
    if p["collisions"]:
        print("  ⚠ same letters, different root — rule on these:")
        print("     " + ", ".join(p["collisions"]))
    print()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--surah", type=int)
    ap.add_argument("--root", type=str, help='radicals, e.g. "ر ح م"')
    ap.add_argument("--version", default=None)
    args = ap.parse_args()

    version = args.version or latest_version()
    tokens = load_tokens(version)

    by_verse: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for t in tokens:
        by_verse[(t["surah"], t["slot"])].append(t)
    for v in by_verse.values():
        v.sort(key=lambda t: t["position"])

    if args.root:
        roots = [args.root if " " in args.root else " ".join(args.root)]
    else:
        roots, seen = [], set()
        rootless = []
        for t in tokens:
            if t["surah"] != args.surah:
                continue
            r = (t.get("morphology") or {}).get("root")
            if r and r not in seen:
                seen.add(r)
                roots.append(r)
            elif not r:
                rootless.append(t["text_no_tashkeel"])
        print(f"corpus v{version}")
        print(f"surah {args.surah}: {len(roots)} distinct roots to decide")
        print("rootless words (particles/pronouns — decided as a closed list): "
              + ", ".join(dict.fromkeys(rootless)) + "\n")

    for r in roots:
        render(pack(r, tokens, by_verse))


if __name__ == "__main__":
    main()
