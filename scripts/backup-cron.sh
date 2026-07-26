#!/usr/bin/env bash
#
# Scheduled backup wrapper for the production box. Run from cron as `ubuntu`.
#
# backup.sh does the work (dump → gzip → sha256 sidecar); this supplies the
# environment cron does not have, keeps a bounded number of copies, verifies what
# it just wrote, and leaves a log a human can read after the fact.
#
# The database URL is read out of the app's own .env rather than duplicated here,
# so a rotated password cannot leave the backup silently pointing at the old one.
#
# Install:  crontab -l | { cat; echo "17 3 * * * /var/www/quranbench/scripts/backup-cron.sh"; } | crontab -
#
set -uo pipefail

APP_ENV=/var/www/quranbench/apps/web/.env
BACKUP_DIR=/var/backups/quranbench
LOG=/var/log/quranbench-backup.log
KEEP=14

log() { echo "[$(date -Is)] $*" >>"$LOG"; }

exec 9>/tmp/quranbench-backup.lock
if ! flock -n 9; then
  log "SKIP: another backup is still running"
  exit 0
fi

if [ ! -r "$APP_ENV" ]; then
  log "FATAL: cannot read $APP_ENV"
  exit 1
fi

# Take only the DATABASE_URL assignment; never source the whole file into this
# shell, which would import anything else that happens to live there.
RAW_URL=$(grep -m1 '^DATABASE_URL=' "$APP_ENV" | cut -d= -f2- | tr -d '"'"'")
if [ -z "${RAW_URL:-}" ]; then
  log "FATAL: no DATABASE_URL in $APP_ENV"
  exit 1
fi

# The app's URL carries `?schema=public`, which is a Prisma parameter. libpq does
# not know it and pg_dump fails outright with "invalid URI query parameter". Strip
# that one parameter and leave anything else (sslmode and friends) alone.
DATABASE_URL=$(printf '%s' "$RAW_URL" | sed -E 's/([?&])schema=[^&]*/\1/; s/\?&/?/; s/[?&]$//')
export DATABASE_URL

mkdir -p "$BACKUP_DIR"

log "START"
if ! out=$(BACKUP_DIR="$BACKUP_DIR" /var/www/quranbench/scripts/backup.sh 2>&1); then
  log "FATAL: backup.sh failed"
  log "$out"
  # A failed pg_dump still leaves the redirect target behind. Remove any dump
  # with no checksum sidecar so a truncated file can never be mistaken for a
  # backup, or picked up as "newest" by the next run.
  for orphan in "$BACKUP_DIR"/quranbench-*.sql.gz; do
    [ -e "$orphan" ] || continue
    [ -e "$orphan.sha256" ] || { rm -f "$orphan"; log "removed partial $orphan"; }
  done
  exit 1
fi
log "$out"

# A dump that cannot be verified is not a backup. Prove the checksum before the
# pruning step is allowed to delete anything older.
newest=$(ls -1t "$BACKUP_DIR"/quranbench-*.sql.gz 2>/dev/null | head -1)
if [ -z "$newest" ]; then
  log "FATAL: no dump found after a successful run"
  exit 1
fi
if ! ( cd "$BACKUP_DIR" && sha256sum -c "$(basename "$newest").sha256" >/dev/null 2>&1 ); then
  log "FATAL: checksum verification failed for $newest — keeping every older copy"
  exit 1
fi
bytes=$(wc -c <"$newest" | tr -d ' ')
if [ "$bytes" -lt 1000 ]; then
  log "FATAL: $newest is only ${bytes} bytes — refusing to prune behind a suspect dump"
  exit 1
fi
log "verified $newest (${bytes} bytes)"

# Retention: keep the newest $KEEP dumps and their sidecars.
pruned=0
for old in $(ls -1t "$BACKUP_DIR"/quranbench-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1))); do
  rm -f "$old" "$old.sha256"
  pruned=$((pruned + 1))
done
[ "$pruned" -gt 0 ] && log "pruned $pruned old backup(s), keeping $KEEP"

log "OK ($(ls -1 "$BACKUP_DIR"/quranbench-*.sql.gz 2>/dev/null | wc -l | tr -d ' ') copies on disk)"
log "END"
