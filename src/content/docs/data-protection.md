---
title: Data protection and GDPR
description: What personal data DMARC reports actually contain, where it lives in a self-hosted install, and how retention, legal hold and erasure work in practice.
section: Operations
order: 5
---

DMARC monitoring processes personal data — less than most people fear, more
than none. This page maps what the software actually does to the questions a
GDPR review asks, so you can write your own records of processing and, if you
run it for clients, your DPA. **It describes the software's behaviour; it is
not legal advice.**

## What an aggregate report contains

[Aggregate reports](/glossary/dmarc-aggregate-report/) are statistical: per
sending **IP address**, how many messages claimed your domain and how
authentication went. **No message content, no subject lines, no recipient
addresses** — the reports never contain them.

The IP addresses are the reason this page exists: IP addresses count as
personal data under GDPR, so the report database should be treated as holding
personal data even though it holds no mail.

Two deliberate boundaries help here: the app does not ingest **forensic (RUF)
reports** — the report type that *can* carry message content and headers — and
SMTP TLS reports that share the mailbox are recognised and skipped. What you
store is the statistical layer only.

## Where data lives, and where it goes

Everything is in **one PostgreSQL database on your infrastructure**, plus
whatever backups you take of it. The software's vendor is not in the picture:
nothing is sent to us, there is no telemetry, and the console self-hosts its
assets — so for this tool there is **no sub-processor to name and no
international transfer** beyond where you choose to deploy and back up.

Outbound connections, exhaustively: IMAP to the mailboxes you configured, DNS
lookups for published policies, SMTP to your relay if you enable alert or
digest email, and HTTPS to your identity provider if you enable
[SSO](/docs/single-sign-on/).

## The personal-data inventory

| Data | Where | Notes |
|---|---|---|
| Sending-server IP addresses | report records | The bulk of the data; aged out by [retention](#retention-and-erasure) |
| Operator accounts | `agency_user` | Name, email, salted password hash |
| Sessions | `user_session` | Includes sign-in **IP and user agent**; expired rows persist until [pruned](/docs/monitoring/) |
| SSO identity links | `user_identity` | Issuer + subject only; no tokens stored |
| Audit trail | `audit_event` | Actor email, **IP and user agent** per entry |
| Notification recipients | `notification_recipient` | Email addresses you added |
| Mailbox credentials | `mailbox_source` | Encrypted at rest with AES-256-GCM; the shipped Compose files and Helm chart refuse to start without the key — see [security](/docs/security/) |

## Retention and erasure

- **Report data** ages out per client — **27 months by default**, configurable
  per client in the console. A daily pass deletes what has aged past the
  window, measured against the report's own date. Purging is **deletion, not
  archival**: nothing is copied elsewhere first. Details under
  [retention](/docs/upgrading-and-backup/#retention).
- **Legal hold**, per client, suspends purging entirely for a dispute or
  investigation — the preservation side of the same obligation.
- **The audit trail** ages out separately (two years by default, `0` keeps it
  indefinitely) and is deliberately exempt from legal hold — it is a
  compliance record of the install itself.

**Erasure requests, honestly.** Faster-than-retention deletion has no button
today: there is no delete endpoint for a client or a domain. The supported path
is to lower the client's retention window and run the purge (an admin can
[trigger and preview it](/docs/upgrading-and-backup/#previewing-and-running-it-manually));
anything more surgical is a SQL operation against your own database — which, in
a self-hosted install, you can actually do. Remember that **your backups are
copies of the same data**: an erasure story that ignores backup rotation is
incomplete.

## If you run this for clients

You are processing report data on your clients' behalf, so the
controller/processor relationship is between **you and each client** — this
software adds no third party to that chain, which is precisely the
self-hosting argument. For your Art. 30 records, the shape is: purpose —
email authentication monitoring and spoofing prevention; categories — sending
server IP addresses and authentication outcomes; retention — the per-client
window you configured; recipients — none beyond your own infrastructure and
the notification emails you set up.

Give clients read access through a [`client_viewer`
account](/docs/clients-users-and-audit/) scoped to their own data rather than
exports — cross-tenant access fails closed, returning 404 for anything not
granted.
