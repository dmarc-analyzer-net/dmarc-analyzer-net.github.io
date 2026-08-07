---
title: Using the API
description: Script against the same API the console uses — signing in with curl, what each role may call, the response shapes, and the mistyped path that returns 200.
section: Operations
order: 6
publishDate: 2026-08-02
---

The console is a client of this API. Every screen it draws comes from an endpoint
you can call yourself, and there is no separate "public API" with its own surface
or its own credentials — which is the good news and the catch in one sentence.

## There are no API tokens

The only credential is a user account. `POST /api/v1/auth/login` returns a
`dmarc_session` cookie and every other call sends it back. Nothing else
authenticates: no bearer tokens, no personal access tokens, no signed URLs.

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
to generate a client from, and **no rate limiting on any endpoint** — including
login. If you need either, they belong in your reverse proxy.

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
  `GET /mailbox-sources`, `GET /mailbox-sync-runs`, `GET /mailbox-health`,
  `GET /notification-recipients`, `PATCH /alerts/{id}` for triage, and
  `POST /mailbox-sources/{id}/sync`.
- **`agency_admin` only** — everything that writes configuration or reads the
  audit trail: all of `/admin/*`, users and their client grants, creating and
  editing clients, domains and mailbox sources, and notification recipients.

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
| `GET /mailbox-sync-runs` | `limit` (default 50, clamped 1–200) | Optionally filtered by `mailboxSourceId`. |

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

SOURCE=$(curl -s -b /tmp/cj -X POST "$BASE/api/v1/mailbox-sources" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Reports inbox\",\"protocol\":\"imap\",\"host\":\"imap.example.com\",
       \"port\":993,\"useTls\":true,\"username\":\"dmarc@yourdomain.com\",
       \"password\":\"…\",\"defaultClientId\":\"$CLIENT\",\"isActive\":true}" \
  | jq -r .id)

curl -s -b /tmp/cj -X POST "$BASE/api/v1/mailbox-sources/$SOURCE/sync"
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

## The full route list

There are 57 routes under `/api/v1`, plus the unauthenticated `/health/live` and
`/health/ready` probes. This page covers the mechanics rather than enumerating
them, because a second copy of a route list is a second thing to go stale.

The canonical list is
[`http/api.http`](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/http/api.http)
in the application repository — a runnable request file with a worked example of
every endpoint, kept in step with the code. Grouped by area, those routes cover
authentication and OIDC, clients, domains, users and grants, mailbox sources with
their sync runs and health, alerts and notification recipients, nine analytics
reads, and `/admin/*` for the audit trail, backup and configuration
export/import, retention, the digest, and database migration.

Most of them are already documented in context elsewhere in these docs —
[monitoring](/docs/monitoring/#watching-ingestion--the-check-that-matters) for
mailbox health, [configuration](/docs/configuration/#who-gets-notified) for alerts
and recipients, and [upgrading and backup](/docs/upgrading-and-backup/#retention)
for retention and the configuration export.
