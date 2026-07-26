#!/usr/bin/env bash
#
# Proves the backup/restore round-trip is lossless: seed a source database, back it
# up with backup.sh, restore it into a fresh scratch database with restore.sh, and
# assert the row counts match exactly. Creates and drops its own throwaway
# databases, so it needs a Postgres it can create databases on — nothing else.
#
# Usage (against the dev compose Postgres):
#   PGHOST=localhost PGPORT=5432 PGUSER=quranbench PGPASSWORD=quranbench \
#     ./scripts/backup-restore-test.sh
#
# Exit 0 and prints PASS on success; non-zero on any mismatch or failure.

set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=quranbench}"
: "${PGPASSWORD:=quranbench}"
export PGHOST PGPORT PGUSER PGPASSWORD

command -v psql >/dev/null || { echo "psql not found (install postgresql-client)"; exit 1; }

here="$(cd "$(dirname "$0")" && pwd)"
src="qb_bkuptest_src_$$"
dst="qb_bkuptest_dst_$$"
tmp="$(mktemp -d)"

cleanup() {
  psql -d postgres -v ON_ERROR_STOP=0 -c "DROP DATABASE IF EXISTS \"$src\";" >/dev/null 2>&1 || true
  psql -d postgres -v ON_ERROR_STOP=0 -c "DROP DATABASE IF EXISTS \"$dst\";" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

echo "Creating scratch databases ..."
psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$src\";"
psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$dst\";"

echo "Seeding source with known row counts ..."
psql -d "$src" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE account (id serial PRIMARY KEY, email text NOT NULL);
INSERT INTO account (email) SELECT 'user' || g || '@example.com' FROM generate_series(1, 137) g;
CREATE TABLE investigation (id serial PRIMARY KEY, claim text, published boolean DEFAULT false);
INSERT INTO investigation (claim) SELECT 'claim ' || g FROM generate_series(1, 42) g;
CREATE TABLE revision (id serial PRIMARY KEY, investigation_id int, n int);
INSERT INTO revision (investigation_id, n) SELECT (g % 42) + 1, g FROM generate_series(1, 500) g;
SQL

url() { echo "postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/$1"; }

echo "Backing up ..."
DATABASE_URL="$(url "$src")" BACKUP_DIR="$tmp" bash "$here/backup.sh"
dump="$(ls "$tmp"/*.sql.gz)"

echo "Restoring into scratch database ..."
DATABASE_URL="$(url "$dst")" bash "$here/restore.sh" "$dump"

echo "Comparing row counts ..."
fail=0
for t in account investigation revision; do
  a="$(psql -tA -d "$src" -c "SELECT count(*) FROM $t;")"
  b="$(psql -tA -d "$dst" -c "SELECT count(*) FROM $t;")"
  if [ "$a" = "$b" ]; then
    echo "  $t: $a rows == $b rows"
  else
    echo "  $t: MISMATCH source=$a restored=$b" >&2
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "FAIL: row counts differ after restore" >&2
  exit 1
fi
echo "PASS: backup → restore reproduced every table's row count exactly"
