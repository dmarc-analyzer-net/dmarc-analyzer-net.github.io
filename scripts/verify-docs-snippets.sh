#!/usr/bin/env bash
#
# Runs the commands the deployment docs tell readers to run, against a throwaway
# stack, and checks the outcome each page claims.
#
# Deliberately NOT in CI: it builds an image and starts containers, which is too
# slow and too stateful for every push. Run it by hand when you change
# install.md, upgrading-and-backup.md, configuration.md or troubleshooting.md.
#
#   ./scripts/verify-docs-snippets.sh /path/to/DmarcAnalyzerApp
#
# It exists because untested snippets have been wrong twice: the upgrade page told
# people to run `docker compose up -d`, which does not apply migrations when the
# image is unchanged, and the install page described three containers after the
# published compose file dropped to two. Both looked right when read.

set -uo pipefail

APP_REPO="${1:-$HOME/dev/DmarcAnalyzerApp}"
PROJECT="docsverify"
PORT="${PORT:-8097}"
WORK="$(mktemp -d)"
IMAGE="dmarc-analyzer-net:docsverify"
FAILED=0

# --remove-orphans and both overlays, or the worker containers from the scale test
# survive and the next run reports a bogus failure on the service list.
cleanup() {
  docker compose -p "$PROJECT" --project-directory "$WORK" \
    -f "$WORK/compose.yml" -f "$WORK/compose.split.yml" \
    down -v --remove-orphans >/dev/null 2>&1
  docker rmi -f "$IMAGE" >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT

check() { # description, expected, actual
  if [ "$2" = "$3" ]; then
    printf '  ok    %-56s %s\n' "$1" "$3"
  else
    printf '  FAIL  %-56s expected %s, got %s\n' "$1" "$2" "$3"; FAILED=1
  fi
}

[ -f "$APP_REPO/deploy/compose.yml" ] || { echo "No deploy/compose.yml under $APP_REPO"; exit 1; }

echo "Building the image under test..."
docker build -q -t "$IMAGE" "$APP_REPO" >/dev/null || exit 1

# The real published files, with only the image swapped for the local build.
cp "$APP_REPO"/deploy/compose.yml "$APP_REPO"/deploy/compose.split.yml \
   "$APP_REPO"/deploy/compose.external-db.yml "$WORK/"
sed -i "s|ghcr.io/dmarc-analyzer-net/dmarc-analyzer:latest|$IMAGE|" "$WORK"/*.yml
{ echo "DMARC_ENCRYPTION_KEY=$(openssl rand -base64 32)"; echo "DMARC_HTTP_PORT=$PORT"; } > "$WORK/.env"

C="docker compose -p $PROJECT --project-directory $WORK -f $WORK/compose.yml"
PSQL="$C exec -T postgres psql -U postgres -d dmarc_analyzer -tAc"
migrations() { $PSQL 'select count(*) from "__EFMigrationsHistory"' 2>/dev/null | tr -d '\r'; }
code() { curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT$1"; }

echo
echo "install.md — quick start"
# Start from nothing, so a previous aborted run cannot skew the service list.
docker compose -p "$PROJECT" --project-directory "$WORK" -f "$WORK/compose.yml" \
  -f "$WORK/compose.split.yml" down -v --remove-orphans >/dev/null 2>&1
$C up -d >/dev/null 2>&1
for _ in $(seq 1 90); do curl -fsS "http://localhost:$PORT/api/v1/auth/setup" >/dev/null 2>&1 && break; sleep 2; done
check "services started" "app postgres" "$($C ps --format '{{.Service}}' 2>/dev/null | sort | tr '\n' ' ' | sed 's/ $//')"
check "console responds" "200" "$(code /)"
check "setup endpoint responds" "200" "$(code /api/v1/auth/setup)"
check "worker loop is in the app container" "1" \
  "$($C logs app 2>&1 | grep -c 'Queue worker started')"

echo
echo "upgrading-and-backup.md — the migration claims"
NEWEST="$($PSQL 'select max("MigrationId") from "__EFMigrationsHistory"' | tr -d '\r')"
BEFORE="$(migrations)"
# Roll back one migration to create a genuinely pending one.
$C exec -T postgres psql -U postgres -d dmarc_analyzer -q \
  -c "alter table audit_event drop column \"ClientName\"; delete from \"__EFMigrationsHistory\" where \"MigrationId\"='$NEWEST';" >/dev/null 2>&1
ROLLED="$(migrations)"
check "rolled back one migration" "$((BEFORE - 1))" "$ROLLED"

# The trap the page warns about: plain `up -d` does not recreate an unchanged
# container, so nothing migrates — while the healthcheck still passes.
$C up -d >/dev/null 2>&1; sleep 8
check "plain 'up -d' does NOT migrate" "$ROLLED" "$(migrations)"
check "...yet health still returns 200" "200" "$(code /api/v1/auth/setup)"

# The documented no-downtime path.
$C run --rm -e APP_MODE=migrate app >/dev/null 2>&1
check "migrate mode applies it" "$BEFORE" "$(migrations)"
check "...console stayed up throughout" "200" "$(code /)"
$C run --rm -e APP_MODE=migrate app 2>&1 | grep -q "No pending migrations"
check "migrate mode is idempotent" "0" "$?"

echo
echo "upgrading-and-backup.md — backup"
$C exec -T postgres pg_dump -U postgres dmarc_analyzer | gzip > "$WORK/backup.sql.gz"
gzip -t "$WORK/backup.sql.gz" 2>/dev/null
check "pg_dump | gzip produces a valid archive" "0" "$?"

echo
echo "install.md — the split overlay"
echo "COMPOSE_FILE=compose.yml:compose.split.yml" >> "$WORK/.env"
SPLIT="docker compose -p $PROJECT --project-directory $WORK -f $WORK/compose.yml -f $WORK/compose.split.yml"
$SPLIT up -d >/dev/null 2>&1; sleep 12
check "split adds a worker service" "app postgres worker" \
  "$($SPLIT ps --format '{{.Service}}' 2>/dev/null | sort | tr '\n' ' ' | sed 's/ $//')"
check "console no longer runs the loop" "0" "$($SPLIT logs app 2>&1 | grep -c 'Queue worker started')"
check "worker runs the loop" "1" "$($SPLIT logs worker 2>&1 | grep -c 'Queue worker started')"

echo
echo "troubleshooting.md — the ingestion lock"
check "exactly one advisory lock held" "1" \
  "$($PSQL "select count(*) from pg_locks where locktype='advisory'" | tr -d '\r')"
$SPLIT up -d --scale worker=2 >/dev/null 2>&1; sleep 12
[ "$($SPLIT logs worker 2>&1 | grep -c 'Another worker already holds')" -gt 0 ]
check "a second worker is refused" "0" "$?"

echo
if [ "$FAILED" -eq 0 ]; then echo "All documented commands behave as the docs claim."; else echo "Some claims do not hold — see FAIL above."; fi
exit "$FAILED"
