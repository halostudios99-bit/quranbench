# Changelog

Notable changes to quranbench. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Corpus versions are tracked separately from application changes: the corpus has
its own version (currently 0.8.0), printed on every page and returned by
`/api/health`, and every artifact in it is checksummed.

## [Unreleased]

### Added

- **Persistent surah rail in the reader.** All 114 surahs beside the reading
  column on every reader surface, server-rendered as real links with the current
  surah marked. Desktop only: a 114-item list on a phone would either bury the
  first ayah or require a JavaScript drawer, and a drawer cannot be the only route
  to the surah list on a site where every page must work without JavaScript. The
  filter hides DOM items rather than serialising the surah list into the page a
  second time.
- **Reading settings as a slide-over panel**, replacing the control strip that sat
  above the text on every reader page.
- **Atomic, zero-downtime deploys** (`scripts/deploy-atomic.sh`). Builds alternate
  between `.next-a` and `.next-b` so the live process keeps serving while the idle
  slot is rebuilt. A failed build changes nothing; a failed health check rolls back.
- **Scheduled backups** (`scripts/backup-cron.sh`), nightly, checksum-verified,
  14 retained — plus a weekly job that restores the newest dump into a throwaway
  database and compares row counts (`scripts/verify-latest-backup.sh`).
- **Security headers**: Content-Security-Policy (including `frame-ancestors
  'none'`), X-Frame-Options, Referrer-Policy and Permissions-Policy.
- **Structured data on the homepage and surah pages** — `WebSite` with a
  `SearchAction`, `Organization`, `Dataset`, and `Chapter` for each surah. Word,
  root, gloss and data pages already had it.
- **`/sitemap.xml`** as a sitemap index over the sharded sitemaps. The shards were
  always declared in `robots.txt`, but the conventional path returned 404.
- Project files: `CITATION.cff`, `SECURITY.md`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, issue templates, and this changelog.

### Changed

- **The reader now shows one translation by default** (Pickthall) rather than
  every edition at once. Stacking all editions under each ayah buried the Arabic.
  An explicit "show all" is still honoured and is stored distinctly from "never
  chose", so no existing reader's choice was overridden.
- Search result pages are `noindex, follow` and canonicalise to `/search`. `?q=`
  is an unbounded URL space that was competing for crawl budget with 87,000
  permanent URLs.
- The homepage now declares a canonical.

### Fixed

- **Keyboard access to the contributor terms on `/signup`.** The scrollable terms
  box had no `tabindex`, so a keyboard-only user could not scroll it — they could
  not read the terms they were being asked to accept. Found by an axe sweep across
  84 page renders; it was the only violation.
- **The site-wide focus ring.** It overrode Tailwind's `outline-none` — giving the
  search field two nested green rings — and set `border-radius`, which squared off
  every rounded button and pill at the moment it received focus.
- **A ~300px layout collapse on every reader page.** The server rendered a tall
  preferences form that shrank to a small control on hydration. Both states are now
  the same height.
- **Colour contrast** on the selected translation row: 12px `ink3` on the accent
  background measured around 4:1, below the 4.5:1 minimum.
- `tsconfig.json` no longer gets rewritten by every alternate deploy; both build
  slots are declared up front.

### Known gaps

- No SMTP is configured in production, so account verification and password reset
  cannot complete.
- Backups are retained on the same host as the database; nothing is copied off-site.
- The MCP server exists as a package but is not hosted at a public endpoint.
- The public read API's rate limit is enforced per process, not globally.
- Largest Contentful Paint is 2.3–2.9s against a 1.8s budget, caused by
  render-blocking CSS.

## [0.8.0] — 2026-07-26

First public deployment at <https://quranbench.com>.

Corpus v0.8.0: 77,881 tokens, 6,236 verses, 1,651 roots, 27 artifacts, all
checksum-verified. Reader, ~78,000 word pages, 1,651 root pages, the search lab,
translation comparison, reverse gloss lookup, similar verses, root co-occurrence,
investigations with a publish gate, the public API and OpenAPI spec, `/data`,
`/method`, `/about`, `/colophon`, PWA, and 87,399 sitemap URLs.
