---
term: DMARC alignment
description: Alignment requires the domain that passed SPF or DKIM to match the domain in the visible From address — the check that makes DMARC hard to spoof.
aliases: ["SPF alignment", "DKIM alignment", "identifier alignment"]
related: ["spf", "dkim", "dmarc", "arc"]
---

**Alignment** is the rule that turns [SPF](/glossary/spf/) and
[DKIM](/glossary/dkim/) passes into a [DMARC](/glossary/dmarc/) pass. It is not
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
record; both default to relaxed, which is usually what you want, because email
providers routinely sign and send from a subdomain of your domain.

## What breaks alignment in practice

Almost every real failure is a pass that doesn't align, which is why "SPF and DKIM
are green, so why is DMARC failing?" is the most common way this shows up.

- **Bulk senders using their own envelope domain.** Marketing platforms send with
  `MAIL FROM` on their infrastructure, so SPF passes for *them* and aligns with
  nothing. DKIM is the fix: have them sign with a subdomain of yours.
- **Google Workspace's default signing key.** Workspace signs everything from the
  start, but until you generate a key in the admin console it signs with
  `d=<domain>.<datestamp>.gappssmtp.com`. That is a real `dkim=pass` that never
  aligns — and the reason it goes unnoticed for months is that every checker
  reports DKIM as working.
- **Microsoft 365 before custom DKIM**, which signs with `onmicrosoft.com` for the
  same reason and with the same result.
- **Forwarding and mailing lists**, where SPF breaks and DKIM may or may not
  survive intact. See [ARC](/glossary/arc/) for what that does and doesn't fix.

Aggregate reports are where you see all of this: each row shows the SPF and DKIM
results *and* whether they aligned, so a column of passes next to a DMARC fail is
the signature of the problem. [Reading an aggregate
report](/guides/how-to-read-a-dmarc-aggregate-report/) walks through it.
