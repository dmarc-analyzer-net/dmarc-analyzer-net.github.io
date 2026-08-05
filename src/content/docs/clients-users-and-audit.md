---
title: Clients, users and audit
description: Managing tenants and accounts — retention and legal hold per client, the three roles and per-client grants, the audit trail, and onboarding a client end to end.
section: Using the console
order: 6
---

## Clients

A client is a tenant: every domain belongs to exactly one, and everything a
`client_viewer` can see is scoped by it. Per client you set:

- **Retention** — how many months of report data to keep; **27 by default**. A
  daily pass deletes data older than the window, measured against the report's
  own date, and deletion is not archival — see
  [retention](/docs/upgrading-and-backup/#retention).
- **Legal hold** — exempts the client from purging entirely, for a dispute or
  investigation. Retention resumes when you clear it.
- **Alert thresholds** — per-client overrides for the [two alert
  rules](/docs/alerts-and-notifications/), or alerts off for this client. When
  editing, a blank threshold means *keep the current value*; use the explicit
  clear option to fall back to the global defaults.
- **Active** — an inactive client stays in the data but drops out of the
  day-to-day views.
- **Timezone** — recorded against the client today, but schedules and analytics
  currently run in UTC regardless; don't expect it to move the digest.

The slug is a short identifier, lower-cased automatically and unique across
clients.

## Users and roles

| Role | Gets |
|---|---|
| `agency_admin` | Everything, including Users, Audit, and the admin API |
| `agency_analyst` | The working screens — analytics, clients, mailboxes, notifications, alert triage — but no user admin |
| `client_viewer` | Dashboard, Domains, Threats and Alerts, read-only, **only for granted clients** |

Creating a user takes a display name, email, role and a password of at least
ten characters. For a `client_viewer`, the edit dialog has the checkbox list of
client grants — no grants means they sign in and see nothing, so grant first,
share credentials second. Admins reset passwords from the same dialog.

Deactivating an account (same dialog) is usually the better call over deleting
it — audit history stays attributable to a name rather than a row that no
longer exists. Delete is there for when you actually want the account gone:
it refuses to remove your own account or the last active `agency_admin`, and
their sessions, SSO identity links, and client grants are removed with them —
audit entries are not, they keep the email on record independently of whether
the account still exists.

Two habits worth keeping: give clients `client_viewer` and promote deliberately
— cross-tenant requests 404 by design, so a viewer cannot enumerate other
clients even by guessing IDs. And if you enable [SSO](/docs/single-sign-on/),
keep one local `agency_admin` password as the way back in.

## The audit trail

Admin-only and read-only: sign-ins and failures, client/domain/mailbox/user
changes, grant changes, alert triage, manual syncs, schema migrations — with
actor, IP and timestamp. Filter by period, activity type, client, or actor;
rows expand for detail. Entries age out after two years by default,
independently of client retention and unaffected by legal hold.

## Onboarding a client, end to end

1. **Create the client** — name, slug; set retention and alert thresholds now if
   they differ from your defaults.
2. **Add their domains** and assign them to the client — *before* their reports
   start arriving, or [auto-created
   domains](/docs/dashboard-and-domains/#adding-domains--and-why-some-appear-on-their-own)
   will file under the mailbox's default client.
3. **Point their DMARC records** at your mailbox — `rua=` in each domain's
   record, plus the [external-destination authorization
   record](/guides/dmarc-multiple-client-domains/) since your mailbox is on a
   different domain than theirs.
4. **Add a digest recipient** scoped to the client, kind *Digest only* — that's
   the monthly email they'll actually read.
5. **Optionally create a `client_viewer`** granted to just this client, so they
   can log in and see their own dashboard.
6. Reports appear after the next mailbox sync; expect the first ones from large
   receivers within a day or two of the DNS change.
