---
title: Publish your first DMARC record
description: A safe, five-minute walkthrough to publish a monitoring-mode DMARC record and start collecting reports without risking a single legitimate email.
publishDate: 2026-07-10
---

Publishing DMARC sounds risky — you are, after all, telling the world's mail
servers how to treat your email. It isn't, as long as you start in **monitoring
mode**. This guide gets you collecting data today without affecting delivery.

## Step 1 — Make sure SPF and DKIM exist first

DMARC is built on [SPF](/glossary/spf) and [DKIM](/glossary/dkim). Before
publishing DMARC, confirm both are set up for your sending sources (your email
provider, marketing platform, ticketing system, and so on). DMARC with neither
in place will simply report failures for everything.

## Step 2 — Choose a mailbox for reports

[Aggregate reports](/glossary/dmarc-aggregate-report) arrive as email
attachments. Pick or create a mailbox to receive them, e.g.
`dmarc@yourdomain.com`. High-volume domains generate a lot of these, so a
dedicated mailbox — pointed at an analyzer like [DMARC Analyzer](/) — is worth it.

## Step 3 — Publish the record

Add a `TXT` record at `_dmarc.yourdomain.com`:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

That is the whole thing. `p=none` is the [policy](/glossary/dmarc-policy) that
means "monitor only" — no message is quarantined or rejected. `rua=` is where
reports are sent.

## Step 4 — Wait for reports

Reports start arriving within about 24 hours, one per provider per day. Each one
lists every source sending as your domain and whether it
[aligned](/glossary/dmarc-alignment). Resist the urge to tighten the policy yet.

## What next

Give it a couple of weeks, then learn to
[read the reports](/guides/how-to-read-a-dmarc-aggregate-report) and plan your
[path to enforcement](/guides/from-monitoring-to-enforcement).
