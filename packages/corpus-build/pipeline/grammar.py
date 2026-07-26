"""Turn a decision-table word into an inflected English word.

The table stores one base English word per key — "guide", "way", "favour". This
module attaches everything the Arabic marks morphologically: the definite
article, attached pronouns, plural, and verb person and tense. Without it the
renderer emits `guide way straight` where the Arabic says `guide us the straight
way`.

What it deliberately does NOT do is reorder words. Arabic word order is kept, so
the output reads stiffly and sometimes oddly. That is the honest behaviour for a
concordance rendering: reordering is interpretation, and it would hide which
English word came from which Arabic word. The reader can see the correspondence
one-to-one, which is the point.

Everything here reads the morphology segments already in the corpus. Those are an
outside source (Leeds QAC) and rendering therefore rests on them — recorded in
docs/translation-method.md, Rule 1.
"""

from __future__ import annotations

# Attached pronouns, by person·gender·number.
OBJECT = {
    ("1", None, "singular"): "me", ("1", None, "plural"): "us",
    ("2", "M", "singular"): "you", ("2", "F", "singular"): "you",
    ("2", "M", "plural"): "you", ("2", "F", "plural"): "you",
    ("2", None, "dual"): "you two",
    ("3", "M", "singular"): "him", ("3", "F", "singular"): "her",
    ("3", "M", "plural"): "them", ("3", "F", "plural"): "them",
    ("3", None, "dual"): "them two",
}
POSSESSIVE = {
    "me": "my", "us": "our", "you": "your", "you two": "your",
    "him": "his", "her": "her", "them": "their", "them two": "their",
}
SUBJECT = {
    ("1", "singular"): "I", ("1", "plural"): "We",
    ("2", "singular"): "you", ("2", "plural"): "you", ("2", "dual"): "you two",
    ("3", "singular"): "he", ("3", "plural"): "they", ("3", "dual"): "they two",
}

# English is irregular; the table may later carry explicit forms. Until then a
# small list covers the verbs that actually recur in the corpus.
# Third-person singular present, where adding -s is wrong.
PRESENT_3S = {
    "be": "is", "have": "has", "do": "does", "say": "says", "go": "goes",
    "is not": "is not",
}

# Past participles, where they differ from the simple past. Used by the passive.
PARTICIPLE = {
    "beget": "begotten", "give": "given", "take": "taken", "see": "seen",
    "know": "known", "do": "done", "make": "made", "say": "said",
    "send": "sent", "write": "written", "cast": "cast", "find": "found",
}

PAST = {
    "be": "was", "say": "said", "know": "knew", "create": "created",
    "beget": "begot", "give": "gave", "take": "took", "come": "came",
    "make": "made", "see": "saw", "find": "found", "send": "sent",
    "guide": "guided", "favour": "favoured", "trust in": "trusted in",
    "reject": "rejected", "serve": "served", "teach": "taught",
    "cover over": "covered over", "envy": "envied", "whisper": "whispered", "sink in": "sank in", "withdraw": "withdrew",
}
# Lemmas whose English already expresses the genitive link.
ABSORB_GENITIVE = {"غَيْر", "بَعْض", "كُلّ", "مِثْل", "أَهْل", "ذُو"}

PLURAL = {
    "one astray": "those astray", "one angered": "those angered",
    "one who leads astray": "those who lead astray", "envier": "enviers",
    "angel": "angels", "parent": "parents", "child": "children",
    "person": "people", "human": "humans", "sky": "skies", "way": "ways",
    "path": "paths", "day": "days", "chest": "chests", "knot": "knots",
    "child": "children", "one who trusts": "those who trust",
    "one who rejects": "those who reject", "beings": "beings",
    "people": "people", "chests": "chests", "knots": "knots",
}


def _pronoun(features: dict) -> str | None:
    p = features.get("person")
    g = features.get("gender")
    n = features.get("number", "singular")
    for key in ((p, g, n), (p, None, n)):
        if key in OBJECT:
            return OBJECT[key]
    return None


def _pluralise(word: str) -> str:
    if word in PLURAL:
        return PLURAL[word]
    if word.endswith(("s", "x", "ch", "sh")):
        return word + "es"
    if word.endswith("y") and word[-2:-1] not in "aeiou":
        return word[:-1] + "ies"
    return word + "s"


def _past(word: str) -> str:
    if word in PAST:
        return PAST[word]
    head, _, tail = word.partition(" ")
    if head in PAST:
        return (PAST[head] + " " + tail).strip()
    if head.endswith("e"):
        return (head + "d " + tail).strip()
    return (head + "ed " + tail).strip()


def _is_subject_marker(verb_feats: dict, suffix_feats: dict) -> bool:
    """Is this attached pronoun the verb's SUBJECT rather than its object?

    Arabic marks a perfect verb's subject with an attached pronoun — أَنْعَمْتَ is
    "you favoured", not "favoured you". The corpus tags that suffix PRON exactly
    like an object pronoun, so the two are told apart by agreement: when the
    suffix's person, gender and number match what the verb already carries, it is
    the subject and must not be emitted a second time.
    """
    if not verb_feats.get("person"):
        return False
    return all(
        suffix_feats.get(k) == verb_feats.get(k)
        for k in ("person", "number")
        if suffix_feats.get(k) is not None
    )


def compose(token: dict, english: str, previous: dict | None = None) -> str:
    """Inflect `english` according to what the Arabic marks.

    `previous` is the preceding token, needed only to detect a genitive
    construct: two nouns in sequence where the second is GEN means "X of Y".
    """
    m = token.get("morphology") or {}
    feats = m.get("features") or {}
    segs = m.get("segments") or []
    pos = m.get("pos")

    # Rootless words — particles, pronouns, prepositions with an attached
    # pronoun — are seeded whole and returned untouched. لَهُۥ is one indivisible
    # decision, "for him"; letting the layer add "for" from the ل prefix and
    # "him" from the ه suffix produced "for for him".
    if not m.get("root"):
        return english

    prefixes = [s for s in segs if s.get("type") == "prefix"]
    suffixes = [s for s in segs if s.get("type") == "suffix"]

    has_det = any(s.get("pos") == "DET" for s in prefixes)
    conj = next((s for s in prefixes if s.get("pos") == "CONJ"), None)
    prep = next((s for s in prefixes if s.get("pos") == "P"), None)
    pron_suffix = next((s for s in suffixes if s.get("pos") == "PRON"), None)

    out = english

    if pos == "V":
        tense = feats.get("tense")
        person = feats.get("person")
        number = feats.get("number", "singular")
        # 112:3 لم يلد ولم يولد — the second verb is passive. Without this both
        # render "he begets" and the verse says the opposite of what it says.
        if str(feats.get("voice", "")).lower().startswith("pass"):
            participle = PARTICIPLE.get(out) or _past(out)
            for pron in ("he ", "they ", "I ", "We ", "you "):
                if participle.startswith(pron):
                    participle = participle[len(pron):]
            be = "was" if tense == "PERF" else ("are" if number == "plural" else "is")
            out = f"{be} {participle}"
            if pron_suffix:
                sfeats = pron_suffix.get("features") or {}
                if not _is_subject_marker(feats, sfeats):
                    obj = _pronoun(sfeats)
                    if obj:
                        out = f"{out} {obj}"
            if conj:
                out = ("and " if (conj.get("lemma") or "") == "و" else "so ") + out
            return out
        if tense == "PERF":
            out = _past(out)
            subj = SUBJECT.get((person, number))
            if subj:
                out = f"{subj} {out}"
        elif tense == "IMPF":
            subj = SUBJECT.get((person, number))
            if number == "plural" or person in ("1", "2"):
                verb = out
            elif out in PRESENT_3S:
                verb = PRESENT_3S[out]
            else:
                verb = _pluralise(out)
            out = f"{subj} {verb}" if subj else verb
        # IMPV: bare stem, which is already the base form
        if pron_suffix:
            sfeats = pron_suffix.get("features") or {}
            if not _is_subject_marker(feats, sfeats):
                obj = _pronoun(sfeats)
                if obj:
                    out = f"{out} {obj}"
    else:
        # Only nouns pluralise. Relatives and particles carry a number feature
        # too, and pluralising them produced "those whoms".
        if pos == "N" and feats.get("number") == "plural" and not out.endswith("s"):
            out = _pluralise(out)
        if pron_suffix:
            obj = _pronoun(pron_suffix.get("features") or {})
            if obj:
                if pos == "P":            # عليهم — upon them
                    out = f"{out} {obj}"
                else:                      # ربه — his Sustainer
                    out = f"{POSSESSIVE.get(obj, obj)} {out}"
        elif has_det and not out.startswith("those "):
            out = f"the {out}"

    if prep:
        lemma = (prep.get("lemma") or "").strip()
        out = {"ب": "by", "ل": "for", "ك": "as"}.get(lemma, "") + " " + out
        out = out.strip()
    # Genitive construct: نoun + noun-in-GEN is "X of Y". Only when the second
    # noun carries no preposition or article of its own to explain the case.
    prev_m = (previous or {}).get("morphology") or {}
    prev_feats = prev_m.get("features") or {}
    if (
        previous is not None
        and pos == "N"
        and feats.get("case") == "GEN"
        and not feats.get("adjective")        # an adjective agrees, it is not possessed
        and not prev_feats.get("adjective")
        and not prep
        and not conj
        and prev_m.get("pos") == "N"
        # Some words already carry the relation in their English ("other than"),
        # so adding "of" doubles it.
        and (prev_m.get("lemma") not in ABSORB_GENITIVE)
    ):
        out = f"of {out}"

    if conj:
        out = ("and " if (conj.get("lemma") or "") == "و" else "so ") + out

    return out
