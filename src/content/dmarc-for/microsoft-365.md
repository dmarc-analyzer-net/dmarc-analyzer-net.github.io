---
title: Set up SPF, DKIM & DMARC for Microsoft 365
provider: Microsoft 365
description: How to configure SPF, DKIM, and DMARC for Microsoft 365 (Office 365) — the exact DNS records, enabling DKIM signing, and Microsoft-specific gotchas.
publishDate: 2026-07-23
updatedDate: 2026-11-13
---

To set up SPF, DKIM and DMARC for Microsoft 365 (formerly Office 365), publish
one SPF record, add **two DKIM CNAMEs and enable signing**, then publish a DMARC
record to request reports. Configure every service that sends as your domain,
not only Exchange Online.

## 1. SPF

If Exchange Online is your only sender, publish this [SPF](/glossary/spf/) `TXT`
record at your custom domain. If a record already exists, edit it rather than
adding a second one:

```
v=spf1 include:spf.protection.outlook.com -all
```

For the standard Microsoft 365 cloud,
[Microsoft specifies this include](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure).
GCC High, DoD and China deployments use different values. Never list Microsoft's IP
addresses by hand — they change, and your record won't.

### Adding other senders

If anything else sends as your domain — a CRM, a helpdesk, a marketing platform
— add its required sources to the **same** record, not a second one. For
example, if you also run an outbound relay at the documentation IP
`192.0.2.20` (replace it with your relay's public IP):

```
v=spf1 ip4:192.0.2.20 include:spf.protection.outlook.com -all
```

Two SPF records produce `permerror`, so SPF cannot pass. Watch the
**10-term DNS lookup limit** as you stack services: evaluated `include`, `a`,
`mx`, `ptr`, `exists` and `redirect` terms count across the whole evaluation,
including nested records. This is a limit on terms, not raw DNS queries. See [SPF record
syntax](/guides/spf-record-syntax/) for how to count them and what to do when
you run out.

### Subdomains

SPF checks the envelope sender (`MAIL FROM`), not the visible `From:` address,
and does not inherit. If your envelope sender uses `mail.yourdomain.com`, publish
SPF there too — it does not fall back to the parent's record.

## 2. DKIM — publish two CNAMEs, then enable signing

Microsoft signs with [DKIM](/glossary/dkim/) using two selectors,
`selector1` and `selector2`. Their relative DNS names are
`selector1._domainkey` and `selector2._domainkey`; the targets differ by domain.
Add and verify your custom domain in Microsoft 365 before configuring signing.

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
from the Defender portal, or connect to Exchange Online PowerShell and run:

```powershell
Get-DkimSigningConfig -Identity yourdomain.com | Format-List Name,Enabled,Status,Selector1CNAME,Selector2CNAME
```

If the domain has no DKIM configuration yet, create it, then run the query again:

```powershell
New-DkimSigningConfig -DomainName yourdomain.com -Enabled $false
```

The prefix belongs to the tenant; the partition character is assigned per domain,
so even two domains in the same tenant can have different characters.
[Microsoft's DKIM instructions](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure)
document both formats and the configuration steps.

If Cloudflare hosts your DNS, keep both selectors DNS-only with flattening
disabled. [The Cloudflare notes](/dmarc-for/cloudflare/) explain why proxying or
flattening can prevent a verifier from finding the key.

### Turn signing on

Publishing the CNAMEs signs nothing on its own. In the **Microsoft Defender
portal** → *Email & collaboration → Policies & rules → Threat policies → Email
authentication settings → DKIM tab*, select your domain. If it shows
`NoDKIMKeys`, first try enabling signing: Microsoft documents an initial
client error that exposes the required records and changes the status to
`CnameMissing`. Copy both values from
the **Publish CNAMEs** section. After publishing them and allowing detection,
switch **Sign messages for this domain with DKIM signatures** to **On**.
Confirm the status says **Signing DKIM signatures for this domain**.

Only **one selector is active at a time**. The second is dormant until a key
rotation promotes it — which is exactly why both CNAMEs must stay published.
Deleting the "unused" one breaks your next rotation.

## 3. DMARC

With SPF and DKIM in place, publish a [DMARC](/glossary/dmarc/) `TXT` record at
`_dmarc.yourdomain.com`. For a new record, start in monitoring mode as shown
below. If a record already exists, edit it instead of adding a second one:
keep its existing policy, including `p=quarantine` or `p=reject`, when adding or
updating `rua=`. Create the mailbox named in `rua=`:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` [requests no DMARC enforcement](/glossary/dmarc-policy/); receivers
can still reject or filter mail for other reasons. `rua=` requests aggregate
reports from participating receivers. Tighten only after
[reports](/glossary/dmarc-aggregate-report/) look clean; the full rollout is in
[publish your first DMARC record](/guides/publish-your-first-dmarc-record/).

## Verify it worked

Check the records resolve before you wait on reports:

```
dig +short TXT yourdomain.com
dig +short CNAME selector1._domainkey.yourdomain.com
dig +short CNAME selector2._domainkey.yourdomain.com
dig +short TXT _dmarc.yourdomain.com
```

Then send to a mailbox **outside your Microsoft 365 organization**. Microsoft
can omit DKIM signatures on mail within the same organization, even between
different domains. Read the receiving system's `Authentication-Results` header
on the delivered message. For a direct Exchange Online test, look for all three
passing and your custom domain in `header.d`:

```
Authentication-Results: receiver.example;
 spf=pass (sender IP is 192.0.2.10)
 smtp.mailfrom=yourdomain.com; dkim=pass header.d=yourdomain.com;
 dmarc=pass action=none header.from=yourdomain.com;
```

If `dkim=pass` shows `header.d=<prefix>.onmicrosoft.com` instead of your own
domain, that signature does not align with a `From:` address at
`yourdomain.com`. Check the custom domain's signing status and CNAMEs; a pass for
the initial domain is not proof that custom-domain DKIM is enabled.

DMARC itself needs **one passing, aligned mechanism**, SPF or DKIM. Under the
default relaxed [alignment](/glossary/dmarc-alignment/), their organizational
domains must match the visible `From:` domain's organizational domain; strict
alignment requires an exact domain match. Outlook.com's high-volume rules below
add the requirement that **both** SPF and DKIM pass.

## Microsoft's 2025 sender requirements

[Microsoft's announcement](https://techcommunity.microsoft.com/blog/microsoftthreatprotectionblog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730)
sets the threshold at **more than 5,000 messages per day** from a domain to its
Outlook.com consumer service, including Hotmail and Live addresses. These are
recipient-side requirements, whatever service you use to send. High-volume
senders need **SPF pass, DKIM pass, and DMARC with at least `p=none`**, with
alignment through SPF or DKIM.

The April 29, 2025 update replaced the planned junk-first rollout with rejection
starting **May 5, 2025**. Microsoft identifies authentication rejections with
`550 5.7.515`.

Verify each sending service separately: an Exchange Online test does not prove
that your CRM or marketing platform passes. A DMARC pass through aligned DKIM
alone does not satisfy the additional SPF-pass requirement, and authentication
does not guarantee inbox placement.

## Microsoft-specific gotchas

- **DKIM needs the toggle**, not just the CNAMEs — publishing the records alone
  won't sign mail.
- **Keep both selectors published while using Microsoft 365 DKIM.** Only one
  is active; the other is for rotation.
- **Copy each domain's CNAME values.** The initial-domain prefix belongs to the
  tenant; the partition character can differ between its domains.
- **Don't add Exchange IPs manually** to SPF; the `include:` stays current.
- **Check the actual `From:` address.** Mail sent as your initial
  `<prefix>.onmicrosoft.com` domain uses that domain's authentication settings,
  not your custom domain's DMARC record.

## Common failures and what they mean

| Symptom | Usual cause |
|---|---|
| `dkim=none` on an external test | Check the custom-domain toggle and confirm the message actually left through Exchange Online |
| `dkim=none` within your organization | Microsoft can omit signatures on internal mail; test outside the organization |
| `dkim=pass` but `header.d` is `<prefix>.onmicrosoft.com` | For mail from your custom domain, check whether any other passing signature aligns; the initial-domain signature does not |
| `spf=permerror` | Two SPF records, or over the 10-lookup limit |
| `dmarc=fail` while SPF and DKIM both pass | Neither passing mechanism aligns with the visible `From:` domain under your alignment settings |
| `550 5.7.515` to Outlook.com only | Check SPF pass, DKIM pass and DMARC/alignment; DMARC pass alone is insufficient |

Doing this across several client tenants is where it turns into a job: every
domain can receive aggregate reports from multiple participating receivers.
[DMARC Analyzer](/) groups them in one self-hosted dashboard, with no per-domain
fee. Its [domain view](/docs/domain-detail/) shows sending sources and their
authentication results so you can find the service that still needs work.

## What next

After a few days, [read the aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/); if anything fails, see
[why your email is failing DMARC](/guides/fix-dmarc-failure/). When Exchange
Online is aligned, move along the [path to
enforcement](/guides/from-monitoring-to-enforcement/).
