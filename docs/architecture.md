# Architecture

## Principle

Three layers, strictly separated:

1. **Corpus** — immutable, versioned, built offline. Never written to at runtime.
2. **Search** — pure computation over the corpus. No state, no I/O.
3. **Application** — users, investigations, payments. Mutable, in Postgres.

Layer 3 may read from 1 and 2. Layers 1 and 2 know nothing about layer 3. This is what makes results reproducible: a query run by an anonymous visitor and a query run inside a published investigation execute identical code against identical data.

## Repository layout

```
quranbench/
  CLAUDE.md
  docs/
    architecture.md
    corpus-spec.md
    token-ids.md
    search-semantics.md
  packages/
    corpus-build/          Python. Offline pipeline.
      sources/             Raw downloads. Gitignored, checksummed.
      pipeline/            Ingest, normalise, segment, annotate.
      out/                 Versioned artifacts. Committed.
    corpus/                TypeScript. Loads and types artifacts.
    search/                TypeScript. In-memory index + query engine.
  apps/
    web/                   Next.js App Router.
      src/app/             Routes.
      src/components/      UI. Provenance-tagged primitives live here.
      src/payments/        Stripe. Isolated module.
      src/server/          Prisma, auth, server actions.
  docker/
```

## Corpus artifacts

The Python pipeline outputs a versioned, checksummed directory:

```
out/v0.1.0/
  tokens.jsonl        one record per token
  verses.jsonl
  surahs.json
  roots.json
  translations/       one file per translation edition
  manifest.json       version, checksums, source editions, build parameters
```

`manifest.json` records exactly which text edition, which morphology release, whether tashkeel was retained, and how prefixes were segmented. Every computed result displayed in the UI must be traceable to a manifest.

Artifacts are immutable once released. Corrections produce a new version.

## Search

Built at process boot by reading artifacts into typed in-memory structures:

- forward index: token id → token record
- inverted indices: normalised form → token ids; root → token ids; lemma → token ids
- positional data for proximity and adjacency queries

Everything is a pure function of `(index, query) → results`. No caching layer, no database, no network. Target: sub-10ms for any single query. Rebuild on deploy, never at request time.

## Application data

Postgres via Prisma. Owns: users, sessions, investigations, revisions, evidence pins, responses, annotations, collections, saved searches, donor records, sponsorships.

Evidence pins store **token IDs and a corpus version**, never copied Arabic text. An investigation pinned against corpus v0.1.0 must still resolve correctly after v0.2.0 ships — via the token ID mapping layer, or by flagging the investigation for review if a mapping cannot be resolved.

## Payments

`apps/web/src/payments/` is the only place Stripe is imported. It exposes a narrow interface to the rest of the app: create a donation session, record a completed donation, list a user's sponsorships.

Rules:

- No content query reads payment state, ever. Nothing is gated.
- Webhooks are idempotent, keyed on Stripe event id, with a processed-events table.
- Card data never touches our servers. Stripe Checkout or Elements only.
- Store the minimum: Stripe customer id, amount, currency, timestamp, designation.
- Donor badge is a derived boolean on the user profile. It is never joined into content queries.

Open question before integration: charity or CIC registration would enable Stripe nonprofit rates and UK Gift Aid, worth 25% on top of eligible donations. Decide the entity before wiring payments.

## Addressable units and the action surface

Every unit a user can point at is addressable, and every addressable unit renders through exactly one component that exposes a declared set of actions. New actions are added to a registry, never by editing render code.

### Addressable units

| Unit | Canonical URL | Identifier |
| --- | --- | --- |
| Surah | `/2` | `quran:2` |
| Verse | `/2/43` | `quran:2:43` |
| Verse range | `/2/43-45` | `quran:2:43-45` |
| Token | `/word/quran:tanzil-uthmani:2:43:4` | full token id |
| Root | `/root/z-k-w` | `root:ز ك و` |
| Investigation | `/investigations/<slug>` | `inv:<uuid>` |

Every one of these resolves server-rendered, has a canonical URL, and appears in a sitemap.

### One renderer per unit

`<Verse>` is the only component that renders a verse — in the reader, in search results, in an investigation's evidence panel, in a word page's occurrence list. Same for `<Token>` and `<RootSummary>`.

If verse markup is duplicated across surfaces, every future action must be added in every place, and they will drift. This is the single most important structural decision for the extensibility being asked for.

Each renderer accepts:

- the unit's identifier and corpus version
- a display mode (reading / compact / evidence / result)
- an actions list, defaulting to the registry's set for that unit type

### Action registry

Actions are declared once, in `apps/web/src/actions/registry.ts`, as data:

```
{ id, unitTypes, label, icon, handler, requiresAuth, showIn }
```

Adding "copy", "share", "cite", "bookmark", "report", "pin as evidence", "compare translations", "listen" is then a registry entry plus a handler. No component changes.

Ship at v1: copy, share, permalink, cite. Everything else slots in later at near-zero cost.

### Copy semantics

Copying is a provenance question, not a clipboard question. What lands in the user's paste buffer must remain traceable.

Copy offers, as explicit choices rather than a single default:

- Arabic only (Uthmani)
- Arabic without tashkeel
- Translation only, with translator and edition named
- Arabic + translation + reference
- Citation string including corpus version

Every option except "Arabic only" appends the reference and source. A quote that leaves the site should still say where it came from — a site arguing for verifiability cannot emit unattributed text.

Copy writes both `text/plain` and `text/html` to the clipboard so pasting into a rich editor preserves RTL direction and the reference line.

### Share

- Share resolves to the unit's canonical URL. Never a URL containing UI state.
- Per-unit Open Graph images generated at the edge (`ImageResponse`), showing the Arabic, the reference and the site mark. A shared verse should look considered in WhatsApp and X — this is a real acquisition channel, not decoration.
- Web Share API on mobile, falling back to copy-link.
- No share counts. They add nothing and invite gaming.

### Selection

Users will select spans of Arabic. Selection is anchored to token identifiers, not character offsets, so a selection remains valid across corpus versions and can later become an evidence pin, an annotation target, or a highlight. Build the anchoring now even though only copy consumes it at v1.

## Rendering

- Word, root, verse and investigation pages: statically generated where possible, ISR otherwise. Must be readable with JavaScript disabled.
- Search lab: server-rendered shell, client-side interaction against a route handler.
- ~77,430 word pages and ~1,600 root pages will make full static generation slow. Start with on-demand ISR and a persistent cache; measure before optimising.

## PWA

- Manifest with maskable icons, standalone display mode.
- Service worker caches the app shell and the corpus artifacts.
- Because the corpus is a few megabytes, full offline search is achievable. Treat it as a v1 goal, not a stretch goal.
- Never cache Postgres-backed content offline without an explicit user action.

## Deployment

Docker Compose on the existing Oracle VPS: Next.js, Postgres, Caddy. Caddy handles TLS automatically. Corpus artifacts baked into the image so a container is a reproducible unit of a specific corpus version.
