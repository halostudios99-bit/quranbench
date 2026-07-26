# Deployment

How to deploy quranbench to a fresh VPS, from nothing to a running site on HTTPS.
Written for the owner, not a DevOps engineer: every step is a command you can copy.
Nothing here has been run against a live server yet — the domain is not registered
and no server credentials exist — so treat the first deploy as the shakedown.

## What runs

Four containers, defined in `docker/compose.prod.yaml`:

| Container  | Image                          | Role                                             |
| ---------- | ------------------------------ | ------------------------------------------------ |
| `app`      | built from `docker/Dockerfile` | the Next.js server; the corpus is baked in       |
| `postgres` | `postgres:16-alpine`           | application database (accounts, investigations…) |
| `redis`    | `redis:7-alpine`               | shared rate-limit store across replicas          |
| `caddy`    | `caddy:2-alpine`               | reverse proxy, automatic HTTPS                   |

A fifth service, `migrate`, runs `prisma migrate deploy` once and exits; `app`
waits for it to finish before starting.

The corpus is **not** a volume or a download — it is copied into the image at build
time (`docker/Dockerfile`). A given image tag therefore serves exactly one corpus
version, which is the reproducibility guarantee: the container is the version.

## Prerequisites

- A VPS (the target is the existing Oracle instance) running Linux with Docker
  Engine and the Compose plugin. Install: <https://docs.docker.com/engine/install/>.
- A domain pointed at the server: an `A` record (and `AAAA` for IPv6) for the apex
  and/or `www` pointing at the VPS public IP. Caddy needs this resolvable before it
  can issue a certificate.
- Ports **80** and **443** open to the world (Caddy needs 80 for the ACME
  HTTP-01 challenge and 443 to serve). On Oracle Cloud, open them in both the
  security list and the host firewall (`iptables`/`firewalld`).

## First deploy

```bash
# 1. Get the code onto the server
git clone <repo-url> quranbench && cd quranbench

# 2. Configure secrets and the domain
cp docker/.env.prod.example docker/.env
$EDITOR docker/.env          # set POSTGRES_PASSWORD, SITE_DOMAIN, TLS_EMAIL,
                             # NEXT_PUBLIC_SITE_URL, and optionally SMTP_*

# 3. Build and start everything
docker compose -f docker/compose.prod.yaml --env-file docker/.env up -d --build
```

That single `up` builds the image (installing dependencies, generating the Prisma
client, building the standalone server, baking the corpus), starts Postgres and
Redis, runs the migrations, then starts the app and Caddy. Caddy obtains a
Let's Encrypt certificate for `SITE_DOMAIN` automatically on first request.

Watch it come up:

```bash
docker compose -f docker/compose.prod.yaml logs -f app caddy
```

The app is healthy when `GET /api/health` returns `{"status":"ok", ...}` with the
expected `corpus_version`. Caddy proxies only to a healthy app.

## Required environment variables

Set in `docker/.env` (see `docker/.env.prod.example` for the annotated template):

| Variable                          | Required | Purpose                                                                                     |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`               | yes      | Postgres superuser password; also builds `DATABASE_URL`                                     |
| `SITE_DOMAIN`                     | yes      | domain Caddy issues a certificate for                                                       |
| `TLS_EMAIL`                       | yes      | ACME contact address                                                                        |
| `NEXT_PUBLIC_SITE_URL`            | yes      | absolute origin for canonical/share URLs (`https://…`)                                      |
| `POSTGRES_USER`, `POSTGRES_DB`    | no       | default to `quranbench`                                                                     |
| `MAILER`, `SMTP_URL`, `MAIL_FROM` | no       | real email; without them verification/reset links are logged to the app container, not sent |

The app receives `DATABASE_URL` and `REDIS_URL` from compose (built from the above);
you do not set them by hand. `REDIS_URL` points at the `redis` service, which makes
the signup/publish/reset rate limits hold across every replica. Without Redis the
app falls back to a per-process limiter — correct for one container, not for several.

## Running migrations

Migrations run automatically on every `up` via the `migrate` service. To run them
by hand (e.g. after pulling a release without restarting the app):

```bash
docker compose -f docker/compose.prod.yaml --env-file docker/.env run --rm migrate
```

`prisma migrate deploy` only applies committed migrations and never resets data.

## Updating to a new release

```bash
git pull
docker compose -f docker/compose.prod.yaml --env-file docker/.env up -d --build
```

Compose rebuilds the image (new corpus version and/or code), reruns `migrate`, and
restarts `app` with the new image. Postgres, Redis and the Caddy certificates
persist in named volumes across the update.

## Rolling back

The image is the unit of rollback. Because the corpus is baked in, rolling back the
code rolls back the served corpus version too.

```bash
# Roll the code back to a known-good commit and rebuild.
git checkout <previous-good-commit>
docker compose -f docker/compose.prod.yaml --env-file docker/.env up -d --build
```

Caveat on database migrations: `migrate deploy` only rolls _forward_. If a release
added a migration that a rollback cannot tolerate, restore the database from a
backup taken before the deploy (see `docs/backups.md`) as part of the rollback.
For that reason, **take a backup immediately before any deploy that includes a
migration** — the backup script prints the row counts so you can confirm it.

Tag images per release if you want instant rollback without a rebuild:

```bash
docker compose -f docker/compose.prod.yaml build
docker tag quranbench-app:latest quranbench-app:$(git rev-parse --short HEAD)
```

## Operational notes

- **Logs:** `docker compose -f docker/compose.prod.yaml logs -f app`. Verification
  and password-reset links appear here when no SMTP is configured. The SMTP path
  never logs the link.
- **Backups:** see `docs/backups.md`. Schedule `scripts/backup.sh` via cron.
- **Health:** `curl -fsS https://$SITE_DOMAIN/api/health`.
- **Boot time:** the app loads and checksum-verifies the corpus at startup
  (~7 s). The healthcheck `start-period` accounts for this; a container is not
  marked unhealthy during the initial load.
- **Resources:** the retained in-memory index is ~120 MB per app process. Size the
  VPS with headroom above that plus Postgres and Redis.
