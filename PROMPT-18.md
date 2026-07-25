## Batch 5 and 6 — hardening and deployment readiness (workplan items 16–25)

Read `CLAUDE.md`, `docs/architecture.md` and `docs/state-of-the-project.md` first. Batches 1–4 are complete.

## Batch 5 — production hardening

### 16. Real mailer

Bind a real provider behind the existing `Mailer` interface. Choose one that works without a paid account for development and document the swap. Keep the console implementation as the default when no credentials are present, so local development is unaffected. Never log message bodies containing tokens.

### 17. Rate limiting to a shared store

Currently in-process, which is useless across replicas. Move to Redis, with the in-memory implementation retained behind the same interface for tests and single-process development. Add Redis to `docker/compose.yaml`. Fail closed on Redis unavailability for signup and publish; fail open for read paths.

### 18. argon2id instead of scrypt

Use argon2id with documented parameters. Migrate existing hashes transparently on next successful sign-in — do not invalidate anyone. Keep scrypt verification for legacy hashes.

### 19. Password reset

Token-based, single-use, short expiry, hashed at rest. Rate limited. Does not reveal whether an address exists. Invalidates all sessions on success.

### 20. CSRF

Double-submit token or the framework's equivalent on every state-changing route, in addition to sameSite. Cover sign-in, sign-up, publish, respond, report and account changes.

### 21. Backups

A script that dumps Postgres, compresses, checksums and writes to a configured destination. A restore script. A test that dumps a seeded database, restores into a scratch database, and asserts row counts match. Document the schedule to run it.

### 22. Error pages

Real 404 and 500 pages in the site's design, with useful navigation. The 404 should offer search. Never expose stack traces.

## Batch 6 — deployment readiness

### 23. Deployment configuration

Production Docker Compose: the Next.js app, Postgres, Redis and Caddy with automatic TLS. Multi-stage Dockerfile, non-root user, health checks, restart policies. Corpus artifacts baked into the image so a container is a reproducible unit of a specific corpus version.

Write `docs/deployment.md`: exactly how to deploy to a fresh VPS, what environment variables are required, how to run migrations, how to roll back. Assume the reader is the owner, not a DevOps engineer.

**Do not attempt to deploy.** No server credentials are available and the domain is not registered. Prepare everything so deployment is a single documented procedure.

### 24. Lighthouse CI

Wire into the pipeline with the budgets from `docs/design-system.md`. Fail on regression. If Chrome is unavailable in this environment, configure it correctly and document how to run it, rather than fabricating scores.

### 25. Zenodo mirror preparation

A script that packages a corpus version for Zenodo deposit — metadata, licences, checksums, a `CITATION.cff`, and a README describing the dataset for an outside researcher. Do not upload; no credentials. Document the manual steps.

This is what makes the data survive the project, which the extensibility doc calls the difference between infrastructure and a website.

## Final pass

Then re-run everything and rewrite `docs/state-of-the-project.md` from scratch to reflect reality: what is built, what is fragile, what is untested, what an outside reviewer would criticise first, and the ordered list of what remains. Be as honest as the previous version was — it found two real defects and that was its value.

## Tests

- Password reset: full flow, token single-use, expiry honoured, sessions invalidated
- argon2 hashes verify; legacy scrypt hashes still verify and are upgraded on sign-in
- CSRF rejects a forged POST on every state-changing route
- Rate limiting works against Redis and falls back correctly
- Backup then restore reproduces row counts exactly
- 404 and 500 render in the site design and leak no internals
- Production image builds and starts; health check passes
- Full suite green

## Report back

What is now genuinely production-ready and what is not. The single most important remaining risk. And an honest estimate of what a first deployment would still require from the owner.
