---
term: DMARC
description: DMARC tells receiving mail servers what to do with mail that fails SPF and DKIM, and reports back on who is sending as your domain.
aliases: ["Domain-based Message Authentication, Reporting and Conformance"]
related: ["spf", "dkim", "dmarc-alignment", "dmarc-policy", "dmarc-aggregate-report"]
---

**DMARC** (Domain-based Message Authentication, Reporting and Conformance) is a
published DNS policy that builds on [SPF](/glossary/spf) and
[DKIM](/glossary/dkim). It does two things:

1. **Tells receivers what to do** with mail claiming to be from your domain that
   fails authentication — monitor it, quarantine it, or reject it. This is the
   [DMARC policy](/glossary/dmarc-policy).
2. **Asks receivers to report back**, so you can see every source sending as your
   domain — legitimate or not — via [aggregate reports](/glossary/dmarc-aggregate-report).

A message passes DMARC when SPF **or** DKIM passes *and*
[aligns](/glossary/dmarc-alignment) with the domain in the visible `From:`
address.

## The record

DMARC lives in a `TXT` record at `_dmarc.yourdomain.com`:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` monitors without affecting delivery — the right place to start. See
[publish your first DMARC record](/guides/publish-your-first-dmarc-record) to
set one up, then [move to enforcement](/guides/from-monitoring-to-enforcement)
once the reports look clean.
