# Backups

The corpus is reproducible from build artifacts and needs no backup — it is
immutable and versioned. What is irreplaceable is the **application database**:
accounts, investigations, revisions, responses, reports. This is the only state
that cannot be rebuilt, so it is the only thing to back up.

## Scripts

- `scripts/backup.sh` — `pg_dump` → gzip → `.sql.gz`, with a `.sha256` sidecar,
  written to `BACKUP_DIR`.
- `scripts/restore.sh` — verifies the checksum, then restores a dump into a target
  database. Refuses to restore a dump whose checksum does not match.
- `scripts/backup-restore-test.sh` — seeds a scratch database, backs it up, restores
  into a second scratch database, and asserts every table's row count matches. This
  is the proof that a backup is actually restorable, run in CI and easy to run by
  hand.

All three are plain-SQL based, so a backup can be opened and read with nothing but
`gunzip` and a text editor — no proprietary format, no tool-version lock-in.

## Taking a backup

Against the production compose Postgres:

```bash
docker compose -f docker/compose.prod.yaml exec -T postgres \
  pg_dump --no-owner --no-privileges -U quranbench quranbench \
  | gzip -9 > /var/backups/quranbench/quranbench-$(date -u +%Y%m%dT%H%M%SZ).sql.gz
```

Or, if the Postgres client tools are on the host and it can reach the database,
use the script directly:

```bash
DATABASE_URL="postgres://quranbench:PASS@localhost:5432/quranbench" \
  BACKUP_DIR=/var/backups/quranbench \
  ./scripts/backup.sh
```

## Restoring

Restore into an **empty** database (a plain dump layers objects onto whatever is
there). For a full recovery, create a fresh database, then:

```bash
DATABASE_URL="postgres://quranbench:PASS@localhost:5432/quranbench_restore" \
  ./scripts/restore.sh /var/backups/quranbench/quranbench-20260726T000000Z.sql.gz
```

The script verifies the `.sha256` sidecar before applying anything and stops on the
first SQL error (`ON_ERROR_STOP`), so a truncated or corrupt dump fails loudly
instead of restoring a partial database.

## Verifying restorability

Never trust a backup you have not restored. Run the round-trip test against any
Postgres you can create databases on (it makes and drops its own throwaway ones):

```bash
PGHOST=localhost PGPORT=5432 PGUSER=quranbench PGPASSWORD=quranbench \
  ./scripts/backup-restore-test.sh
```

It prints `PASS` only when the restored database has exactly the same row count as
the source in every seeded table.

## Schedule

Run `backup.sh` on a cron, keeping a rolling window plus periodic long-term copies:

```cron
# Daily at 03:15 UTC. Keep the last 14 daily dumps; keep monthly dumps forever.
15 3 * * *  DATABASE_URL="postgres://quranbench:PASS@localhost:5432/quranbench" BACKUP_DIR=/var/backups/quranbench /path/to/quranbench/scripts/backup.sh >> /var/log/quranbench-backup.log 2>&1
# Weekly: prune daily dumps older than 14 days (monthly copies live elsewhere).
30 3 * * 0  find /var/backups/quranbench -name 'quranbench-*.sql.gz' -mtime +14 -delete
```

Recommended cadence for a low-write research site:

- **Daily** automated dump, 14-day retention.
- **Before every deploy that includes a database migration** — take a manual dump
  first, since `prisma migrate deploy` only rolls forward (see `docs/deployment.md`).
- **Monthly** copy pushed off the VPS (object storage or another machine). A backup
  that only exists on the server it protects is not a backup.

Restore-test at least monthly, or after any change to the schema or these scripts.
