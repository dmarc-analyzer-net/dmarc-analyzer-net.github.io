---
term: DMARC alignment
description: Alignment requires the domain that passed SPF or DKIM to match the domain in the visible From address — the check that makes DMARC hard to spoof.
aliases: ["SPF alignment", "DKIM alignment", "identifier alignment"]
related: ["spf", "dkim", "dmarc"]
---

**Alignment** is the rule that turns [SPF](/glossary/spf) and
[DKIM](/glossary/dkim) passes into a [DMARC](/glossary/dmarc) pass. It is not
enough for SPF or DKIM to pass — the domain they authenticated must **match the
domain in the visible `From:` address**.

- **SPF alignment** compares the `From:` domain with the envelope
  `MAIL FROM` domain.
- **DKIM alignment** compares the `From:` domain with the DKIM signature's `d=`
  domain.

DMARC passes if **either** SPF or DKIM passes *and* aligns.

## Relaxed vs strict

- **Relaxed** (default): a subdomain matches the organisational domain, so
  `mail.example.com` aligns with `example.com`.
- **Strict**: the domains must be identical.

Set the mode per mechanism with `aspf=` (SPF) and `adkim=` (DKIM) in the DMARC
record; both default to relaxed, which is usually what you want.
