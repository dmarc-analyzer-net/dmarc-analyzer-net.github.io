#!/usr/bin/env bash
#
# Fails when a document appears in docs/ that nobody decided to publish.
#
# This repo is public. Twice in one day a document was written here that
# belonged in the private `seo` repo: docs/voice.md, which quoted our
# positioning and the keyword policy (#128), and docs/measurement-migration-scope.md,
# which inventoried the DNS provider, the apex records, the proposed Matomo
# host, the hosting bill and a dated cutover window (#130). Neither was caught
# by review before it was pushed, because a new file in docs/ reads as ordinary
# repo housekeeping — it is the *contents* that were wrong, and a diff of a new
# 660-line file does not invite that question.
#
# So the check is deliberately not a content scanner: a grep for "internal" or
# for currency symbols would miss the voice doc entirely and would fire on every
# pricing page we ever write about competitors. Instead docs/ is an allowlist.
# Adding a name below is the decision to publish, made once, visible in review
# as a line in this file rather than as an attachment to a 660-line diff.
#
# The routing rule this enforces is in AGENTS.md, under "This repo is public".
# Mechanics are public; strategy, editorial judgement, and anything naming
# costs, vendors or hostnames go to the private repo.
#
#   ./scripts/check-docs-placement.sh
#
# Requires: bash. `dotglob` is bash, not POSIX, and without it a dotfile in
# docs/ is never looked at — so under another shell this check passes green
# while skipping exactly the file somebody hid. `shopt` is not fatal in dash,
# which only warns, so refuse the run outright instead. Invoke it as
# `./scripts/check-docs-placement.sh` or `bash scripts/check-docs-placement.sh`.
if [ -z "${BASH_VERSION:-}" ]; then
  echo "check-docs-placement.sh requires bash; run it as ./scripts/check-docs-placement.sh" >&2
  exit 1
fi

set -uo pipefail
shopt -s dotglob nullglob

cd "$(dirname "$0")/.."

# Published deliberately. Both predate the rule and are grandfathered rather
# than endorsed: docs/backlog.md is a decision record that includes competitor
# positioning reasoning, and docs/content-and-seo.md names the thin-content
# filters the plan steers around. Whether they should stay public is an open
# Medium Priority backlog item; this list is not that decision, and settling it
# means editing this list.
ALLOWED="
backlog.md
content-and-seo.md
"

fail=0
for path in docs/*; do
  # A dangling symlink fails -e. Skipping it would let a file through whose
  # name and target are both public and neither was on the list.
  [ -e "$path" ] || [ -L "$path" ] || continue
  name="${path#docs/}"

  if [ -d "$path" ]; then
    printf '  UNEXPECTED  %s/ is a directory; the allowlist covers files only.\n' "$path"
    fail=1
    continue
  fi

  case "$ALLOWED" in
    *"
$name
"*) continue ;;
  esac

  printf '  NOT ALLOWED  %s\n' "$path"
  fail=1
done

if [ "$fail" -eq 0 ]; then
  echo "docs/ contains only files that were deliberately published."
  exit 0
fi

cat <<'EOF'

docs/ in this repo is PUBLIC and allowlisted. Each file above is either:

  (a) internal — strategy, editorial judgement, costs, vendors, hostnames,
      migration plans. Move it to the private `seo` repo and, if this repo
      needs to know it exists, leave a one-paragraph pointer in
      docs/backlog.md that carries none of the sensitive detail; or

  (b) genuinely about how this repo builds, and safe for anyone to read. Add
      its filename to ALLOWED in scripts/check-docs-placement.sh, in the same
      commit, so the choice to publish it is on the record.

See AGENTS.md, "This repo is public — so decide where a document goes before
you write it", for the routing rule and the test to apply.
EOF
exit 1
