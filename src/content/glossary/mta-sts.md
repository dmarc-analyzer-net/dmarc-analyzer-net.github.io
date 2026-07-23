---
term: MTA-STS
description: MTA-STS forces mail sent to your domain to use encrypted TLS, closing a downgrade-attack gap that SPF, DKIM, and DMARC don't address.
aliases: ["MTA-STS record", "SMTP MTA Strict Transport Security"]
related: ["dmarc", "spf", "dkim"]
---

**MTA-STS** (SMTP MTA Strict Transport Security) tells other mail servers that
they **must** use an encrypted, authenticated **TLS** connection when delivering
mail to your domain — and refuse to deliver if they can't. It closes a gap the
authentication standards leave open.

Where [SPF](/glossary/spf), [DKIM](/glossary/dkim), and [DMARC](/glossary/dmarc)
verify *who sent* a message, MTA-STS protects *how it travels*: without it, an
attacker can strip the `STARTTLS` upgrade and force mail to be sent in plaintext
(a downgrade attack). MTA-STS makes receivers reject that fallback.

## How it's set up

Two pieces:

1. A **policy file** served over HTTPS at
   `https://mta-sts.yourdomain.com/.well-known/mta-sts.txt`, listing your mail
   hosts and the enforcement `mode` (`enforce`, `testing`, or `none`).
2. A **`TXT` record** at `_mta-sts.yourdomain.com` announcing the policy:
   ```
   v=STSv1; id=20260101000000
   ```

Bump the `id` whenever you change the policy so servers refetch it.

## Pair it with TLS-RPT

Add a **TLS-RPT** record (`_smtp._tls.yourdomain.com`) to receive reports about
TLS delivery failures — the same way [DMARC aggregate
reports](/glossary/dmarc-aggregate-report) give you visibility into
authentication. MTA-STS and TLS-RPT are the natural next step after your domain
reaches DMARC enforcement.
