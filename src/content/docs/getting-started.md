---
title: First steps
description: After installing, set up a client, a domain, and a mailbox source, publish a DMARC record, and learn what to expect as the first reports arrive.
section: Getting started
order: 2
publishDate: 2026-07-25
updatedDate: 2026-07-27
---

You have the console open and an administrator account. This page takes you from
an empty install to reports flowing in.

## 1. Create a client

Everything in DMARC Analyzer hangs off a **client** — the organisation whose
domains you're monitoring. If you're an agency or MSP, you'll have one per
customer; if you're monitoring only your own domains, create a single client for
yourself.

**Clients → New client.** The slug is used in URLs and must be unique. Retention
defaults to 27 months.

## 2. Add a domain

**Domains → New domain**, and assign it to your client.

Domains are **globally unique** across the whole installation: a domain belongs to
exactly one client. That's deliberate — DMARC reports are addressed to a domain,
so allowing two clients to claim the same one would make report routing
ambiguous.

## 3. Publish a DMARC record

If the domain has no DMARC record yet, publish one in monitoring mode so reports
start arriving. Add a `TXT` record at `_dmarc.yourdomain.com`:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` changes nothing about how your mail is treated — it only asks receivers
to send reports. Point `rua=` at the mailbox you'll connect in the next step. Our
[publish your first DMARC record](/guides/publish-your-first-dmarc-record/) guide
covers this in more depth, and there are per-provider walkthroughs under
[DMARC setup](/dmarc-for/).

## 4. Connect the mailbox

**Mailbox sources → New mailbox source** with the IMAP details for the inbox
receiving those `rua=` reports. See [connecting a mailbox](/docs/mailbox-setup/)
for provider specifics, app passwords, and the "default client" setting.

## 5. Wait for reports

Reports arrive **once a day per receiving provider**, so expect the first ones
roughly 24 hours after publishing your record — not immediately. The worker polls
every 60 minutes by default; you can also trigger a sync by hand from the mailbox
source list.

On the first sync the worker backfills the mailbox from the **oldest** message
forward, checkpointing as it goes, so a mailbox with years of history gets
imported without you doing anything.

## What you'll see once data lands

- **Dashboard** — compliance rate, volume trend, and the domains that need
  attention.
- **Domains** — every domain with its published policy and enforcement posture.
- **Domain detail** — per-sending-source breakdown, who's reporting, the guided
  path to enforcement, and record inspection comparing your live DNS against what
  reporters observed.
- **Threats** — sources sending mail as your domains that failed both SPF and DKIM.

Each screen — including what the status labels like *Spoofing* actually mean —
is documented in [Using the console](/docs/using-the-console/).

Analytics windows anchor to your **newest report**, not to today's date. If a
mailbox is backfilling old data, "last 30 days" means the 30 days before the most
recent report you have — otherwise a historical import would look empty.

## Then: move toward enforcement

Monitoring alone doesn't stop spoofing. Once every legitimate sender passes, walk
the policy from `none` to `quarantine` to `reject` — the Domain detail page
recommends your next safe step and lists the sources still blocking it. The
[monitoring to enforcement](/guides/from-monitoring-to-enforcement/) guide explains
the process.
