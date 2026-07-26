#!/usr/bin/env bash
#
# Restore a backup produced by backup.sh into a database. Verifies the .sha256
# sidecar first (if present) so a corrupted dump is never applied. Restores into
# the database named by the second argument or DATABASE_URL — which should be an
# empty/scratch database, since a plain dump layers its objects onto whatever is
# there.
#
# Usage:
#   ./scripts/restore.sh backups/quranbench-20260726T000000Z.sql.gz postgres://user:pass@host/scratch
#   DATABASE_URL=postgres://... ./scripts/restore.sh backups/quranbench-....sql.gz

set -euo pipefail

dump="${1:?usage: restore.sh <dump.sql.gz> [TARGET_DATABASE_URL]}"
target="${2:-${DATABASE_URL:?set DATABASE_URL or pass a target as the second argument}}"

command -v psql >/dev/null || { echo "psql not found (install postgresql-client)"; exit 1; }
[ -f "$dump" ] || { echo "no such dump: $dump"; exit 1; }

sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi
}

if [ -f "${dump}.sha256" ]; then
  echo "Verifying checksum ..."
  actual="$(sha256 "$dump" | awk '{print $1}')"
  expected="$(awk '{print $1}' "${dump}.sha256")"
  if [ "$actual" != "$expected" ]; then
    echo "CHECKSUM MISMATCH — refusing to restore a corrupt dump" >&2
    exit 1
  fi
  echo "Checksum OK"
else
  echo "warning: no ${dump}.sha256 sidecar; restoring without integrity check" >&2
fi

echo "Restoring ${dump} into target ..."
# ON_ERROR_STOP so a partial/failed restore exits non-zero instead of limping on.
gunzip -c "$dump" | psql --set ON_ERROR_STOP=1 "$target"
echo "Restore complete."
