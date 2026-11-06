#!/usr/bin/env bash
#
# Availability and latency check for the production site.
#
# One run fetches each target once, asserts on the response, and prints one CSV
# row per target to stdout. Exit status is 0 only if every target passed.
#
#   ./scripts/uptime-check.sh            # check, one CSV row per target
#   ./scripts/uptime-check.sh --header   # just the CSV header row
#
# This exists to answer one question, asked after the GitHub Pages → Bunny.net
# cutover: did the move make the site slower or less reliable? That question is
# unanswerable without history recorded *before* the move, which is why this is
# scheduled rather than manual, unlike `seo-audit.yml` next door.
#
# What it asserts, and why each one:
#
#   HTTP 200, with no redirect followed. curl is deliberately not given -L. The
#   apex serves the page itself today; if it ever starts answering 301, that is
#   a finding and not something to quietly follow.
#
#   A body string, matched only in the markup *after* `</head>`. This is the
#   check that catches a CDN serving 200 with the wrong content, and the head
#   restriction is not decoration. The obvious apex needle, "agencies running
#   many", occurs four times in `<head>` (title, description, OG, Twitter) and
#   zero times in the body — grepping the whole document for it would pass on a
#   page whose entire body had vanished, which is precisely the failure this
#   assertion exists to catch.
#
# A failed fetch is retried once after five seconds before the target is called
# down, because one timeout from one runner is noise rather than an outage. The
# attempt count is recorded either way.
#
# On the latency columns: these are measured from a GitHub-hosted runner on
# shared Azure network, not from a fixed monitoring vantage point. Treat them as
# a before/after comparison of the same noisy instrument, never as absolute
# numbers. Compare distributions over days, not individual rows.

set -uo pipefail

# target URL | string that must appear in the body, after </head>
TARGETS=(
  "https://dmarc-analyzer.net/|Open-source DMARC monitoring for agencies running"
  "https://dmarc-analyzer.net/guides/spf-record-syntax/|SPF record syntax and examples"
)

CONNECT_TIMEOUT=10
MAX_TIME=20
RETRY_DELAY=5

HEADER="timestamp_utc,target,ok,http_code,remote_ip,time_namelookup,time_connect,time_appconnect,time_starttransfer,time_total,size_bytes,attempts,note"

if [ "${1:-}" = "--header" ]; then
  echo "$HEADER"
  exit 0
fi

# Does $2 appear in the part of file $1 that follows </head>? Shelling out to
# Python because the document may be a single long line, which rules out the
# line-oriented tools; python3 is already a CI dependency for the crawler.
body_contains() {
  python3 - "$1" "$2" <<'PY'
import sys
path, needle = sys.argv[1], sys.argv[2]
try:
    html = open(path, encoding="utf-8", errors="replace").read()
except OSError:
    sys.exit(1)
cut = html.find("</head>")
body = html[cut:] if cut != -1 else html
sys.exit(0 if needle in body else 1)
PY
}

failed=0

for entry in "${TARGETS[@]}"; do
  url=${entry%%|*}
  needle=${entry#*|}

  bodyfile=$(mktemp)
  ok=0
  note=""
  attempts=0
  metrics=""

  while [ "$attempts" -lt 2 ]; do
    attempts=$((attempts + 1))
    note=""

    # %{remote_ip} tells us which edge answered, which is the single most
    # useful column on cutover day: it is how you see traffic actually move.
    metrics=$(curl -sS \
      --connect-timeout "$CONNECT_TIMEOUT" \
      --max-time "$MAX_TIME" \
      -o "$bodyfile" \
      -w '%{http_code},%{remote_ip},%{time_namelookup},%{time_connect},%{time_appconnect},%{time_starttransfer},%{time_total},%{size_download}' \
      "$url" 2>/dev/null)
    curl_status=$?

    if [ "$curl_status" -ne 0 ]; then
      note="curl_exit_${curl_status}"
      metrics="000,,0,0,0,0,0,0"
    else
      code=${metrics%%,*}
      if [ "$code" != "200" ]; then
        note="http_${code}"
      elif ! body_contains "$bodyfile" "$needle"; then
        note="body_assertion_failed"
      else
        ok=1
        break
      fi
    fi

    [ "$attempts" -lt 2 ] && sleep "$RETRY_DELAY"
  done

  [ "$ok" -eq 1 ] || failed=1

  printf '%s,%s,%s,%s,%s,%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$url" "$ok" "$metrics" "$attempts" "$note"

  rm -f "$bodyfile"
done

exit "$failed"
