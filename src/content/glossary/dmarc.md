---
term: DMARC
seoTitle: "DMARC: policy, alignment and reports"
description: DMARC connects SPF and DKIM to your visible From domain, lets you publish a handling policy for failures, and requests reports about mail using your domain.
aliases: ["Domain-based Message Authentication, Reporting and Conformance"]
related: ["spf", "dkim", "dmarc-alignment", "dmarc-policy", "dmarc-aggregate-report", "bimi", "mta-sts"]
---

**DMARC** (Domain-based Message Authentication, Reporting and Conformance,
[RFC 9989](/rfc/9989/)) connects [SPF](/glossary/spf/) and
[DKIM](/glossary/dkim/) authentication to the domain in the visible `From:`
address. It lets you publish a handling preference for mail that fails that
check and request reports about mail using your domain.

## What makes a message pass

A message passes DMARC when SPF **or** DKIM passes **and**
[aligns](/glossary/dmarc-alignment/) with the visible `From:` domain. A raw
SPF or DKIM pass for an unrelated provider domain does not count. If a message
has several DKIM signatures, any one passing, aligned signature is enough.

Alignment can be relaxed or strict: relaxed alignment accepts domains with
the same organizational domain; strict alignment requires an exact match.
The record's `aspf=` and `adkim=` tags control this separately for SPF and
DKIM, with relaxed alignment as the default.

## The record

Publish a `TXT` record at `_dmarc.yourdomain.com`:

```text
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

The [DMARC policy](/glossary/dmarc-policy/) expresses your preference for
messages that fail DMARC:

- `p=none` — no requested quarantine or rejection based on DMARC.
- `p=quarantine` — treat failures as suspicious, for example by placing them
  in spam.
- `p=reject` — refuse failures, normally during the SMTP conversation.

Receivers decide how to handle mail using their own filtering and override
rules. Even with `p=none`, they can reject mail for other reasons.

The `rua=` tag requests [aggregate reports](/glossary/dmarc-aggregate-report/);
`p=none` alone does not. Reports can be requested with any policy value, but
receivers are not obliged to send them. The optional `ruf=` tag requests
per-message failure reports, which most receivers decline to send because
they can expose personal data.

If you are setting up DMARC for the first time, [start with a monitoring
record](/guides/publish-your-first-dmarc-record/). Before
[moving to enforcement](/guides/from-monitoring-to-enforcement/), investigate
failures and test important forwarding and mailing-list routes; clean reports
alone do not prove every legitimate mail flow has been observed.

## What DMARC adds — and its limits

SPF and DKIM can affect a receiver's filtering without DMARC. What DMARC adds
is a link to the visible `From:` domain, a published handling preference, and
a reporting mechanism. Across many client domains,
[DMARC Analyzer](/) groups the received reports so you can
[inspect sending sources and their authentication results](/docs/domain-detail/#sending-sources).

DMARC does not stop look-alike domains or display-name impersonation. An
attacker can authenticate a different domain they control. A DMARC pass also
does not prove mail is wanted or that the sender's account is uncompromised.

## Subdomains and duplicate records

A subdomain's own valid DMARC policy takes precedence. Otherwise, it can
inherit its organizational domain's policy: `sp=` applies to existing
subdomains and `np=` to non-existent ones. Without `np=`, the fallback is
`sp=`, then `p=`; without `sp=`, existing subdomains use `p=`.
Non-existent means DNS returns NXDOMAIN, not merely that mail records are absent.

Publish one DMARC policy record per DNS name. If a lookup returns two DMARC
records, receivers discard both at that name rather than merging them.
For a subdomain, discovery can still find an applicable inherited policy.
Edit the existing record when changing policy or adding a reporting address.
