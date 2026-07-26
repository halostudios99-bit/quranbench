# quranbench

An open Quran research workbench. Every Arabic word is a permanent, addressable research object.

> Do not accept our interpretation. Open the evidence, reproduce the search, and investigate the Quran yourself.

## Running it locally

### Prerequisites

Node 20+, pnpm 9+, Python 3.11+, and PostgreSQL 16.

On macOS:

```bash
brew install postgresql@16
brew services start postgresql@16
```

Docker is an alternative — `docker compose -f docker/compose.yaml up -d` — but a native Postgres works and is lighter.

### Setup

```bash
pnpm install

createdb quranbench

cd apps/web
cp .env.example .env
# edit DATABASE_URL to match your Postgres user, e.g.
#   postgresql://YOURUSER@localhost:5432/quranbench?schema=public

pnpm exec prisma migrate deploy
```

### Run

```bash
cd apps/web
pnpm build
pnpm start -p 3111
```

Open http://localhost:3111.

For development with hot reload, `pnpm dev` instead. The corpus loads and indexes once at server start — expect roughly two seconds before the first request is served.

### Seeding the archived articles

Eighteen articles from the owner's earlier site are seeded as **drafts**. None are published; the publish gate requires a claim, a reproducible query, and counter-evidence.

```bash
cd apps/web
DATABASE_URL="postgresql://YOURUSER@localhost:5432/quranbench?schema=public" \
  pnpm dlx tsx@4 scripts/seed-investigations.ts --commit
```

Use `--plan` first to see what it would do without writing.

### Tests

```bash
pnpm test        # packages: corpus, search, audit, mcp
pnpm test:all    # the above, plus web unit and Playwright e2e
```

The e2e suite needs a built app, a running Postgres, and Chromium (`pnpm exec playwright install chromium`).

### Rebuilding the corpus

```bash
cd packages/corpus-build
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m pipeline.build
python -m pipeline.verify out/v0.8.0
pytest
```

Artifacts are immutable once released. Corrections produce a new version.

The build fetches one **display-only** translation (Talal Itani's ClearQuran, CC BY-NC-ND 4.0). It is served to readers but, because it is not redistributable, is **never committed to this repository** (`translations/en-itani.*` is gitignored). If you have not fetched it, everything still builds and runs — the site simply shows one fewer translation. See `LICENSING.md`.

## Verifying the corpus

Anyone can confirm a published corpus is byte-for-byte what was built:

```bash
cd packages/corpus-build
python -m pipeline.verify out/v0.8.0
```

It re-hashes every artifact against the checksums in `manifest.json`, prints `OK` and exits 0 when everything matches, and exits non-zero naming the offending file otherwise.

## Layout

```
packages/corpus-build/   Python pipeline. Produces versioned corpus artifacts.
packages/corpus/         Typed loader for those artifacts.
packages/search/         In-memory index and query engine. Pure functions.
packages/audit/          Verifies claims in prose against the corpus.
packages/mcp/            MCP server over the public API.
apps/web/                Next.js application.
docs/                    Architecture, design system, licensing, method.
audit-reports/           Audit findings for the seeded articles.
```

## Where to start reading

- `CLAUDE.md` — the standing brief and the non-negotiable rules
- `docs/architecture.md` — the three-layer separation and why it exists
- `docs/state-of-the-project.md` — an honest review: what is built, what is fragile, what is next
- `LICENSING.md` — which licence covers which directory

## Licensing

Code is MIT. The corpus is not uniformly licensed and you must read `LICENSING.md` before redistributing:

| Part | Licence |
| --- | --- |
| Application code | MIT |
| Tanzil Quran text | CC BY 3.0 |
| Leeds morphology, and `tokens.jsonl` which embeds it | GPL-2.0-or-later |
| Translations shipped in the dataset | per edition, all public domain |
| Talal Itani / ClearQuran (display-only, fetched at build time, never committed) | CC BY-NC-ND 4.0 |
| Amiri fonts | SIL OFL 1.1 |
| Contributed content | CC BY-SA 4.0 |
