#!/usr/bin/env bash
#
# Prove the newest production backup is actually restorable — not merely that a
# file exists and its checksum matches.
#
# Restores the latest dump into a throwaway database, compares every table's row
# count against the live database, and removes the throwaway afterwards. It only
# ever creates and removes its own scratch database (qb_verify_<pid>); the live
# `quranbench`, `postgres` and `lwa_dev` databases are read-only to it.
#
# Run on the server as a user who can reach Postgres as a superuser:
#   sudo -u postgres bash /var/www/quranbench/scripts/verify-latest-backup.sh
#
# Exit 0 and prints PASS on success.
#
set -uo pipefail

BACKUP_DIR=${BACKUP_DIR:-/var/backups/quranbench}
LIVE_DB=${LIVE_DB:-quranbench}
SCRATCH="qb_verify_$$"

psql_q() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

cleanup() {
  psql -X -q -d postgres -c "DROP DATABASE IF EXISTS \"$SCRATCH\";" >/dev/null 2>&1
}
trap cleanup EXIT

dump=$(ls -1t "$BACKUP_DIR"/quranbench-*.sql.gz 2>/dev/null | head -1)
[ -n "$dump" ] || { echo "FAIL: no backup found in $BACKUP_DIR"; exit 1; }
echo "Verifying: $dump"

if ! ( cd "$BACKUP_DIR" && sha256sum -c "$(basename "$dump").sha256" >/dev/null 2>&1 ); then
  echo "FAIL: checksum does not match — the file is damaged"
  exit 1
fi
echo "Checksum OK"

psql_q -d postgres -c "CREATE DATABASE \"$SCRATCH\";" >/dev/null || {
  echo "FAIL: could not create scratch database"; exit 1; }

if ! zcat "$dump" | psql -X -q -v ON_ERROR_STOP=1 -d "$SCRATCH" >/tmp/qb-verify-restore.log 2>&1; then
  echo "FAIL: restore reported an error"
  tail -5 /tmp/qb-verify-restore.log
  exit 1
fi
echo "Restored without error"

tables=$(psql -X -tA -d "$LIVE_DB" -c \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")
[ -n "$tables" ] || { echo "FAIL: live database reports no tables"; exit 1; }

fail=0
checked=0
for t in $tables; do
  a=$(psql -X -tA -d "$LIVE_DB"  -c "SELECT count(*) FROM \"$t\";" 2>/dev/null)
  b=$(psql -X -tA -d "$SCRATCH"  -c "SELECT count(*) FROM \"$t\";" 2>/dev/null)
  if [ -z "$b" ]; then
    echo "  $t: MISSING from the restored database"; fail=1; continue
  fi
  if [ "$a" != "$b" ]; then
    echo "  $t: MISMATCH live=$a restored=$b"; fail=1; continue
  fi
  checked=$((checked + 1))
done

if [ "$fail" -ne 0 ]; then
  echo "FAIL: the backup does not reproduce the live database"
  exit 1
fi

echo "PASS: $checked tables restored with identical row counts"
