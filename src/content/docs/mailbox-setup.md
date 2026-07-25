---
title: Connecting a mailbox
description: Point DMARC Analyzer at the inbox your rua= reports arrive in — IMAP settings, app passwords, how domains are auto-created, and how backfill works.
section: Configuration
order: 2
---

DMARC aggregate reports arrive as email attachments. DMARC Analyzer reads them
from an IMAP mailbox you control — it never needs inbound SMTP.

## Choosing a mailbox

Use a **dedicated** mailbox or alias, e.g. `dmarc@yourdomain.com`, and put it in
your DMARC record's `rua=` tag. A busy portfolio generates a lot of mail, and
mixing it with a human inbox makes both worse.

One mailbox can serve many domains and many clients — every report says which
domain it's about, so you don't need one inbox per domain.

## Adding it

**Mailbox sources → New mailbox source**:

| Field | Notes |
|---|---|
| Name | Free text for your own reference. |
| Host / Port | IMAP server, usually port `993`. |
| TLS | Leave enabled. |
| Username / Password | See app passwords below. |
| Default client | Which client owns domains that get auto-created from this mailbox (below). |

Only **IMAP** is supported today; POP3 is on the roadmap.

## App passwords

Most providers won't accept your normal password from a third-party client:

- **Google Workspace / Gmail** — enable 2-Step Verification, then create an
  [App Password](https://support.google.com/accounts/answer/185833). Host
  `imap.gmail.com`, port `993`. IMAP must be enabled for the account.
- **Microsoft 365 / Outlook** — IMAP with basic auth is disabled on many tenants.
  If your tenant permits it, use an app password; otherwise use a mailbox on
  another provider for now. (OAuth via Microsoft Graph is on the roadmap.)
- **Anything else** — standard IMAP credentials are fine.

Passwords are encrypted at rest with AES-256-GCM using
[`Security__CredentialEncryptionKey`](/docs/configuration/#security).

## Your mail is never modified

Mailbox processing is strictly **read-only**. The sync never deletes, moves, or
marks messages, so pointing the analyzer at a mailbox you also archive elsewhere
is safe. Progress is tracked by IMAP UID checkpoints rather than by changing
message state.

## Auto-created domains and the "default client"

When a report arrives for a domain the system doesn't know about, that domain is
**created automatically** and assigned to this mailbox's *default client*. This is
what makes onboarding painless — publish a record, and the domain appears once
reports flow.

Two consequences worth knowing:

- Pick the default client deliberately. If one mailbox collects reports for many
  customers, new domains all land under that one client until you move them.
- Domains are globally unique, so a domain already claimed by another client is
  not re-assigned.

## Backfill

The first sync walks the mailbox **oldest message first**, checkpointing as it
goes, so years of history import without intervention. It processes
`Worker__MaxMessagesPerSync` messages per pass (200 by default) — raise it
temporarily to speed up a large initial import.

Duplicate reports are ignored: the same report arriving twice, or via two
mailboxes, is deduplicated on domain + report ID + date range.

## Checking it worked

- **Mailbox sources** lists each source with the outcome of its most recent sync.
  Filters cover failed runs, parse failures, and stale successes.
- **Sync history** shows per-run counters: messages scanned, attachments
  processed, reports inserted, duplicates skipped, parse failures.
- Impatient? Trigger a sync by hand from the mailbox source list rather than
  waiting for the next hourly pass.

If nothing appears, see [troubleshooting](/docs/troubleshooting/).
