---
title: Set up SPF, DKIM & DMARC on GoDaddy
provider: GoDaddy
description: How to add SPF, DKIM, and DMARC records in GoDaddy DNS — the right values for each GoDaddy email product, plus the GoDaddy UI gotchas that break setups.
publishDate: 2026-07-23
updatedDate: 2026-07-25
---

GoDaddy is usually your **DNS host and registrar**, not your email sender — so
the correct SPF and DKIM values depend entirely on *who actually sends your
mail*. Get that wrong and everything downstream fails, so start there. The DMARC
part is the same regardless.

## First: which email product do you actually have?

GoDaddy sells two different mailbox products, and they need different SPF
values. People mix them up constantly.

| What you bought | SPF `include:` |
|---|---|
| **Professional Email** (GoDaddy's own) | `include:secureserver.net` |
| **Microsoft 365 from GoDaddy** (resold Exchange Online) | `include:spf.protection.outlook.com` |
| Google Workspace, with GoDaddy as DNS only | `include:_spf.google.com` |

Check which one you have in your GoDaddy account before copying any record
below. If you migrated from Professional Email to Microsoft 365 at some point,
the old `secureserver.net` include is probably still sitting in your record.

## Where to edit records

In your GoDaddy account: **Domain Portfolio → your domain → DNS → DNS Records**.

For the root domain, GoDaddy uses **`@`** in the *Name* field. Never type your
domain into *Name* — GoDaddy appends it automatically, so entering
`_dmarc.yourdomain.com` creates a record at `_dmarc.yourdomain.com.yourdomain.com`
that will never be found. This is the single most common GoDaddy mistake.

## 1. SPF

Add one [SPF](/glossary/spf/) `TXT` record using the include from the table
above. For Microsoft 365 from GoDaddy:

```
Type: TXT   Name: @   Value: v=spf1 include:spf.protection.outlook.com -all
```

For GoDaddy's own Professional Email:

```
Type: TXT   Name: @   Value: v=spf1 include:secureserver.net -all
```

Sending from more than one service? Combine them into a **single** record —
never two. Here with a marketing platform alongside Microsoft 365:

```
v=spf1 include:spf.protection.outlook.com include:sendgrid.net -all
```

What *not* to do is stack two mailbox providers. If you migrated from Professional
Email to Microsoft 365, a record carrying both
`include:spf.protection.outlook.com` and `include:secureserver.net` authorises
GoDaddy's entire shared mail infrastructure to send as your domain — every tenant
on it, not just you. Remove the include for the service you no longer use.

Two SPF records is a `permerror`, which counts as an SPF failure. See [SPF
record syntax](/guides/spf-record-syntax/) for the 10-lookup limit and how to
stay under it.

## 2. DKIM

[DKIM](/glossary/dkim/) values come from your **email provider**, not GoDaddy —
you just publish them in GoDaddy DNS.

**Microsoft 365 from GoDaddy** uses two [selector](/glossary/dkim-selector/)
CNAMEs, and signing stays off until you enable it in the Microsoft Defender
portal:

```
Type: CNAME   Name: selector1._domainkey   Value: (from the Defender portal)
Type: CNAME   Name: selector2._domainkey   Value: (from the Defender portal)
```

Read the exact targets from the portal rather than guessing — Microsoft changed
the CNAME format for new domains in May 2025, so old templates are wrong. Full
detail in [set up SPF, DKIM & DMARC for Microsoft
365](/dmarc-for/microsoft-365/).

**Google Workspace** uses a single `TXT` record at `google._domainkey`, then
*Start authentication* in the Admin console — see [DMARC for Google
Workspace](/dmarc-for/google-workspace/).

**Professional Email** manages DKIM from GoDaddy's own email settings; check
there rather than adding records by hand.

## 3. DMARC

Add a [DMARC](/glossary/dmarc/) `TXT` record in GoDaddy DNS:

```
Type: TXT   Name: _dmarc   Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Note the *Name* is just `_dmarc`, not `_dmarc.yourdomain.com`. Start at
[`p=none`](/glossary/dmarc-policy/) and only tighten once
[reports](/glossary/dmarc-aggregate-report/) are clean.

## Verify it worked

GoDaddy's own UI will happily show a record that resolves differently than you
expect, so check from outside:

```
dig +short TXT yourdomain.com
dig +short TXT _dmarc.yourdomain.com
```

If `_dmarc` returns nothing, the doubled-domain mistake above is the first thing
to rule out:

```
dig +short TXT _dmarc.yourdomain.com.yourdomain.com
```

A result there tells you exactly what went wrong.

## GoDaddy-specific gotchas

- **Check for a duplicate SPF record first.** GoDaddy sometimes pre-populates
  one, and parked or newly registered domains often ship with a default. Edit
  the existing record instead of adding a second — two is a `permerror` and a
  [DMARC failure](/guides/fix-dmarc-failure/).
- **Use `@` for the root** and the short subdomain (`_dmarc`,
  `selector1._domainkey`) in *Name*.
- **Domain forwarding does not touch your DMARC record**, despite being the usual
  suspect. Enabling it updates and *locks* the root `@` A record, and asks you to
  point the `www` CNAME at `@` — both about web traffic. Your DMARC, SPF and DKIM
  records are `TXT` and `CNAME` entries at other names, and forwarding leaves them
  alone. So if a record you added has "vanished", check the doubled-domain mistake
  above before blaming forwarding.
- **TTL and propagation** — GoDaddy changes can take up to an hour, occasionally
  longer. Don't conclude a record is wrong within the first few minutes.
- **Confirm your actual sender.** If mail also flows through a marketing
  platform or your website's contact form, those senders need SPF and DKIM too —
  they're the usual source of unexplained failures in your first reports.

## Common failures and what they mean

| Symptom | Usual cause |
|---|---|
| DMARC record "not found" | *Name* included the domain, creating a doubled hostname |
| `spf=permerror` | Two SPF records — often a leftover GoDaddy default |
| SPF passes for some mail, fails for the rest | A second sender missing from the record |
| Records vanish after a while | Domain forwarding managing the root |
| Everything looks right but no reports arrive | `rua=` mailbox doesn't exist or rejects mail |

Agencies with a portfolio of GoDaddy-hosted clients hit the same five problems
on repeat, one domain at a time. Aggregating every client's reports in one place
is what [DMARC Analyzer](/) does — self-hosted, unlimited domains, no
per-domain fee.

## What next

Once records propagate, [read your aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/) to confirm every sender
aligns, then follow the [path to
enforcement](/guides/from-monitoring-to-enforcement/).
