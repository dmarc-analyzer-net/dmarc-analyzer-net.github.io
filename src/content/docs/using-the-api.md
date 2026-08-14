---
title: Using the API
description: 'Script against the same API the console uses: signing in, the bearer token that pushes reports in, what each role may call, and the renames that fail quietly.'
section: Operations
order: 6
publishDate: 2026-08-02
updatedDate: 2026-08-13
---

The console is a client of this API. Every screen it draws comes from an endpoint
you can call yourself, and there is no separate "public API" with its own surface
or its own credentials — which is the good news and the catch in one sentence.

## Two credentials, and only one of them reads anything

Almost the whole API is reached with a **user account**. `POST /api/v1/auth/login`
returns a `dmarc_session` cookie and every other call sends it back. There are no
personal access tokens and no signed URLs.

The exception is **one write endpoint**, `POST /api/v1/reports`, which takes a
bearer token instead. That token is a *machine credential*: it is scoped to a
single report source, it can do nothing but hand that source report bytes, and it
cannot read a thing. It is covered in
[pushing reports in](#pushing-reports-in-instead-of-polling-a-mailbox) below. For
everything else — every read, every configuration change — the cookie is the only
way in.

So the first decision is which account your automation uses. Make it a
**dedicated one** with the least role that does the job, not the admin you sign in
as yourself. Every write is recorded against an actor in
[the audit trail](/docs/clients-users-and-audit/#the-audit-trail), and a shared
account makes that record worthless.

What a cookie rather than a token means in practice:

| | |
|---|---|
| Lifetime | 12 hours idle, 7 days absolute. A long-running job signs in again; there is no refresh. |
| Flags | `HttpOnly` and `SameSite=Lax`. `Secure` follows the request scheme, so behind a TLS-terminating proxy set [`Network__UseForwardedHeaders`](/docs/reverse-proxy/#the-audit-trail-problem) or the flag is silently lost. |
| From a browser | CORS is configured for local development only. A page served from another origin **cannot** call this API in production. |

Also worth knowing before you start: there is **no OpenAPI or Swagger document**
to generate a client from, and **only `POST /api/v1/reports` is rate limited** —
every other endpoint, including login, is not. If you need a limit on the rest, it
belongs in your reverse proxy.

## Signing in

```bash
BASE=https://dmarc.example.com

curl -s -c /tmp/cj -X POST "$BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"automation@yourdomain.com","password":"…"}'
```

Success is `200` with a `{"user":{…}}` body, and the cookie lands in `/tmp/cj`.
Send it back with `-b` on everything after that:

```bash
curl -s -b /tmp/cj "$BASE/api/v1/clients"
```

That `/tmp/cj` convention is used by every example on this page and in the rest of
these docs. A wrong password returns `401` and the failed attempt is written to
the audit trail, which is the point of it.

On a brand-new install there is no account to sign in with yet.
`GET /api/v1/auth/setup` answers `{"requiresBootstrap":true}` while that is true,
and `POST /api/v1/auth/register` creates the first administrator. It stops working
the moment any user exists, so it is not a back door.

## What each role can call

Three tiers, enforced by middleware rather than by per-endpoint checks — which
means a newly added endpoint is agency-staff-only unless it deliberately opts out.

- **Any signed-in user, including `client_viewer`** — `GET /auth/me`, all nine
  `GET /analytics/*` reads, `GET /clients` and `/clients/{id}`, `GET /domains` and
  `/domains/{id}`, `GET /alerts`, and `GET /system/status`. Rows are filtered to
  the clients that viewer has been granted.
- **Agency staff (`agency_analyst` and `agency_admin`)** — all of the above, plus
  `GET /report-sources`, `GET /mailbox-sync-runs`, `GET /mailbox-health`,
  `GET /notification-recipients`, `PATCH /alerts/{id}` for triage, and
  `POST /report-sources/{id}/sync`.
- **`agency_admin` only** — everything that writes configuration or reads the
  audit trail: all of `/admin/*`, users and their client grants, creating and
  editing clients, domains and report sources, notification recipients, and
  issuing or revoking machine credentials under `/api-credentials`.

A **machine credential is not a fourth tier** — the two credential types do not
substitute for each other in either direction, and both mismatches are `403`:

```bash
# a machine token on a read endpoint
curl -s "$BASE/api/v1/clients" -H "Authorization: Bearer $TOKEN"
# 403 {"error":"forbidden"}

# an admin session on the ingestion endpoint
curl -s -b /tmp/cj -X POST "$BASE/api/v1/reports" --data-binary @report.xml.gz
# 403 {"error":"forbidden"}
```

The second one surprises people. It is deliberate: that endpoint resolves which
client the data belongs to *from the credential*, and a user session has nothing
to resolve — an admin could be acting for any of them.

A role violation is `403 {"error":"forbidden"}`. A *tenant* violation is a
different thing: asking for a client you hold no grant for returns **`404`, not
`403`**, and list endpoints simply omit what you cannot see. That is deliberate —
a 403 would confirm the record exists.

## Response shapes

Lists return a **bare JSON array**. There is no `page`/`pageSize`/`total` envelope
anywhere in the API, and only one endpoint paginates at all:

| Endpoint | Paging | Notes |
|---|---|---|
| `GET /admin/audit-events` | `limit` (default 200, clamped 1–1000) and `offset` | The only one. Returns `{"total":N,"items":[…]}`. Also takes `days` (default 30, clamped 1–730), `eventType`, `actor`, `clientId`. |
| `GET /alerts` | none | Takes `days` (default 30, clamped 1–365) and returns **at most 500 rows**, newest first, with no total and no cursor. A busy tenant gets a silently incomplete list. |
| `GET /mailbox-sync-runs` | `limit` (default 50, clamped 1–200) | Optionally filtered by `reportSourceId`. **This parameter was renamed in 0.11.1** — see [what changed](#what-changed-in-0111) below, because the old name fails quietly. |

Errors are a flat `{"error":"…"}` — not RFC 7807 `problem+json`:

| Status | Body | When |
|---|---|---|
| `400` | `{"error":"name and slug are required"}` | Validation. The message is the entire detail; there is no field-level list. |
| `401` | `{"error":"not authenticated"}` or `{"error":"session expired or invalid"}` | No cookie, or a dead one. |
| `403` | `{"error":"forbidden"}` | Signed in, wrong role. |
| `404` | *usually empty* | Missing — or present and not yours. |
| `409` | `{"error":"domain already exists"}` | A uniqueness conflict — a client `slug`, a domain name, or a duplicate notification recipient. |
| `502` | the sync run summary, with `"success":false` | A mailbox sync that could not reach the mail server. |
| `503` | `{"status":"unavailable"}` | `/health/ready` only: the database is unreachable. |

An unhandled exception is a bare `500` with **no body at all**, because no
problem-details handler is registered. When you see one, the log has the detail
and nothing else does.

## The trap: a mistyped path returns 200

The API and the console are the same process, and any unmatched route falls
through to the single-page app. So a typo does not give you a 404:

```bash
curl -s -b /tmp/cj -o /dev/null -w '%{http_code} %{content_type}\n' \
  "$BASE/api/v1/clientz"
# 200 text/html
```

A misspelled path, a renamed endpoint, or an `{id}` that isn't a valid GUID all
return **`200` with the console's HTML**. `curl -f` will not catch it and
`if (response.ok)` is actively misleading. Assert on the shape of what came back
instead:

```bash
curl -sS -b /tmp/cj "$BASE/api/v1/clients" \
  | jq -e 'type == "array"' > /dev/null || echo "not the response we expected"
```

The same wrong path *without* a session returns an ordinary
`401 {"error":"not authenticated"}`, because the session check matches on the
`/api/v1/` prefix before any route is resolved. A broken script can therefore
behave differently depending on whether it managed to sign in — which is a
confusing way to find out about this, so it is worth knowing first.

## Onboarding a client, scripted

The same four steps as
[onboarding by hand](/docs/clients-users-and-audit/#onboarding-a-client-end-to-end):

```bash
CLIENT=$(curl -s -b /tmp/cj -X POST "$BASE/api/v1/clients" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Example Ltd","slug":"example-ltd","retentionMonths":27,"isActive":true}' \
  | jq -r .id)

curl -s -b /tmp/cj -X POST "$BASE/api/v1/domains" \
  -H 'Content-Type: application/json' \
  -d "{\"clientId\":\"$CLIENT\",\"name\":\"yourdomain.com\",\"isActive\":true}"

SOURCE=$(curl -s -b /tmp/cj -X POST "$BASE/api/v1/report-sources" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Reports inbox\",\"protocol\":\"imap\",\"host\":\"imap.example.com\",
       \"port\":993,\"useTls\":true,\"username\":\"dmarc@yourdomain.com\",
       \"password\":\"…\",\"defaultClientId\":\"$CLIENT\",\"isActive\":true}" \
  | jq -r .id)

curl -s -b /tmp/cj -X POST "$BASE/api/v1/report-sources/$SOURCE/sync"
```

The three creates return `201`. The sync runs there and then and returns its run
summary — `200` once it connected, `502` when it could not, with the reason in
`error`. The stored mailbox password is never echoed back in any response.

Three details that catch people. `name` and `slug` are both required on a client.
`timezone` is accepted and returned but **nothing reads it** — every analytics
window is UTC, as described in
[how the time windows work](/docs/using-the-console/#how-the-time-windows-work).
And **domain names are unique across the whole install, not per client**, so
`{"error":"domain already exists"}` with a `409` can mean a *different* client
already has it. That global uniqueness is what lets a report be attributed to an
owner no matter which mailbox it arrived in; see
[a domain landed under the wrong client](/docs/troubleshooting/#a-domain-landed-under-the-wrong-client)
when it bites.

## What changed in 0.11.1

Three renames landed together, and they fail in three different ways. If you have
a script written against 0.10.0 or earlier, this is the list.

**`mailboxSourceId` became `reportSourceId`**, as both a response field and a query
parameter on `/mailbox-sync-runs` and `/mailbox-health`. This is the one to check
first, because **it does not fail**. Unknown query parameters are ignored, so a
call still sending `?mailboxSourceId=…` returns `200` with **every row,
unfiltered** — a filter that quietly stopped filtering, which looks like the source
suddenly got busy rather than like a broken script.

**`/api/v1/mailbox-sources` became `/api/v1/report-sources`** — list, create, patch
and manual sync. The old path does not `404`; it does the thing described in
[the trap above](#the-trap-a-mistyped-path-returns-200) and returns `200` with the
console's HTML to a signed-in caller, or `401` to one that is not. Assert on the
shape of the response, not on the status.

**`pop3` is no longer accepted** as a `protocol` when creating a source or changing
one. Existing rows are untouched and stay editable — only a *change* to `pop3` is
refused. Nothing is lost either way: a POP3 source has never ingested anything,
because the worker has only ever polled IMAP.

The entity was renamed because it was named for how the first implementation
reached reports, rather than for what it holds — which is exactly what the next
section is about.

## Pushing reports in, instead of polling a mailbox

The usual arrangement is that you publish a `rua=mailto:` address, reports arrive
there, and this application polls that mailbox over IMAP. If something upstream
already holds the reports — a mail gateway, an archive, another system that
receives them for you — it can hand them over directly instead.

That takes a report source whose protocol is `api` rather than `imap`, and a
machine credential issued against it. Both are created in the console, under
**Report sources**; the credential is admin-only, because handing one out is the
same class of act as creating a user.

**The token is shown once.** It is stored as a hash, so nothing can display it
again — if it is lost, revoke that credential and issue another.

```bash
curl -s -X POST "$BASE/api/v1/reports" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/gzip' \
  -H 'Content-Disposition: attachment; filename="report.xml.gz"' \
  --data-binary @report.xml.gz
```

Post the bytes exactly as they arrived — the gzip, the zip, or the bare XML. It is
the same extractor, the same parser and the same deduplication the mailbox path
uses, so the two cannot disagree about what has already been ingested. A `.zip`
holding several reports is unpacked and each one ingested. The filename in
`Content-Disposition` is optional and used only for logging.

Success is `200` with a summary:

```json
{"payloadSha256":"bd317d9b…","replay":false,"inserted":1,"duplicate":0,"failed":0,
 "payloads":[{"sourceName":"report.xml.gz","kind":"dmarc","result":"inserted"}]}
```

### Retrying is safe

The SHA-256 of the request body is recorded per source, so **posting the identical
bytes again is answered `"replay":true` with nothing ingested**. That is the
answer to the classic problem of a response lost in transit: retry blindly, and
you get a definite yes rather than a pile of duplicates.

Note the two different things that can make a repeat harmless. `replay` means
*these exact bytes* have been seen before. `duplicate` means the report inside
them was already stored — which is what you get when the same report is re-encoded
or arrives from a second route.

### What it refuses

| Status | When |
|---|---|
| `401` | No `Authorization` header, or a token that is unknown, revoked or expired. |
| `403` | A valid credential, but not for this endpoint — or a user session instead of a token. |
| `413` | The request, or what it expands to, is past one of the size limits. The message names the setting so you know which. |
| `429` | Too many requests for this credential. Carries `Retry-After`. Limits are per credential, so one busy pipeline cannot starve another. |
| `400` | Nothing in the payload parsed, the body was empty, or the provenance header was malformed. |

The size limits, their defaults and how to raise them are in
[configuration](/docs/configuration/). They sit far above any real reporting
pipeline; a `rua=` address is published in DNS, so they exist to stop a
decompression bomb rather than to police normal traffic.

A refusal writes no receipt, so a `4xx` you can fix is always safe to retry.

### Recording where a report came from

An optional `X-Report-Provenance` header is stored alongside the receipt, so
"which relay handed us this" is answerable later:

```bash
-H 'X-Report-Provenance: {"v":1,"relay":"gateway-01","received":"2026-08-13T08:00:00Z"}'
```

It must be a **JSON object carrying an integer `v`** that declares its shape.
Anything else — a bare string, an array, an object without `v` — is a `400` that
refuses the whole request rather than dropping the label quietly. Keep it small;
it is a label, not a payload.

### Which client the reports land under

The credential decides. There is no client or source id in the path, precisely so
a caller cannot ask for one thing and be given another.

By default a source will accept a report for any domain, creating the domain under
its own client if nobody owns it yet. Turning **allow foreign domains** off on the
source narrows that: a report for a domain already owned by a *different* client
is refused before anything is written. It is not a domain allow-list — a domain
nobody owns yet is still created under this source's client, and is therefore
never foreign.

One thing this does not give you: there is **no view of when a pushed source last
received something**. `GET /api/v1/mailbox-health` covers polled mailboxes only,
because a pushed source has no mailbox, no sync run and no checkpoint. Until that
gap is filled, monitor it from the sending side.

## The full route list

There are 69 routes under `/api/v1`, plus the unauthenticated `/health/live` and
`/health/ready` probes. This page covers the mechanics rather than enumerating
them, because a second copy of a route list is a second thing to go stale.

The canonical list is
[`http/api.http`](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/http/api.http)
in the application repository — a runnable request file with a worked example of
every endpoint, kept in step with the code. Grouped by area, those routes cover
authentication and OIDC, clients, domains, users and grants, report sources with
their sync runs and health, machine credentials and report ingestion, alerts and
notification recipients, nine analytics reads, and `/admin/*` for the audit trail,
backup and configuration export/import, retention, the digest, and database
migration.

Most of them are already documented in context elsewhere in these docs —
[monitoring](/docs/monitoring/#watching-ingestion--the-check-that-matters) for
mailbox health, [configuration](/docs/configuration/#who-gets-notified) for alerts
and recipients, and [upgrading and backup](/docs/upgrading-and-backup/#retention)
for retention and the configuration export.
