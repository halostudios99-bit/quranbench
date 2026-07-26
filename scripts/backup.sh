#!/usr/bin/env bash
#
# Dump the quranbench Postgres database, compress it, checksum it, and write it to
# a configured destination. Plain-SQL dump (gzipped) so a backup can be inspected
# and restored with nothing but psql. A .sha256 sidecar lets restore.sh prove the
# file is intact before trusting it.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/db BACKUP_DIR=/var/backups/quranbench ./scripts/backup.sh
#
# Against the compose stack, run pg_dump inside the container instead:
#   docker compose -f docker/compose.prod.yaml exec -T postgres \
#     pg_dump --no-owner --no-privileges -U quranbench quranbench | gzip -9 > backup.sql.gz
# (backup.sh is the host-side equivalent when pg client tools are installed.)

set -euo pipefail

DATABASE_URL="${DATABASE_URL:?set DATABASE_URL to the database to back up}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

command -v pg_dump >/dev/null || { echo "pg_dump not found (install postgresql-client)"; exit 1; }
command -v gzip >/dev/null || { echo "gzip not found"; exit 1; }

# Portable sha256: coreutils sha256sum on Linux, shasum -a 256 on macOS.
sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi
}

mkdir -p "$BACKUP_DIR"
ts="$(date -u +%Y%m%dT%H%M%SZ)"
dump="${BACKUP_DIR}/quranbench-${ts}.sql.gz"

echo "Dumping to ${dump} ..."
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 >"$dump"

# The sidecar records only the basename so `sha256sum -c` works from BACKUP_DIR.
( cd "$BACKUP_DIR" && sha256 "$(basename "$dump")" >"$(basename "$dump").sha256" )

bytes="$(wc -c <"$dump" | tr -d ' ')"
echo "Wrote ${dump} (${bytes} bytes)"
echo "Checksum: $(cat "${dump}.sha256")"
