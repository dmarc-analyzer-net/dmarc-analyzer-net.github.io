---
title: Set up SPF, DKIM & DMARC for Microsoft 365
provider: Microsoft 365
description: How to configure SPF, DKIM, and DMARC for Microsoft 365 (Office 365) — the exact DNS records, enabling DKIM signing, and Microsoft-specific gotchas.
publishDate: 2026-07-23
updatedDate: 2026-07-25
---

Microsoft 365 (formerly Office 365) routes mail through Exchange Online. SPF is a
single record, DKIM is **two CNAMEs plus a toggle**, and DMARC ties them
together. Since Microsoft began enforcing sender requirements on Outlook.com in
May 2025, getting this right is no longer optional for anyone sending volume.

## 1. SPF

Publish one [SPF](/glossary/spf/) `TXT` record at your root domain:

```
v=spf1 include:spf.protection.outlook.com -all
```

That single `include:` covers all of Exchange Online. Never list Microsoft's IP
addresses by hand — they change, and your record won't.

### Adding other senders

If anything else sends as your domain — a CRM, a helpdesk, a marketing platform
— its `include:` goes in the **same** record, not a second one:

```
v=spf1 include:spf.protection.outlook.com include:servers.mcsv.net -all
```

Two SPF records is a `permerror`, and a `permerror` is an SPF failure. Watch the
**10-lookup limit** as you stack services: every `include:`, `a`, `mx`, and
`redirect` counts, and nested includes count too. See [SPF record
syntax](/guides/spf-record-syntax/) for how to count them and what to do when
you run out.

### Subdomains

SPF does not inherit. If you send from `mail.yourdomain.com`, it needs its own
record — a subdomain with no SPF record doesn't fall back to the parent's.

## 2. DKIM — publish two CNAMEs, then enable signing

Microsoft signs with [DKIM](/glossary/dkim/) using two selectors,
`selector1._domainkey` and `selector2._domainkey`. Those hostnames are identical
for every Microsoft 365 organization; only the targets differ.

**There are two CNAME formats, and which you need depends on when the domain was
added.** Microsoft introduced a new format in May 2025 for new custom domains:

```
selector1._domainkey  ->  selector1-yourdomain-com._domainkey.<prefix>.<c>-v1.dkim.mail.microsoft
selector2._domainkey  ->  selector2-yourdomain-com._domainkey.<prefix>.<c>-v1.dkim.mail.microsoft
```

Domains that existed before then continue to use the older form:

```
selector1._domainkey  ->  selector1-yourdomain-com._domainkey.<prefix>.onmicrosoft.com
selector2._domainkey  ->  selector2-yourdomain-com._domainkey.<prefix>.onmicrosoft.com
```

`<prefix>` is the custom part of your initial `*.onmicrosoft.com` domain, your
domain's periods become dashes (`yourdomain.com` → `yourdomain-com`), and `<c>`
is a partition character Microsoft assigns automatically — it isn't configurable
and you can't guess it.

**The two formats can't coexist for the same selector**, so don't mix them and
don't copy values out of an old runbook. Read the real values for your domain
from the Defender portal, or from Exchange Online PowerShell:

```
Get-DkimSigningConfig -Identity yourdomain.com | Format-List Name,Enabled,Status,Selector1CNAME,Selector2CNAME
```

### Turn signing on

Publishing the CNAMEs signs nothing on its own. In the **Microsoft Defender
portal** → *Email & collaboration → Policies & rules → Threat policies → Email
authentication settings → DKIM tab*, select your domain and switch **Sign
messages for this domain with DKIM signatures** to **On**.

Only **one selector is active at a time**. The second is dormant until a key
rotation promotes it — which is exactly why both CNAMEs must stay published.
Deleting the "unused" one breaks your next rotation.

## 3. DMARC

With SPF and DKIM in place, add a [DMARC](/glossary/dmarc/) record at
`_dmarc.yourdomain.com`, starting in monitoring mode:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` [monitors safely](/glossary/dmarc-policy/) — it changes nothing about
delivery and simply asks receivers to report what they see. Tighten only after
[reports](/glossary/dmarc-aggregate-report/) look clean; the full rollout is in
[publish your first DMARC record](/guides/publish-your-first-dmarc-record/).

## Verify it worked

Check the records resolve before you wait on reports:

```
dig +short TXT yourdomain.com
dig +short CNAME selector1._domainkey.yourdomain.com
dig +short TXT _dmarc.yourdomain.com
```

Then send a message to an external address and read the `Authentication-Results`
header on what arrives. You want all three passing, and the DKIM domain matching
your `From:` domain:

```
Authentication-Results: spf=pass (sender IP is 192.0.2.10)
 smtp.mailfrom=yourdomain.com; dkim=pass header.d=yourdomain.com;
 dmarc=pass action=none header.from=yourdomain.com;
```

If `dkim=pass` shows `header.d=<prefix>.onmicrosoft.com` instead of your own
domain, signing is still using the initial domain: the toggle is off, or the
CNAMEs haven't resolved yet.

## Microsoft's 2025 sender requirements

Since **5 May 2025**, Outlook.com, Hotmail, and Live enforce authentication for
**high-volume senders** — 5,000 or more messages a day using the same domain in
the `From:` address. Those senders need SPF, DKIM, and DMARC with a policy of at
least `p=none`, plus alignment on SPF or DKIM.

Non-compliant mail was routed to Junk first, and is now rejected outright:

```
550 5.7.515 Access denied, sending domain yourdomain.com does not meet the required authentication level
```

The setup on this page satisfies it. Note the threshold counts mail to Microsoft
consumer domains specifically, so a modest business sender can cross it during a
campaign without ever thinking of itself as high volume.

## Microsoft-specific gotchas

- **DKIM needs the toggle**, not just the CNAMEs — publishing the records alone
  won't sign mail.
- **Both selectors stay forever.** Only one is active; the other is for rotation.
- **Don't reuse another tenant's CNAME values.** The partition character and the
  initial-domain prefix are specific to your tenant.
- **Don't add Exchange IPs manually** to SPF; the `include:` stays current.
- **Check the initial domain too.** Mail sent as `*.onmicrosoft.com` is signed
  separately and won't align with your custom domain's DMARC.

## Common failures and what they mean

| Symptom | Usual cause |
|---|---|
| `dkim=none` on all mail | The Defender portal toggle is off |
| `dkim=pass` but `header.d` is `*.onmicrosoft.com` | Signing with the initial domain, not yours |
| `spf=permerror` | Two SPF records, or over the 10-lookup limit |
| `dmarc=fail` while SPF and DKIM both pass | Alignment — the passing domain isn't your `From:` domain |
| `550 5.7.515` to Outlook.com only | High-volume threshold hit without full authentication |

Doing this across several client tenants is where it turns into a job: every
domain produces its own reports, from every receiver, every day. That is what
[DMARC Analyzer](/) is for — one self-hosted dashboard covering all of them, no
per-domain fee.

## What next

After a few days, [read the aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/); if anything fails, see
[why your email is failing DMARC](/guides/fix-dmarc-failure/). When Exchange
Online is aligned, move along the [path to
enforcement](/guides/from-monitoring-to-enforcement/).
