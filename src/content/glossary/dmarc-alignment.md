---
term: DMARC alignment
description: DMARC alignment requires the domain that passed SPF or DKIM to match the domain in the visible From address — the rule that makes that address hard to forge.
aliases: ["SPF alignment", "DKIM alignment", "identifier alignment"]
related: ["spf", "dkim", "dmarc", "arc"]
---

**Alignment** — *identifier alignment* in [RFC 9989](/rfc/9989/) — is the rule
that turns [SPF](/glossary/spf/) and [DKIM](/glossary/dkim/) passes into a
[DMARC](/glossary/dmarc/) pass. It is not enough for SPF or DKIM to pass: the
domain they authenticated must **match the domain in the visible `From:`
address**.

- **SPF alignment** compares the `From:` domain with the envelope
  `MAIL FROM` domain.
- **DKIM alignment** compares the `From:` domain with the `d=` domain of a DKIM
  signature. A message can carry several signatures and needs one that both
  verifies and aligns, so a platform's own `d=` sitting alongside yours costs
  you nothing.

DMARC passes if **either** SPF or DKIM passes *and* aligns.

## Relaxed vs strict

- **Relaxed** (default): the two domains need only share an organizational
  domain. For example, `mail.yourdomain.com` aligns with `yourdomain.com`
  when both share `yourdomain.com` as their organizational domain.
- **Strict**: the domains must be identical.

Set the mode per mechanism with `aspf=` (SPF) and `adkim=` (DKIM) in the DMARC
record; both default to relaxed, which is usually what you want, because email
providers routinely sign and send from a subdomain of your domain.

## What breaks alignment in practice

A forged message can pass SPF and DKIM perfectly well — for the attacker's own
domain, which is the thing alignment is there to catch. The same shape turns up
in your own mail whenever a sender authenticates under its domain instead of
yours, and that is where "SPF and DKIM are green, so why is DMARC failing?"
comes from.

- **Bulk senders using their own envelope domain.** Marketing platforms send with
  `MAIL FROM` on their infrastructure, so SPF passes for *them* and aligns with
  nothing. With relaxed alignment, either of two fixes works if the platform
  offers it: a valid DKIM signature whose `d=` is a subdomain of yours, or a
  custom return path on a subdomain of yours that authorizes the platform and
  passes SPF. Both fixes require the authenticated domain to share the `From:`
  domain's organizational domain; a subdomain can have a separate one.
  If you require strict alignment for the mechanism you use, its authenticated
  domain must match the `From:` domain exactly.
- **Google Workspace's default signing key.** Workspace signs everything from the
  start, but until you generate your own key, publish it in DNS *and* start
  authentication, it signs with a key Google owns, whose `d=` is a
  `*.gappssmtp.com` name — your domain with its dots turned into hyphens, as in
  `yourdomain-com.20260115.gappssmtp.com`. That is a real `dkim=pass` that never
  aligns — and the reason it goes unnoticed for months is that every checker
  reports DKIM as working.
- **Microsoft 365 before custom DKIM**, which signs with the tenant's initial
  `*.onmicrosoft.com` domain. That signature does not align with your custom
  `From:` domain; it aligns when `From:` uses the initial tenant domain.
- **Forwarding and mailing lists**, where SPF breaks and DKIM may or may not
  survive intact. See [ARC](/glossary/arc/) for what that does and doesn't fix.

Aggregate reports are where you see all of this: each row shows the SPF and DKIM
results *and* whether they aligned, so a column of passes next to a DMARC fail is
the signature of the problem. [Reading an aggregate
report](/guides/how-to-read-a-dmarc-aggregate-report/) walks through it.
[DMARC Analyzer](/) groups reported `From:`, SPF and DKIM domains by sending
source. Its source view shows the 15 highest-volume DKIM result groups; use the
original report XML to inspect omitted results or compare domains within a
specific report row.
