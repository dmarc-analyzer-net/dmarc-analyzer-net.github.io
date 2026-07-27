#!/usr/bin/env bash
#
# Flags documentation that still tells people to install a superseded release.
#
# The app repo enforces this for its own files with a test, but it cannot see
# across the repository boundary, so its release checklist carried a hand-written
# list of the files here instead. That list was wrong the day it was written — it
# named two files when there were three. Hence this.
#
#   ./scripts/check-doc-versions.sh          # compare against the latest release
#   ./scripts/check-doc-versions.sh 0.3.0    # or against a release being prepared
#
# Requires: curl, jq (only when no version is passed).

set -uo pipefail

REPO="dmarc-analyzer-net/DmarcAnalyzerApp"
WANTED="${1:-}"

if [ -z "$WANTED" ]; then
  # Anonymous API calls are rate-limited per IP, and CI runners share addresses,
  # so authenticate when a token is available. GitHub Actions exposes one for
  # free; locally this is simply unset and the call stays anonymous.
  auth=()
  [ -n "${GITHUB_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $GITHUB_TOKEN")

  WANTED=$(curl -fsSL ${auth[@]+"${auth[@]}"} \
    "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null \
    | jq -r '.tag_name // empty' | sed 's/^v//')
  [ -n "$WANTED" ] || { echo "Could not read the latest release from GitHub; pass a version explicitly."; exit 2; }
  echo "Latest release: $WANTED"
fi

# Sort -V puts the older version first, so "older than WANTED" is a version that
# is not equal to it and sorts before it.
older_than() {
  [ "$1" != "$WANTED" ] && [ "$(printf '%s\n%s\n' "$1" "$WANTED" | sort -V | head -1)" = "$1" ]
}

# Deliberately historical references are not staleness. "On 0.2.1 and earlier this
# was a bug" must keep naming 0.2.1 — bumping it would make the sentence false. The
# app repo's VersionReferenceTests carves out the same cases for the same reason.
HISTORICAL='(and|or) earlier|was a bug|releases/tag/v|previous release|superseded|upgrading fixes'

fail=0
while IFS=: read -r file line text; do
  [ -n "${file:-}" ] || continue
  for v in $(printf '%s' "$text" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | sort -u); do
    if older_than "$v"; then
      printf '  STALE  %s:%s references %s\n         %s\n' \
        "$file" "$line" "$v" "$(printf '%s' "$text" | sed 's/^[[:space:]]*//' | cut -c1-96)"
      fail=1
    fi
  done
done < <(grep -rnE '[0-9]+\.[0-9]+\.[0-9]+' src/content/docs src/pages 2>/dev/null \
         | grep -vE 'Apache-2\.0|GPL-[0-9]|CC-BY|RFC ?[0-9]{4}|postgres:1[0-9]' \
         | grep -viE "$HISTORICAL")

if [ "$fail" -eq 0 ]; then
  echo "No documentation points at a release older than $WANTED."
else
  echo
  echo "Bump these to $WANTED, or they will send readers to a superseded release."
fi
exit "$fail"
