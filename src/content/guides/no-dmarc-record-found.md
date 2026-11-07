---
title: What "No DMARC record found" means (and how to fix it)
seoTitle: '"No DMARC record found": how to fix'
description: Getting "No DMARC record found"? Nothing answered at _dmarc for the name you checked — why it happens, how to fix it, and why a subdomain can say it anyway.
publishDate: 2026-07-23
updatedDate: 2026-11-07
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

No terminal to hand? Our [DMARC record checker](/tools/dmarc-checker/) runs the
same lookup from your browser and names the problem it finds.

You want exactly one string starting `v=DMARC1`. Three results worth
recognising:

- **Nothing at all** — the record isn't published, or hasn't propagated.
- **Two `v=DMARC1` records** — receivers discard both, so the name reads as having
  no record rather than as two policies. On your root domain that leaves no DMARC
  at all; on a subdomain the receiver walks up and applies what it finds above.
  Delete one.
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

"Not found" on a subdomain usually means the tool and the receiver are looking in
different places. A receiver starts at the exact name in the `From:` address and, if
there is no record there, **walks up the DNS tree** to your organizational domain.
Checkers report on the name you typed and stop.

So if `news.yourdomain.com` has no `_dmarc` record, a checker aimed at that subdomain
says "not found", while at delivery time the receiver finds your root record and
applies its `sp=`. A subdomain that doesn't resolve at all gets `np=` instead, and
whichever applies falls back to `p=` when that tag isn't published. There is a policy
in force; the tool simply isn't looking where the receiver looks.

That walk is newer than most of the advice written about it. The original DMARC
specification worked out where your organizational domain began using a public suffix
list, without mandating which one — so two receivers could disagree about it. The
current specification ([RFC 9989](/rfc/9989/)) replaced that with the tree walk. It
queries every name on the way up, but the policy it applies is still the one at the
`From:` name itself or at your organizational domain — a record on an intermediate
name does not govern the names below it by sitting there. Making it govern them takes
`psd=n`, which declares the name an organizational domain in its own right: the tag
to reach for when a subdomain delegated to a team or a customer needs its own policy
and its own reports. See
[what changed in the new DMARC standard](/guides/dmarc-rfc-9989/).

If a subdomain sends mail, give it its own record, and set `sp=` on the root only if
you want subdomains treated *differently* — see the
[tag reference](/guides/dmarc-record-tags/).

## "Please try a different email" on signup forms

Some services reject signups from domains without DMARC, showing "no DMARC record
found for this domain." Publishing the `p=none` record above resolves it once DNS
propagates (usually minutes, up to ~an hour).

## Reports won't arrive if `rua=` is wrong

Publishing the record is only half of it — a policy with an unreachable `rua=`
mailbox gives you enforcement guidance you can never act on, because no data ever
arrives. Make sure the address exists and accepts mail from outside.

One thing that surprises people: if the `rua=` mailbox is outside the organizational
domain publishing the record, that domain has to authorise the arrangement with a
record of its own ([RFC 9990](/rfc/9990/)). `dmarc@mail.yourdomain.com` under a record
at `yourdomain.com` is inside that organizational domain and needs nothing. A second
domain you also own is outside it, and still does:

```
yourdomain.com._report._dmarc.analyzer.example.   TXT   "v=DMARC1"
```

The check compares organizational domains, not owners, so owning both ends exempts
you from nothing. Without the record, conforming receivers discard the reporting
request silently — the policy still validates, nothing bounces, and the reports never
come. Agencies centralising many clients' reports into one mailbox hit this
constantly; [DMARC for many client domains](/guides/dmarc-multiple-client-domains/)
covers the wildcard form and the trap that comes with it.
The [record checker](/tools/dmarc-checker/) performs that second lookup for every
external `rua=` address it finds, which is the fastest way to rule this out. Once
they do arrive, something has to parse the XML and aggregate it across domains —
that's what [DMARC Analyzer](/) does, self-hosted and without per-domain pricing.

## What next

After it propagates, confirm the record is live, then learn to [read the
reports](/guides/how-to-read-a-dmarc-aggregate-report/) that start arriving and
plan your [path to enforcement](/guides/from-monitoring-to-enforcement/).
