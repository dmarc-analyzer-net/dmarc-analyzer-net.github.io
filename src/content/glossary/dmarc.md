---
term: DMARC
description: DMARC tells receiving mail servers what to do with mail that fails authentication or alignment, and reports back on who is sending as your domain.
aliases: ["Domain-based Message Authentication, Reporting and Conformance"]
related: ["spf", "dkim", "dmarc-alignment", "dmarc-policy", "dmarc-aggregate-report", "bimi", "mta-sts"]
---

**DMARC** (Domain-based Message Authentication, Reporting and Conformance,
[RFC 9989](/rfc/9989/)) is a published DNS policy that builds on [SPF](/glossary/spf/) and
[DKIM](/glossary/dkim/). It does two things:

1. **Tells receivers what to do** with mail claiming to be from your domain that
   fails authentication — monitor it, quarantine it, or reject it. This is the
   [DMARC policy](/glossary/dmarc-policy/).
2. **Asks receivers to report back**, so you can see every source sending as your
   domain — legitimate or not — via [aggregate reports](/glossary/dmarc-aggregate-report/)
   (`rua=`). A second tag, `ruf=`, asks for per-message forensic reports; few
   receivers still send them, which is why aggregate reports are what this
   project — and most of the ecosystem — is built around.

A message passes DMARC when SPF **or** DKIM passes *and*
[aligns](/glossary/dmarc-alignment/) with the domain in the visible `From:`
address.

## The record

DMARC lives in a `TXT` record at `_dmarc.yourdomain.com`:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` monitors without affecting delivery — the right place to start. See
[publish your first DMARC record](/guides/publish-your-first-dmarc-record/) to
set one up, then [move to enforcement](/guides/from-monitoring-to-enforcement/)
once the reports look clean.

## Why it exists

Without DMARC, an SPF or DKIM failure has no consequence for the receiver and
no visibility for you: mail can fail authentication silently, and you have no
way to learn that someone is sending as your domain to people who aren't you.
DMARC closes both gaps at once — a policy for receivers to act on, and reports
that surface every source claiming your domain, wanted or not.

## What it doesn't do

Three DNS records deliver less than people expect. DMARC only governs mail
claiming your *exact* domain — a look-alike (`y0ur-company.com`, an added
hyphen) authenticates against its own record, not yours, so DMARC has nothing
to say about it. Passing DMARC isn't a spam filter either: a message can
authenticate perfectly and still be mail nobody wanted. And a subdomain with no
policy of its own follows `p=` only because [`sp=`](/glossary/dmarc-policy/)
says so by default — it isn't automatically protected in some deeper sense.

## One record per domain

Like SPF, `_dmarc.yourdomain.com` may carry only one DMARC record. A second
one — often added by a security vendor's onboarding script alongside a
record you already had — doesn't merge with the first; it makes DMARC
invalid at that domain, and receivers ignore both rather than picking one.
