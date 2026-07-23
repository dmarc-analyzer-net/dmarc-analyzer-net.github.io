---
term: DKIM
description: DKIM adds a cryptographic signature to outgoing mail so receivers can verify the message really came from your domain and was not altered.
aliases: ["DomainKeys Identified Mail"]
related: ["spf", "dmarc", "dmarc-alignment", "dkim-selector"]
---

**DKIM** (DomainKeys Identified Mail) attaches a cryptographic signature to each
outgoing message. The signing domain publishes a public key in DNS; the
receiver uses it to verify the signature. A valid signature proves two things:
the message genuinely came from a server holding the private key, and the
signed headers and body were not altered in transit.

The signature travels in a `DKIM-Signature:` header, and the public key lives at
a **selector**:

```
selector._domainkey.yourdomain.com
```

Unlike [SPF](/glossary/spf), DKIM survives forwarding, because the signature
moves with the message rather than depending on the connecting IP.

For DKIM to help [DMARC](/glossary/dmarc), the signing domain (`d=`) must
[align](/glossary/dmarc-alignment) with the domain in the `From:` address.
