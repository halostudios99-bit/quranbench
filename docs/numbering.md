# Verse numbering

## The short version

There is more than one way to count the verses of the Quran. The text is the
same everywhere — the same words in the same order — but different scholarly
traditions draw the boundaries between verses in slightly different places, and
so arrive at slightly different verse totals. The best known total, 6,236, is one
count among several.

quranbench does not pick a side and bake it into the data. Instead it treats
**which count you are using as an explicit setting**, recorded alongside every
result. Change the setting and the verse numbers change; the text never does.

## What a numbering scheme is

A *numbering scheme* is a set of rules for assigning ordinal numbers — verse 1,
verse 2, verse 3 — to the segments of a surah. Two schemes can agree completely
on the text and still disagree on:

- **Where one verse ends and the next begins.** A long verse in one tradition may
  be two shorter verses in another.
- **Whether the opening _bismillāh_ counts as a verse.** In most surahs the
  _basmala_ (“In the name of God, the Most Gracious, the Most Merciful”) stands
  at the head of the surah. Some traditions count it as verse 1; most do not. This
  single question is one of the main reasons the traditional counts differ at all.

Because these disagreements are real and old, quranbench refuses to hard-code an
answer. Numbering is a *parameter* — a knob you can see and set — not a fact
buried in the data.

## Why numbering is a parameter, not a fact

Every word in this corpus has a permanent address, and those addresses must never
quietly change their meaning. If we numbered the separated _basmala_ as “verse 0”
we would be asserting it is *not* a verse; if we numbered it “verse 1” we would be
asserting the opposite. Either choice smuggles a contested theological position
into an identifier that is supposed to be neutral and permanent.

So the separated _basmala_ is addressed by a **name**, not a number:

```
quran:tanzil-uthmani:2:basmala:1
```

— the first word of the _basmala_ that opens surah 2. The address says *where the
word is*, not *which verse it is*. Whether it is a verse, and which number it
takes, is left to each numbering scheme to answer as data. Ordinary verses keep
their familiar numeric addresses (`quran:tanzil-uthmani:2:43`), and the ordinal
they carry is recorded as an attribute of the verse, per scheme.

## The default scheme: Kūfan

The default — and, for now, the only — scheme is **Kūfan**.

The Kūfan count is the one you almost certainly already know: 6,236 verses. It
corresponds to the Ḥafṣ ʿan ʿĀṣim reading, which is the reading of the standard
Uthmani text this corpus is built from and of the overwhelming majority of
printed Qurans in circulation today. Choosing it as the default is not a claim
that it is more correct than the others; it is simply the count that matches the
text edition we ingested, so it is the count under which our data is internally
consistent.

Under the Kūfan scheme:

- ordinary verses are numbered 1…N within each surah, in reading order;
- a separated surah-opening _basmala_ receives **no** number (it is present and
  addressable, but it is not counted as a verse);
- in surah 1 (al-Fātiḥa) the _basmala_ is verse 1 and is counted like any other
  verse — that is the Kūfan position, and it is why al-Fātiḥa has 7 verses.

## What we deliberately have _not_ done

Other traditions — the Makkan, Madīnan, Baṣran, Damascene and Ḥimṣī counts — draw
some verse boundaries differently. We have **not** implemented them, and we will
not invent them. Doing so responsibly requires primary sources that specify each
tradition’s divisions precisely, and we do not yet have those sources. Shipping a
guessed-at count would be worse than shipping none: it would put an
unverifiable number under a respected name. When a sourced tradition is added, it
will reproduce here exactly, with its citation attached.

## How a new scheme would be contributed

A numbering scheme is **data, not code**. Adding one does not mean changing the
software; it means supplying a small data file describing the tradition and its
rules. Each scheme records:

- an **id** and **name** (e.g. `kufan`, “Kūfan”);
- a **source citation** — where this tradition’s verse divisions are documented;
- the **rules** by which it numbers segments (in reading order, restarting at each
  surah, and which kinds of segment it counts as verses).

The same generic mechanism then applies those rules to the corpus and records the
resulting verse total. A contributor supplies the tradition and its evidence; the
platform supplies the counting. Every scheme that is added lives beside the
others, and any result can state which one produced it — so a reader can always
reproduce the number, or switch schemes and watch it change.

## Where this lives in the data

- `numbering/kufan.json` — the Kūfan scheme as a data file.
- `numbering/numbering.schema.json` — the shape every scheme file must take.
- `manifest.json` → `numbering` — which schemes are available, which was active
  for the build, and the verse total each produces.
- Each verse record carries an `ordinals` map, e.g. `{"kufan": 43}` — the verse’s
  number under each scheme that counts it. The verse’s stable identity is its
  surah and segment slot; the ordinal is an attribute.
