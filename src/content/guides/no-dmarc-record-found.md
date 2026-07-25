---
title: What "No DMARC record found" means (and how to fix it)
seoTitle: '"No DMARC record found": how to fix'
description: Getting "No DMARC record found"? It means your domain has no DMARC policy at _dmarc — here is why it appears, including on subdomains, and how to fix it.
publishDate: 2026-07-23
updatedDate: 2026-07-25
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

## Confirm it's actually there

Check from outside your DNS provider's UI, which can show a record that isn't
resolving the way you expect:

```
dig +short TXT _dmarc.yourdomain.com
```

You want exactly one string starting `v=DMARC1`. Three results worth
recognising:

- **Nothing at all** — the record isn't published, or hasn't propagated.
- **Two `v=DMARC1` records** — this is treated as *no* policy at all, not as two
  policies. Delete one.
- **A record at the wrong name** — see below.

## The doubled-domain mistake

Most DNS hosts append your domain to whatever you type in the *Name* field. Enter
`_dmarc.yourdomain.com` and you create a record at
`_dmarc.yourdomain.com.yourdomain.com`, which no checker will ever find. The
record looks perfect in the control panel, which is what makes it hard to spot.

Rule it out directly:

```
dig +short TXT _dmarc.yourdomain.com.yourdomain.com
```

If that returns your record, fix the *Name* to just `_dmarc`. This is the single
most common cause of "I published it and it still says not found."

## Syntax that makes a record invisible

A record that exists but is malformed reads as absent to most checkers:

| Problem | Example |
|---|---|
| Wrong version case | `v=dmarc1` — must be `v=DMARC1`, exactly |
| `v=` not first | `p=none; v=DMARC1` — the version tag must lead |
| Smart quotes | A curly `"` pasted from a document |
| Missing scheme in `rua` | `rua=dmarc@yourdomain.com` needs `mailto:` |

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

## Reports won't arrive if `rua=` is wrong

Publishing the record is only half of it — a policy with an unreachable `rua=`
mailbox gives you enforcement guidance you can never act on, because no data ever
arrives. Make sure the address exists and accepts mail from outside.

One thing that surprises people: to collect reports **for a domain you don't
own** — `rua=mailto:dmarc@agency.com` in a client's record — that third-party
domain must authorise it with a record of its own:

```
yourdomain.com._report._dmarc.agency.com   TXT   v=DMARC1
```

Without it, standards-compliant receivers won't send the reports. Agencies
centralising many clients' reports into one mailbox hit this constantly. Once
they do arrive, something has to parse the XML and aggregate it across domains —
that's what [DMARC Analyzer](/) does, self-hosted and without per-domain pricing.

## What next

After it propagates, confirm the record is live, then learn to [read the
reports](/guides/how-to-read-a-dmarc-aggregate-report/) that start arriving and
plan your [path to enforcement](/guides/from-monitoring-to-enforcement/).
