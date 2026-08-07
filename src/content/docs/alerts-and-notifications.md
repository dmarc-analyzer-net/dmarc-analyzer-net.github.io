---
title: Alerts and notifications
description: The two alert rules and their thresholds, how triage works, why an alert wasn't emailed, and how recipients and the monthly digest are configured.
section: Using the console
order: 5
publishDate: 2026-07-27
---

## The two rules

The worker evaluates alerts hourly, against report data rather than the wall
clock — so a backfilling mailbox doesn't fire spurious alerts about "missing"
recent mail.

**Failure spike** — a client's compliance dropped against its own baseline (the
previous 7 days). Fires at a **15-point** drop by default, but only once the
window holds at least **100 messages**, so a single failing message on a quiet
domain can't page anyone. A drop of twice the threshold escalates the severity
from *warning* to *critical*.

**Policy regression** — a domain's published DMARC policy got *weaker*:
`reject` became `quarantine`, or either became `none`. Weakening to `none` is
*critical* — enforcement is off; anything else is a *warning*. This is the alert
that catches an accidental DNS edit, which is why it's worth having even before
you care about compliance numbers.

Both thresholds can be overridden **per client** (edit the client), and a client
that fired recently won't fire again for the same condition within **24 hours**
— the cooldown that stops a flapping domain from sending forty emails.

## Triage

The Alerts screen lists recent alerts with severity, client, and an **Emailed**
column. Each alert cycles **open → acknowledged → closed**, with *Reopen* to
pull one back. Acknowledging is the useful middle state: seen, being handled,
stop counting it as new.

**Emailed: no** on a real alert means delivery wasn't possible — either no
[recipient](#recipients) covers that client, or SMTP isn't configured. The alert
still exists either way; email is a copy, not the record. Admins can also run
the evaluation on demand with **Evaluate now** rather than waiting for the
hourly pass.

## Recipients

The Notifications screen controls who gets email. Each recipient is an address
plus a scope and a kind:

- **Scope** — one client, or agency-wide (leave the client blank) to receive for
  every client.
- **Kind** — *Alerts only*, *Digest only*, or *Alerts + digest*.

The same address can't be added twice for the same scope. The **test email**
button sends through your configured relay and tells you immediately whether
SMTP works — use it before wondering why a digest never arrived.

## The monthly digest

Once a month (on or after the 1st, by default) each client with a digest
recipient gets a plain-language summary email of the previous calendar month —
volume, compliance, and what changed. Sending is idempotent: one digest per
client per month, however often the worker checks.

None of this leaves the building until SMTP is configured — host, port, from
address. Alerts and digests are silently email-less without it, which is the
most common "notifications don't work" cause. Settings and the delivery
checklist are in the [configuration
reference](/docs/configuration/#who-gets-notified), and the operator's side —
alerting on the service itself rather than on DMARC data — is in
[monitoring](/docs/monitoring/).
