# Extensibility foundation

The ambition is for quranbench to become citable infrastructure — the place other sites, researchers and AI systems point at. That is not achieved by adding features. It is achieved by having a small number of properties from the first commit.

This document lists what must be **true now** so that expansion is possible **later**, and — equally important — what must **not** be built now.

---

## 1. The five properties of citable infrastructure

1. **Stable identifiers that never break.** A URL or ID published today resolves in ten years, or resolves to an explicit successor. Nothing else on this list matters if this fails.
2. **Open licence, declared before the first contribution.**
3. **Machine-readable structure** alongside every human page.
4. **Versioned, reproducible data** — a citation names a version, not "the current site."
5. **Provenance on every assertion** — who said it, computed how, from what source.

Everything below serves one of these.

---

## 2. Contributor licensing — decide before launch

**This is the one that becomes impossible to fix later.**

The moment a community member contributes an annotation, a translation correction, or a response, they own copyright in it. Without agreed terms up front, the project cannot later relicense, redistribute, or publish that data openly — and there is no practical way to re-contact thousands of contributors to ask.

Required before any user-generated content is accepted:

- **Contributor terms** at signup: contributions licensed to the project under CC BY-SA 4.0 (or CC0 for factual annotations), with an irrevocable grant permitting redistribution as part of the open dataset.
- **Attribution model** stated: how contributors are credited in dataset exports.
- **Editorial data** (the author's own investigations) may carry a different licence from **corpus data** (tokens, morphology) and **community data**. State each separately.
- Corpus data licence must be compatible with its upstreams — Tanzil is CC BY, the Leeds corpus is GPL. Copyleft obligations propagate.

Get this reviewed by someone qualified. It is cheap now and unfixable later.

---

## 3. Generic entity model — build now, use for Quran only

Do **not** model the domain as "Quran tokens." Model it generically and instantiate it with the Quran. The cost now is small; the cost of retrofitting after 77,430 tokens and thousands of annotations exist is a rewrite.

```
Source        A text tradition or edition. Tanzil Uthmani; Pickthall 1930.
              Has: licence, publisher, year, checksum.

Work          A structured text within a source. The Quran.
              Later: a hadith collection, a historical document.

Segment       An addressable unit. A verse.
              Later: a hadith matn, a paragraph.

Token         An addressable atom within a segment. A word.

Annotation    A typed assertion attached to a Token or Segment span.
              Has: type, value, actor, provenance, confidence, created_at.

Actor         Who made an assertion: pipeline / external dataset /
              editorial / community member.

Claim         A falsifiable statement citing Segments and Tokens as evidence.
```

Consequences:

- Adding a hadith corpus later is a new `Source` and `Work`, not a schema migration.
- Morphology, community notes and editorial highlights are all `Annotation` rows differing only by `type` and `actor`. The provenance tags in the UI read directly off `actor`.
- A `Claim` can cite evidence across works. This is what makes "hadith X contradicts Quran Y" expressible as structured data rather than prose — but the capability exists without any hadith data being present.

**Build the model. Populate only the Quran.**

---

## 4. Identifier policy

- Identifiers are opaque and permanent. Position in verse is an *attribute*, never the identity.
- Every identifier carries the segmentation scheme it belongs to: `quran:tanzil-uthmani:2:43:4`.
- Corpus versions are semver, immutable once published. Corrections ship a new version.
- Every release publishes a **mapping table** from the previous version's identifiers. A token that split, merged or moved has an explicit successor or an explicit tombstone.
- URLs never break. Retired URLs 301 to their successor or return 410 with an explanation — never 404, never silently reused.
- Publish an identifier policy page. Other people's citations depend on it, and saying it publicly is what makes it a commitment.

---

## 5. API-first

The web application consumes the same public API that third parties do. No private endpoints that return richer data.

If the app has a shortcut the API lacks, the API is second-class and will stay broken — this is the most common way a public API dies. One surface, one contract.

- Versioned: `/api/v1/`
- OpenAPI schema published and generated from the implementation, not written by hand
- Content negotiation: every corpus page serves JSON-LD alongside HTML at the same URL
- Rate limits generous and published; no key required for read access

---

## 6. Machine readability

Every corpus page emits structured data as well as prose:

- JSON-LD on word, root, verse and investigation pages
- `Dataset` structured data on download pages, with licence, version and checksum
- A `/.well-known/` descriptor pointing at the API, dataset index and identifier policy
- Full dataset downloads with checksums and a citation string (`How to cite this version`)
- `robots.txt` explicitly welcoming AI crawlers

The MCP server is a thin wrapper over the public API. It is not a separate integration — if it needs anything the API lacks, add it to the API.

---

## 7. Discussion at scale

"Discussion base" is a moderation problem long before it is a software problem. Volunteer projects die of moderation load, not of missing features.

Design decisions that reduce it, all cheap now:

- **Responses are structured, not free-form comments.** A response declares a type — disputes, supports, clarifies, adds evidence — and must cite evidence. This alone removes most low-quality contribution.
- **Discussion attaches to claims, never to people.** Already decided; it also makes threads durable and searchable.
- **Verified, persistent, pseudonymous identity.** Reputation accrues; abuse is traceable.
- **Rate limits from day one.** Trivial to add now, painful during an incident.
- **A written moderation policy published before the first user.** What is removed, by whom, with what appeal. Deciding this under pressure produces bad decisions and accusations of censorship.
- **Every moderation action logged and, where possible, publicly visible.** A platform that claims transparency cannot moderate opaquely.

---

## 8. What NOT to build now

Building these early is how the project fails to ship:

- Hadith corpus, isnad chains, transmitter data — a second database as large as the first. This is v3.
- Knowledge graph UI, 3D visualisation, force-directed graphs
- Plugin system
- Native mobile apps — the PWA covers this
- Real-time collaboration on investigations
- Personal research canvas with labelled relationships
- Audio recitation with word-level timing
- Federation or ActivityPub
- Anything with "AI" in its name beyond the MCP server

The entity model, identifier policy and contributor licence make all of these possible later. None of them should exist at launch.

---

## 9. Test of whether this is working

Before v1 ships, a stranger should be able to:

1. Cite a specific word in a specific corpus version, in a paper, with a stable URL
2. Download the whole dataset, with a licence permitting redistribution
3. Rebuild any published statistic from that dataset and get the same number
4. Query the API without registering
5. Point an AI system at it and get grounded, attributable answers

If all five hold, the project is infrastructure. If any fails, it is a website.
