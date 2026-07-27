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

Everything the app **stores** is in one PostgreSQL database on your
infrastructure. That is not the whole picture, and it is worth being precise
about: the **mailbox** the reports arrived in holds the same report data for as
long as your provider keeps it, and if you enable [backup
offload](/docs/upgrading-and-backup/#the-configuration-export) an
**object-storage bucket** holds a third copy — plus whatever database dumps you
take. All of it is infrastructure you own, and all of it is in the inventory
below.

The software's vendor is not in the picture: nothing is sent to us, there is no
telemetry, and the console self-hosts its assets — so **this tool adds no
sub-processor of its own**. What you choose around it still counts: a mailbox at
a hosted provider and a bucket at a cloud provider are processors you name in
your own records, and possibly international transfers.

Outbound connections, exhaustively: IMAP to the mailboxes you configured, DNS
lookups for published policies, SMTP to your relay if you enable alert or
digest email, HTTPS to your identity provider if you enable
[SSO](/docs/single-sign-on/), and HTTPS to your object-storage endpoint if you
enable backup offload. Object storage is the fifth, and the newest — a list is
only worth calling exhaustive if it is kept that way.

## The personal-data inventory

Three locations, not one: the database, the mailbox, and — once you enable it —
the backup bucket. Each has its own window.

| Data | Where | Notes |
|---|---|---|
| Sending-server IP addresses | report records | The bulk of the data; aged out by [retention](#retention-and-erasure) |
| The same IPs and outcomes, in the mail they arrived in | **your IMAP mailbox** | Ingestion only reads, so by default this copy outlives the retention window that governs the database. Bounded by enabling mailbox retention deletion per source — see [the mailbox copy](#the-mailbox-copy) |
| Operator accounts | `agency_user` | Name, email, salted password hash |
| Sessions | `user_session` | Includes sign-in **IP and user agent**; expired rows persist until [pruned](/docs/monitoring/) |
| SSO identity links | `user_identity` | Issuer + subject only; no tokens stored |
| Audit trail | `audit_event` | Actor email, **IP and user agent** per entry |
| Notification recipients | `notification_recipient` | Email addresses you added |
| Mailbox credentials | `mailbox_source` | Encrypted at rest with AES-256-GCM; the shipped Compose files and Helm chart refuse to start without the key — see [security](/docs/security/) |
| A copy of most of the rows above | **your object-storage bucket**, if you enable [backup offload](/docs/upgrading-and-backup/#offloading-it-to-object-storage) | Configuration, operator accounts with their hashes, encrypted mailbox credentials, the audit trail — and the report mail itself if you turn the report archive on. Expiry is whatever lifecycle rule you put on the bucket; the app never deletes objects. See [archive and erasure](#archive-and-erasure-pull-in-opposite-directions) |

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

Those three describe **the database**. The other two locations are governed
separately, and the daily purge does not touch either of them.

### The mailbox copy

Ingestion only ever reads: it sets no flags on the mail it parses and expunges
nothing, which is deliberate — it is what lets a rebuild replay the mailbox. The
cost is that by default the mail those reports arrived in stays where it is,
carrying the same sending IPs and authentication outcomes, long after the database
purged the reports built from it. The window you configure in the console
describes the database; the mailbox is a second copy with no window at all.

**Mailbox retention deletion closes that, per source and off by default.** With it
on, the worker deletes report mail that has aged past the retention window, so the
system has one window instead of two. It is the only pass that deletes data the
app does not own, which is why it is hedged:

- The cutoff is the **widest** retention window among the clients that source
  serves. One mailbox can receive reports for several clients, so the narrowest
  window never gets to decide.
- Plus a **grace margin** on top of that window — `Worker__MailboxRetentionGraceDays`,
  30 days by default — so a clock skew, a paused worker or a mid-incident change to
  a retention window cannot destroy mail the database has not re-read.
- **Legal hold suspends it entirely** for that source: if any client the source
  serves is on hold, the pass deletes nothing and names the client that stopped it.
  A database exemption is worthless while the upstream copy is being deleted.
- If the [report archive](/docs/upgrading-and-backup/#offloading-it-to-object-storage)
  is enabled, a message is deleted only after its copy exists in the bucket.
- Deletion is by the message's own date, so mail that never parsed ages out too,
  and every pass is audited.

An admin can see exactly what the next pass would do, per source, without deleting
anything:

```bash
curl https://dmarc.example.com/api/v1/admin/mailbox-retention/preview
```

It reports every source, including the ones that will do nothing — a preview that
hid the suspended sources could not answer "why is that mailbox still growing?"

### Archive and erasure pull in opposite directions

[Backup offload](/docs/upgrading-and-backup/#offloading-it-to-object-storage)
writes configuration and history to your bucket on a schedule and, if you turn
the report archive on, a copy of each report mail as it is ingested. Objects are
written once and the app never deletes them, so the window on that copy is
whatever lifecycle rule you put on the bucket prefix — there is no application
setting that expires it.

Worth stating plainly rather than discovering later: **continuity and erasure are
opposing goals.** An operator running the report archive keeps report data past
the point the database dropped it, so their erasure horizon is the longest of the
three locations. That is a legitimate trade for a business that needs the history;
it is also one to record in your own retention documentation and bound with a
lifecycle rule, not one to leave running unexamined.

### Erasure requests, honestly

Faster-than-retention deletion has no button today: there is no delete endpoint
for a client or a domain. The supported path
is to lower the client's retention window and run the purge (an admin can
[trigger and preview it](/docs/upgrading-and-backup/#previewing-and-running-it-manually));
anything more surgical is a SQL operation against your own database — which, in
a self-hosted install, you can actually do. **A purge clears the database only,
though.** While the original mail is still in the mailbox the next sync brings the
same reports straight back — which is what [mailbox retention
deletion](#the-mailbox-copy) is for, and why an erasure request has to reach every
location that holds a copy: the database, the mailbox, and the bucket if you
offload. Your backups are copies of the same data too — an erasure story that
ignores backup rotation is incomplete.

## If you run this for clients

You are processing report data on your clients' behalf, so the
controller/processor relationship is between **you and each client** — this
software adds no third party to that chain, which is precisely the
self-hosting argument. For your Art. 30 records, the shape is: purpose —
email authentication monitoring and spoofing prevention; categories — sending
server IP addresses and authentication outcomes; retention — the per-client
window you configured, plus whatever your mailbox and, if you offload, your
bucket keep; recipients — none beyond your own infrastructure, the notification
emails you set up, and your mail and storage providers.

Give clients read access through a [`client_viewer`
account](/docs/clients-users-and-audit/) scoped to their own data rather than
exports — cross-tenant access fails closed, returning 404 for anything not
granted.
