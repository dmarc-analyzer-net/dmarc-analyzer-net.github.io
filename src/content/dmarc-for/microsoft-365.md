---
title: Set up SPF, DKIM & DMARC for Microsoft 365
provider: Microsoft 365
description: How to configure SPF, DKIM, and DMARC for Microsoft 365 (Office 365) — the exact DNS records, enabling DKIM signing, and Microsoft-specific gotchas.
publishDate: 2026-07-23
---

Microsoft 365 (formerly Office 365) routes mail through Exchange Online. SPF is a
single record, DKIM is **two CNAMEs plus a toggle**, and DMARC ties them
together. With Microsoft now enforcing sender requirements, getting this right
matters more than ever.

## 1. SPF

Publish one [SPF](/glossary/spf/) `TXT` record at your root domain:

```
v=spf1 include:spf.protection.outlook.com -all
```

Add any other senders as additional `include:`s in the **same** record. Watch
the [10-lookup limit](/guides/spf-record-syntax/) if you stack several services.

## 2. DKIM — publish two CNAMEs, then enable signing

Microsoft signs with [DKIM](/glossary/dkim/) using two rotating selectors. Add
both CNAMEs (values come from the Defender portal, based on your
`*.onmicrosoft.com` initial domain):

```
selector1._domainkey.yourdomain.com  ->  selector1-yourdomain-com._domainkey.<tenant>.onmicrosoft.com
selector2._domainkey.yourdomain.com  ->  selector2-yourdomain-com._domainkey.<tenant>.onmicrosoft.com
```

Then in the **Microsoft Defender portal** → *Email & collaboration → Policies &
rules → Threat policies → Email authentication settings → DKIM*, select your
domain and switch **Sign messages for this domain with DKIM signatures** to
**On**. It won't sign until this toggle is enabled.

## 3. DMARC

With SPF and DKIM in place, add a [DMARC](/glossary/dmarc/) record at
`_dmarc.yourdomain.com`, starting in monitoring mode:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` [monitors safely](/glossary/dmarc-policy/); tighten only after
[reports](/glossary/dmarc-aggregate-report/) look clean. Full rollout in
[publish your first DMARC record](/guides/publish-your-first-dmarc-record/).

## Microsoft-specific gotchas

- **DKIM needs the toggle**, not just the CNAMEs — publishing the records alone
  won't sign mail.
- **The two selectors rotate** — keep both CNAMEs in place permanently.
- **Sender requirements (2025):** Microsoft now requires SPF, DKIM, and DMARC
  (at least `p=none`) for high-volume senders to Outlook/Hotmail/Live;
  non-compliant mail is rejected with `550 5.7.15`. This setup satisfies it.
- **Don't add Exchange IPs manually** to SPF; the `include:` stays current.

## What next

After a few days, [read the aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/); if anything fails, see
[why your email is failing DMARC](/guides/fix-dmarc-failure/). When Exchange
Online is aligned, move along the [path to
enforcement](/guides/from-monitoring-to-enforcement/).
