---
title: What "No DMARC record found" means (and how to fix it)
seoTitle: '"No DMARC record found": how to fix'
description: Getting "No DMARC record found"? It means your domain has no DMARC policy at _dmarc — here is why it appears, including on subdomains, and how to fix it.
publishDate: 2026-07-23
---

**"No DMARC record found"** means a checker looked up `_dmarc.yourdomain.com` and
got nothing back — your domain hasn't published a [DMARC](/glossary/dmarc/)
policy. It's the most common starting point, and the fix takes five minutes.

## Why it happens

A DMARC record is a `TXT` record at the special host `_dmarc` under your domain.
The message appears when:

- you've **never published** one (by far the most common reason);
- it's on the **wrong host** — e.g. added to the root domain instead of `_dmarc`;
- you're checking a **subdomain** that has no record of its own; or
- the record was **just added** and DNS hasn't propagated yet.

## The fix

Add a `TXT` record at `_dmarc.yourdomain.com` in monitoring mode:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

- The **Name/Host** is `_dmarc` (your DNS host appends the domain).
- `p=none` [monitors safely](/glossary/dmarc-policy/) — nothing is blocked.
- `rua=` is the mailbox that receives [aggregate
  reports](/glossary/dmarc-aggregate-report/).

Provider-specific steps are under [DMARC setup](/dmarc-for/) (Google Workspace,
Microsoft 365, GoDaddy). Full walkthrough: [publish your first DMARC
record](/guides/publish-your-first-dmarc-record/).

## The subdomain case

DMARC lookups do **not** automatically walk up to the parent domain. If
`news.yourdomain.com` has no `_dmarc` record, a checker aimed at that subdomain
reports "not found" — even though the receiver *will* fall back to the
organizational domain's `sp=` (subdomain policy) at delivery time. If a subdomain
sends mail, give it its own record, and set a deliberate `sp=` on the root.

## "Please try a different email" on signup forms

Some services reject signups from domains without DMARC, showing "no DMARC record
found for this domain." Publishing the `p=none` record above resolves it once DNS
propagates (usually minutes, up to ~an hour).

## What next

After it propagates, confirm the record is live, then learn to [read the
reports](/guides/how-to-read-a-dmarc-aggregate-report/) that start arriving and
plan your [path to enforcement](/guides/from-monitoring-to-enforcement/).
