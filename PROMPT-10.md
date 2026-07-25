# Prompt 10 — database, accounts, investigations

Read `CLAUDE.md`, `docs/architecture.md`, `docs/extensibility.md` and `docs/design-system.md` first.

This adds the application layer. Corpus and search remain untouched and must stay free of any database dependency — assert this with a test that `packages/search` imports nothing from Prisma or the app.

## Database

Postgres via Prisma, in `apps/web/src/server`. Docker Compose service for local Postgres in `docker/`.

Schema follows the entity model in `docs/extensibility.md`. Model generically; populate for the Quran only.

Core tables: `User`, `Session`, `Investigation`, `InvestigationRevision`, `EvidencePin`, `Response`, `Annotation`, `Collection`, `SavedSearch`.

- `EvidencePin` stores **token ids and a corpus version**, never copied Arabic text.
- Every mutable record carries created/updated timestamps and an author.
- Revisions are append-only. Nothing is destructively edited.

## Accounts

Per `docs/extensibility.md`: pseudonymous but persistent.

- Email + verification. Stable public handle. Real name optional.
- No OAuth providers in this prompt.
- Sessions httpOnly, secure, sameSite.
- **Contributor terms accepted at signup**, recorded with version and timestamp: contributions licensed CC BY-SA 4.0 with an irrevocable grant permitting redistribution in the open dataset. Write the terms text into `docs/contributor-terms.md` and render it at `/terms/contributor`. A user cannot create content without a recorded acceptance — enforce in the data layer, not the UI.

## Investigations

Routes under `/investigations`. Fixed structure per the architecture doc: claim, evidence, query, counter-evidence, responses, status, byline, revision history.

- Claim is one sentence, required, length-limited.
- Evidence pins resolve through the corpus by token id; if a pin cannot resolve against the current corpus version, flag the investigation for review rather than failing or silently dropping it.
- **Publish gate**: the attached query must parse, execute, and return a non-empty result before publication is permitted. Reject publication with a clear message otherwise. This is a data-layer rule, not a form validation.
- Counter-evidence is a required field. An investigation cannot be published with it empty.
- Responses are typed — disputes / supports / clarifies / adds evidence — and must cite evidence.
- Status: open / contested / revised / withdrawn. Revision history public.
- Editorial content carries the editorial `<ProvenanceTag>`; community content the community tag. Never the Quranic tag.

## Bidirectional linking

Word and root pages list the investigations citing them. This is the discovery mechanism — someone researching a word finds the argument through the evidence.

Query it efficiently; do not scan all investigations per page render.

## Rate limiting and moderation basics

- Rate limits on account creation, publication and responses.
- A report action on investigations and responses, writing to a moderation queue table.
- No moderation UI in this prompt — the queue and the data model only.

## Tests

- `packages/search` has no database import — assert by static check
- A user without recorded contributor-terms acceptance cannot create an investigation
- Publishing fails when the query returns nothing, when counter-evidence is empty, or when the claim is missing
- Publishing succeeds with a valid claim, evidence, query and counter-evidence
- An evidence pin against an older corpus version resolves or flags, never silently drops
- Revisions are append-only — an update creates a revision and does not overwrite
- Word and root pages show citing investigations
- Responses require a type and evidence
- No-JS rendering and axe on investigation pages

## Report back

Schema summary, how the publish gate is enforced at the data layer, how bidirectional linking is queried, rate limits chosen, and anything you could not enforce below the UI.
