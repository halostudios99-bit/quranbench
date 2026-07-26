#!/usr/bin/env bash
#
# Atomic deploy for quranbench. Runs ON the server (/var/www/quranbench).
#
# Why this exists: `next build` rewrites its dist directory in place. Building
# into the directory the live server is reading means the site 502s for the whole
# build, pm2 restarts it into a half-written build, and after 15 failed restarts
# pm2 marks the process `errored` and stops trying — it does not recover on its
# own.
#
# So the build never touches the directory being served. Two slots, .next-a and
# .next-b: whichever one pm2 is currently using stays untouched and keeps serving
# while the other is rebuilt. Only when the build succeeds does pm2 restart onto
# the new slot. A failed build changes nothing and the site never notices.
#
# Downtime is the pm2 restart (a few seconds), not the build.
#
# Usage:  ssh oracle 'setsid nohup /var/www/quranbench/scripts/deploy-atomic.sh \
#                       > /tmp/qb-deploy.log 2>&1 < /dev/null &'
#
# Never run this attached to an interactive ssh session: if the client goes away,
# the build blocks writing to a pipe nobody is reading and hangs indefinitely at
# ~1% CPU, looking exactly like a slow build.
#
set -uo pipefail

APP_DIR=/var/www/quranbench
WEB_DIR="$APP_DIR/apps/web"
PM2_NAME=quranbench

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
nvm use 24 >/dev/null 2>&1

say() { echo "[$(date -Is)] $*"; }

say "START node $(node -v)"

# Which slot is live? Read it from the running process rather than a marker file,
# so the script cannot disagree with reality. Anything that is not .next-a — including
# the legacy .next from before this script existed — means .next-a is the free slot.
CURRENT=$(pm2 jlist 2>/dev/null | node -e '
  let d = "";
  process.stdin.on("data", (c) => (d += c)).on("end", () => {
    try {
      const p = JSON.parse(d).find((x) => x.name === "quranbench");
      process.stdout.write((p && p.pm2_env && p.pm2_env.NEXT_DIST_DIR) || ".next");
    } catch { process.stdout.write(".next"); }
  });
')
if [ "$CURRENT" = ".next-a" ]; then TARGET=".next-b"; else TARGET=".next-a"; fi
say "live slot: $CURRENT — building into: $TARGET"

cd "$APP_DIR" || { say "FATAL: no $APP_DIR"; exit 1; }

# A stale target from an earlier failed run would otherwise be served as-is.
rm -rf "${WEB_DIR:?}/${TARGET:?}"

say "installing dependencies"
if ! pnpm install --frozen-lockfile; then
  say "FATAL: pnpm install failed — nothing changed, site still serving $CURRENT"
  echo "DEPLOY_EXIT=1"; say "END"; exit 1
fi

# Run the build at the lowest priority. The box has 2 vCPUs and the static
# generation pass covers ~78,000 pages, which saturates both; the live process
# then misses nginx's proxy timeout and a request occasionally returns 502 even
# though the app is healthy and the old slot is untouched. Observed once during
# a deploy on 2026-07-26. `nice` lets the serving process win the CPU, at the
# cost of a slower build — the right trade when the build is not user-visible.
NICE="nice -n 19"
command -v ionice >/dev/null && NICE="ionice -c3 $NICE"

say "building (deprioritised: $NICE)"
if ! $NICE env NEXT_DIST_DIR="$TARGET" pnpm --filter @quranbench/web build; then
  say "FATAL: build failed — nothing changed, site still serving $CURRENT"
  rm -rf "${WEB_DIR:?}/${TARGET:?}"
  echo "DEPLOY_EXIT=1"; say "END"; exit 1
fi

# A build that exits 0 but produced no BUILD_ID would restart pm2 into a directory
# next start refuses to serve. Check before touching the live process.
if [ ! -f "$WEB_DIR/$TARGET/BUILD_ID" ]; then
  say "FATAL: no BUILD_ID in $TARGET — refusing to switch"
  echo "DEPLOY_EXIT=1"; say "END"; exit 1
fi
say "build ok: BUILD_ID=$(cat "$WEB_DIR/$TARGET/BUILD_ID")"

say "switching pm2 to $TARGET"
NEXT_DIST_DIR="$TARGET" pm2 restart "$PM2_NAME" --update-env >/dev/null 2>&1
# Persist, so a reboot resurrects onto the slot that is actually built.
pm2 save >/dev/null 2>&1

# Health check with a few attempts — the restart is not instant.
CODE=000
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 3
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3004/ || echo 000)
  [ "$CODE" = "200" ] && break
done

if [ "$CODE" != "200" ]; then
  say "health check FAILED ($CODE) — rolling back to $CURRENT"
  NEXT_DIST_DIR="$CURRENT" pm2 restart "$PM2_NAME" --update-env >/dev/null 2>&1
  pm2 save >/dev/null 2>&1
  sleep 5
  say "after rollback: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3004/ || echo 000)"
  echo "DEPLOY_EXIT=1"; say "END"; exit 1
fi

say "healthy on $TARGET (HTTP $CODE)"
echo "DEPLOY_EXIT=0"
say "END"
