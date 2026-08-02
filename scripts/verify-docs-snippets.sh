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
# Run it by hand when you change install.md, upgrading-and-backup.md,
# configuration.md, troubleshooting.md, monitoring.md or using-the-api.md.
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
# The rollback pair is PINNED, not derived. This used `max("MigrationId")` while
# dropping a column belonging to an older migration, which worked only while that
# migration happened to be the newest. Three migrations later it deleted the
# history row for AddMailboxRetentionDeletion and dropped audit_event."ClientName",
# so `migrate` re-ran the wrong migration and died on
#   column "DeleteAfterRetention" of relation "mailbox_source" already exists
# — then the missing column broke the app and took the next twelve checks with it.
# Any applied migration works here as long as its inverse is written beside it:
# EF re-applies whatever is missing from the history table, in order.
ROLLBACK_ID='20260725230939_AddAuditEventClientName'
ROLLBACK_SQL='alter table audit_event drop column "ClientName";'

BEFORE="$(migrations)"
PINNED="$($PSQL "select count(*) from \"__EFMigrationsHistory\" where \"MigrationId\"='$ROLLBACK_ID'" | tr -d '\r')"
check "the pinned rollback migration is applied" "1" "$PINNED"
if [ "$PINNED" != "1" ]; then
  echo "        (update ROLLBACK_ID and ROLLBACK_SQL above — the rest of this section cannot run)"
fi

# Roll back one migration to create a genuinely pending one.
$C exec -T postgres psql -U postgres -d dmarc_analyzer -q \
  -c "$ROLLBACK_SQL delete from \"__EFMigrationsHistory\" where \"MigrationId\"='$ROLLBACK_ID';" >/dev/null 2>&1
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
echo "using-the-api.md — auth, roles and response shapes"
API="http://localhost:$PORT/api/v1"
ADMIN_PW="$(openssl rand -base64 18)"
VIEWER_PW="$(openssl rand -base64 18)"
ctype() { curl -s -o /dev/null -w '%{content_type}' "$@"; }
# Fresh cookie jars per run; the stack above has no users yet on first boot, but
# the split/scale steps reuse the same database, so bootstrap may already be done.
rm -f "$WORK/admin.cj" "$WORK/viewer.cj"

check "an unauthenticated protected route is 401" "401" "$(code /api/v1/clients)"

curl -s -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@yourdomain.com\",\"password\":\"$ADMIN_PW\",\"displayName\":\"Ops\"}" \
  >/dev/null 2>&1
curl -s -c "$WORK/admin.cj" -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@yourdomain.com\",\"password\":\"$ADMIN_PW\"}" >/dev/null 2>&1
grep -q dmarc_session "$WORK/admin.cj" 2>/dev/null
check "login stores a dmarc_session cookie" "0" "$?"
check "...and the cookie authenticates" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$WORK/admin.cj" "$API/clients")"

# The trap the page leads with: unmatched /api/v1 paths fall through to the SPA,
# so a typo is 200 text/html rather than a 404 — but only once authenticated,
# because the session check matches on the path prefix before routing.
check "a mistyped path returns 200 (not 404)" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$WORK/admin.cj" "$API/clientz")"
check "...and serves HTML, not JSON" "text/html" "$(ctype -b "$WORK/admin.cj" "$API/clientz")"
check "...while unauthenticated it is a plain 401" "401" "$(code /api/v1/clientz)"

check "audit-events is the one paginated endpoint" "0" \
  "$(curl -s -b "$WORK/admin.cj" "$API/admin/audit-events?limit=2" \
     | grep -qE '^\{"total":[0-9]+,"items":\['; echo $?)"
check "lists are bare arrays" "0" \
  "$(curl -s -b "$WORK/admin.cj" "$API/mailbox-sync-runs" | grep -qE '^\['; echo $?)"

# monitoring.md tells operators to use an agency_analyst as the monitoring
# identity. It said client_viewer for a while, which gets a flat 403 — a check
# built on one can never succeed, so this guards the corrected claim.
curl -s -b "$WORK/admin.cj" -X POST "$API/users" -H 'Content-Type: application/json' \
  -d "{\"email\":\"viewer@yourdomain.com\",\"password\":\"$VIEWER_PW\",\"displayName\":\"V\",\"role\":\"client_viewer\"}" \
  >/dev/null 2>&1
curl -s -c "$WORK/viewer.cj" -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"viewer@yourdomain.com\",\"password\":\"$VIEWER_PW\"}" >/dev/null 2>&1
check "client_viewer cannot read mailbox health" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$WORK/viewer.cj" "$API/mailbox-health")"
check "...but can read a viewer-allowed route" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$WORK/viewer.cj" "$API/clients")"

# Domain names are unique install-wide, not per client — the 409 the page warns about.
CID="$(curl -s -b "$WORK/admin.cj" -X POST "$API/clients" -H 'Content-Type: application/json' \
  -d '{"name":"Example Ltd","slug":"example-ltd","retentionMonths":27,"isActive":true}' \
  | grep -oE '"id":"[0-9a-f-]{36}"' | head -1 | cut -d'"' -f4)"
curl -s -b "$WORK/admin.cj" -X POST "$API/domains" -H 'Content-Type: application/json' \
  -d "{\"clientId\":\"$CID\",\"name\":\"yourdomain.com\",\"isActive\":true}" >/dev/null 2>&1
check "a duplicate domain name is 409" "409" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$WORK/admin.cj" -X POST "$API/domains" \
     -H 'Content-Type: application/json' \
     -d "{\"clientId\":\"$CID\",\"name\":\"yourdomain.com\",\"isActive\":true}")"

echo
if [ "$FAILED" -eq 0 ]; then echo "All documented commands behave as the docs claim."; else echo "Some claims do not hold — see FAIL above."; fi
exit "$FAILED"
