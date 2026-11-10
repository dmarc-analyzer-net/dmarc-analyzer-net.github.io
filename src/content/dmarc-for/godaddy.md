---
title: Set up SPF, DKIM & DMARC on GoDaddy
provider: GoDaddy
description: How to add SPF, DKIM, and DMARC records in GoDaddy DNS — the right values for each GoDaddy email product, plus the GoDaddy UI gotchas that break setups.
publishDate: 2026-07-23
updatedDate: 2026-11-10
---

To set up SPF, DKIM and DMARC on GoDaddy, first identify your **email sender**.
GoDaddy may host only your DNS, or it may also supply your mailboxes. Publish
SPF and DKIM records for the service that sends your mail, then add DMARC at
`_dmarc` to monitor authentication before enforcing a policy.

## First: which email product do you actually have?

Check the product name in your Email & Office Dashboard. GoDaddy's
[SPF instructions](https://www.godaddy.com/en-ca/help/add-an-spf-record-to-my-domain-for-my-email-40499)
give the same default for its two mailbox products; an email security add-on
can change what you need.

| Email service | SPF `include:` |
|---|---|
| **Professional Email**, including powered by Titan | `include:secureserver.net` |
| **Microsoft 365 from GoDaddy**, without Advanced Email Security | `include:secureserver.net` (GoDaddy's documented default) |
| **Microsoft 365 from GoDaddy with Advanced Email Security** | Copy the value from your Email & Office Dashboard |
| Microsoft 365 bought directly, with GoDaddy as DNS only | `include:spf.protection.outlook.com` |
| Google Workspace, with GoDaddy as DNS only | `include:_spf.google.com` |

## Where to edit records

In your GoDaddy account: **Domain Portfolio → your domain → DNS → DNS Records**.

That is the right place only if GoDaddy is actually answering DNS for the domain.
Plenty of GoDaddy-registered domains have their nameservers pointed at
[Cloudflare](/dmarc-for/cloudflare/) or another host, in which case records added
here do nothing at all — check which nameservers the domain uses before wondering
why a correct record never resolves.

For the root domain, GoDaddy uses **`@`** in the *Name* field. Never type your
domain into *Name* — GoDaddy appends it automatically, so entering
`_dmarc.yourdomain.com` creates a record at `_dmarc.yourdomain.com.yourdomain.com`
that will never be found. Use the short hostname when adding a record.

## 1. SPF

Publish one [SPF](/glossary/spf/) record ([RFC 7208](/rfc/7208/)) at the
root domain. If a `v=spf1` TXT record already exists, edit it instead of adding
a second. For Professional Email or Microsoft 365 from GoDaddy without
Advanced Email Security, GoDaddy documents:

```
Type: TXT   Name: @   Value: v=spf1 include:secureserver.net -all
```

For Microsoft 365 bought directly, with GoDaddy hosting only DNS:

```
Type: TXT   Name: @   Value: v=spf1 include:spf.protection.outlook.com -all
```

GoDaddy's include covers more than Exchange Online. If you want to narrow it
to Microsoft's include, first confirm that all your outgoing mail uses
Exchange Online and that no GoDaddy relay or security gateway still sends for
you. Remove an old provider only after its mail has moved.

Sending from more than one service? Combine the required mechanisms into a
**single** SPF record. Use each sender's instructions: a marketing platform
may use its own Return-Path domain, so adding its include to your root record
alone will not make SPF align with your visible `From:` address. Configure a
custom Return-Path or aligned DKIM as the platform supports.

Two SPF records produce `permerror`. DMARC can still pass if a DKIM signature
verifies and aligns. Use the [SPF checker](/tools/spf-checker/) to inspect the
record, then see [SPF record syntax](/guides/spf-record-syntax/) for the
10-lookup limit.

## 2. DKIM

[DKIM](/glossary/dkim/) values come from your **email provider**, not GoDaddy —
you just publish them in GoDaddy DNS.

**Microsoft 365 from GoDaddy** uses two [selector](/glossary/dkim-selector/)
CNAMEs. Enable signing for your custom domain in the Microsoft Defender
portal after publishing them:

```
Type: CNAME   Name: selector1._domainkey   Value: (from the Defender portal)
Type: CNAME   Name: selector2._domainkey   Value: (from the Defender portal)
```

Read the exact targets from the portal rather than guessing — Microsoft changed
the CNAME format for new domains in May 2025; existing domains may still use
the older format. Full detail in [set up SPF, DKIM & DMARC for Microsoft
365](/dmarc-for/microsoft-365/).

With **Advanced Email Security**, also create and verify its separate DKIM TXT
record. GoDaddy
[requires both setups](https://www.godaddy.com/en-in/help/enable-and-add-dkim-to-my-domain-for-microsoft-365-41748),
not just the Microsoft CNAMEs.

**Google Workspace** uses a `TXT` record at its chosen selector (default
`google._domainkey`), then *Start authentication* in the Admin console — see [DMARC for Google
Workspace](/dmarc-for/google-workspace/).

**Professional Email powered by Titan** uses two CNAMEs. In the Email & Office
Dashboard, select **Manage** beside your user, then **Set Mail Destination**
(or **Help me fix this**). Copy both DKIM targets shown there:

```
Type: CNAME   Name: secureserver1._domainkey   Value: (from your dashboard)
Type: CNAME   Name: secureserver2._domainkey   Value: (from your dashboard)
```

GoDaddy says DKIM is already added for domains purchased after April 2025.
Check the records before adding duplicates; older domains may need the
[manual setup](https://www.godaddy.com/en-in/help/add-spf-dkim-and-dmarc-to-my-domain-for-professional-email-powered-by-titan-42437).
For another Professional Email plan, use the records its dashboard supplies.

## 3. DMARC

Check for an existing `_dmarc` TXT record before adding one. GoDaddy may
[have published a default policy](https://www.godaddy.com/en/help/what-is-dkim-dmarc-and-spf-24605)
that sends reports to GoDaddy. Edit that record to use your reporting mailbox;
do not create a second DMARC record at the same name.

For a new setup, create a mailbox that accepts reports, then publish
[DMARC](/glossary/dmarc/) ([RFC 9989](/rfc/9989/)) in GoDaddy DNS:

```
Type: TXT   Name: _dmarc   Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Note the *Name* is just `_dmarc`, not `_dmarc.yourdomain.com`. Start at
[`p=none`](/glossary/dmarc-policy/) and only tighten once
[reports](/glossary/dmarc-aggregate-report/) show your legitimate senders
passing with alignment. If reports go to a different organizational domain,
the destination also needs to authorize them; see
[external reporting authorization](/guides/no-dmarc-record-found/#reports-wont-arrive-if-rua-is-wrong).

## Verify it worked

GoDaddy's own UI will happily show a record that resolves differently than you
expect, so check from outside:

```
dig +short NS yourdomain.com
dig +short TXT yourdomain.com
dig +short TXT _dmarc.yourdomain.com
```

If `_dmarc` returns nothing, the doubled-domain mistake above is the first thing
to rule out:

```
dig +short TXT _dmarc.yourdomain.com.yourdomain.com
```

A result there confirms the record was saved under the doubled name. Correct
it to `_dmarc`, then use the [DMARC checker](/tools/dmarc-checker/) to validate
the policy and any external reporting authorization.

Send a message through each service and inspect its authentication results.
Published DNS records alone do not prove DKIM signing is enabled or that SPF
or DKIM aligns with the visible `From:` domain.

## GoDaddy-specific gotchas

- **Check for an existing SPF record.** GoDaddy may add it automatically when
  your domain, DNS and email share an account. Edit it rather than adding a
  second.
- **Use `@` for the root** and the short subdomain (`_dmarc`,
  `selector1._domainkey`) in *Name*.
- **Check nameservers after enabling domain forwarding.** GoDaddy's
  [forwarding setup](https://www.godaddy.com/help/forward-my-godaddy-domain-12123)
  switches domains using other nameservers to GoDaddy's. Make sure your mail
  records exist in the zone now answering queries. Within an existing GoDaddy
  zone, forwarding updates and locks the root `@` A record; forwarding `www`
  also requires its CNAME to point at `@`. Those web records are separate
  from your SPF TXT, DKIM and DMARC records.
- **Allow for DNS caching.** GoDaddy says most updates appear within an hour,
  but global updates can take up to 48 hours.
- **Confirm every sender.** Include marketing platforms and contact-form mail
  in your checks. Each needs an aligned SPF pass or an aligned DKIM pass for
  DMARC; configuring both gives you more resilience.

## Common failures and what they mean

| Symptom | Usual cause |
|---|---|
| DMARC record "not found" | *Name* included the domain, creating a doubled hostname |
| `spf=permerror` | Check for duplicate SPF records, invalid syntax or too many DNS lookups |
| SPF passes for some mail, fails for the rest | A second sender missing from the record |
| Records disappeared after enabling domain forwarding | Nameservers may have switched; check the active DNS zone |
| Everything looks right but no reports arrive | Check the `rua` mailbox and, for an external destination, reporting authorization |

Agencies with a portfolio of GoDaddy-hosted clients need to see which
senders pass and align across every domain. Aggregating every client's reports
in one place is what [DMARC Analyzer](/) does — self-hosted, unlimited domains, no
per-domain fee.

## What next

Once records propagate, [read your aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/) to confirm every sender
aligns, then follow the [path to
enforcement](/guides/from-monitoring-to-enforcement/).
