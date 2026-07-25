---
title: Set up SPF, DKIM & DMARC on GoDaddy
provider: GoDaddy
description: How to add SPF, DKIM, and DMARC records in GoDaddy DNS — with the right values for GoDaddy-hosted Microsoft 365 email and the GoDaddy UI gotchas.
publishDate: 2026-07-23
---

GoDaddy is usually your **DNS host and registrar**, not your email sender — so
the exact SPF and DKIM values depend on *who actually sends your mail*. Most
GoDaddy customers use **Microsoft 365** (GoDaddy resells it as "Professional
Email"), so that's the common case below. The DMARC part is the same regardless.

## Where to edit records

In your GoDaddy account: **Domain Portfolio → your domain → DNS → DNS Records**.
For the root domain, GoDaddy uses **`@`** in the *Name* field. Never type your
domain into the *Name* — GoDaddy appends it automatically.

## 1. SPF

Add one [SPF](/glossary/spf/) `TXT` record. For GoDaddy-hosted Microsoft 365:

```
Type: TXT   Name: @   Value: v=spf1 include:spf.protection.outlook.com -all
```

Using Google Workspace instead? Use `include:_spf.google.com`. Either way,
combine multiple senders into a **single** record — see [SPF record
syntax](/guides/spf-record-syntax/).

## 2. DKIM

[DKIM](/glossary/dkim/) values come from your **email provider**, not GoDaddy —
you just publish them in GoDaddy DNS. For Microsoft 365, add the two selector
CNAMEs Microsoft gives you:

```
Type: CNAME   Name: selector1._domainkey   Value: selector1-...onmicrosoft.com
Type: CNAME   Name: selector2._domainkey   Value: selector2-...onmicrosoft.com
```

Then enable DKIM signing in the Microsoft Defender portal (publishing the CNAMEs
alone doesn't sign). For Google Workspace, add the single `google._domainkey`
`TXT` record and click *Start authentication*.

## 3. DMARC

Add a [DMARC](/glossary/dmarc/) `TXT` record in GoDaddy DNS:

```
Type: TXT   Name: _dmarc   Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Start at [`p=none`](/glossary/dmarc-policy/) and only tighten once
[reports](/glossary/dmarc-aggregate-report/) are clean.

## GoDaddy-specific gotchas

- **Check for a duplicate SPF record** — GoDaddy sometimes pre-populates one.
  Two SPF records is a `permerror` and a [DMARC
  failure](/guides/fix-dmarc-failure/). Edit the existing one instead of adding a
  second.
- **Use `@` for the root** and the short subdomain (`_dmarc`,
  `selector1._domainkey`) in *Name* — don't include the full domain.
- **TTL / propagation** — GoDaddy changes can take up to an hour (sometimes
  longer) to take effect.
- **Confirm your actual sender** — if mail flows through a marketing platform,
  its SPF/DKIM must be added too, not just Microsoft's or Google's.

## What next

Once records propagate, [read your aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/) to confirm every sender
aligns, then follow the [path to
enforcement](/guides/from-monitoring-to-enforcement/).
