---
term: DKIM
description: DKIM signs outgoing mail so a receiver can verify which domain took responsibility for the message, and that the signed parts were not altered.
aliases: ["DomainKeys Identified Mail"]
related: ["spf", "dmarc", "dmarc-alignment", "dkim-selector", "arc"]
---

**DKIM** (DomainKeys Identified Mail, [RFC 6376](/rfc/6376/)) attaches a
cryptographic signature to each
outgoing message. The signing domain publishes a public key in DNS; the
receiver uses it to verify the signature.

## What a signature actually proves

What a valid signature proves is narrower than it first appears: some domain that
holds the private key **took responsibility** for the message, and the signed
headers and body were not altered in transit. It does not prove the message
originated there — a mailing list or an outbound relay can sign perfectly validly
for its own domain. That distinction is the whole reason
[alignment](/glossary/dmarc-alignment/) exists.

## Where the signature and key live

The signature travels in a `DKIM-Signature:` header, and the public key lives at
a [**selector**](/glossary/dkim-selector/) under `_domainkey`:

```
selector._domainkey.yourdomain.com
```

The signature names both halves: `s=` is the selector to look up — the fastest
way to [find yours](/guides/find-your-dkim-selector/) — and `d=` is the domain
claiming responsibility. For DKIM to help [DMARC](/glossary/dmarc/), `d=`
must [align](/glossary/dmarc-alignment/) with the domain in the `From:` address —
which is why a `dkim=pass` from your email provider's own domain does nothing for
you, and why the failure is easy to miss.

## Forwarding, and why it survives that

Unlike [SPF](/glossary/spf/), DKIM survives plain forwarding, because the
signature moves with the message rather than depending on the connecting IP. It
does not survive a message being *modified* — a mailing list appending a footer
breaks it, which is the gap [ARC](/glossary/arc/) was designed to describe.

## Key rotation

Because the selector is part of the lookup, a domain can publish several keys at
once, which is what makes rotation possible without downtime: publish the new
selector, switch signing to it, then retire the old key once no mail in flight
still references it.

## Why some changes break the signature and others don't

The `c=` tag sets how forgiving verification is about changes made in
transit. `simple` breaks over almost any change to whitespace or line
endings; `relaxed` (the common default) tolerates that but still breaks if a
header's actual value changes. Neither survives a footer inserted *into* the
signed body — which is the other half of why a mailing list can fail DKIM
while a plain forward, which never touches signed content, does not.
