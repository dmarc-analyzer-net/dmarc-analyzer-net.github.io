---
term: DKIM
seoTitle: "DKIM (DomainKeys Identified Mail)"
description: DKIM signs mail so receivers can verify the signing domain and the integrity of signed content. Learn how selectors, alignment and forwarding affect it.
aliases: ["DomainKeys Identified Mail"]
related: ["spf", "dmarc", "dmarc-alignment", "dkim-selector", "arc"]
---

**DKIM** (DomainKeys Identified Mail, [RFC 6376](/rfc/6376/)) lets a domain
claim responsibility for an email through a cryptographic signature. The sending
system signs with a private key; the receiver retrieves the corresponding public
key from DNS and verifies the signature.

## What a signature proves

A valid signature associates the signing domain with the signed content. It does
not prove who wrote the message or that the message is safe: a mailing list,
outbound relay or attacker can sign mail for a domain they control. DKIM does not
encrypt the message.

The signature protects selected headers and the body after normalization for
verification. It does not protect every header or guarantee byte-for-byte
identity with the original message. A signature can also limit how much of the
body it covers with the optional `l=` tag, leaving appended content unsigned.

## Where the signature and key live

The signature travels in a `DKIM-Signature:` header. Its `s=` tag names the
[selector](/glossary/dkim-selector/) and `d=` names the signing domain. Together
they identify the public-key lookup: with `s=selector` and `d=yourdomain.com`,
the receiver queries TXT records at:

```
selector._domainkey.yourdomain.com
```

Use a received message's header to [find your selector](/guides/find-your-dkim-selector/).
Publishing a key alone does not enable signing; your sending system must use the
matching private key to sign outgoing mail.

## How DKIM helps DMARC

[DMARC](/glossary/dmarc/) requires a passing SPF or DKIM result that aligns with
the domain in the visible `From:` address. For DKIM, that comparison uses `d=`.
A passing signature from an unrelated provider domain does not satisfy it.

Under default relaxed alignment, the two domains must share an organizational
domain; strict alignment requires an exact match. A message can carry several
DKIM signatures: any one that both verifies and aligns can satisfy DMARC, even
if other signatures fail or use unrelated domains.

Across many client domains, [DMARC Analyzer](/) groups aggregate-report data by
client and domain so you can investigate raw authentication results alongside
DMARC compliance in the [domain detail view](/docs/domain-detail/).

## Forwarding and message changes

Unlike SPF, DKIM verification does not depend on the connecting IP address.
Plain forwarding can preserve the signature when it preserves the signed
content. A mailing list that rewrites a signed subject or inserts a footer into
the signed body can break it. [ARC](/glossary/arc/) lets intermediaries convey
earlier authentication results; it does not repair the original DKIM signature.

The `c=` tag chooses normalization separately for headers and body. If omitted,
the default is `simple/simple`. `simple` preserves headers exactly and ignores
trailing empty body lines. `relaxed` also tolerates defined whitespace changes
and header refolding; it does not tolerate arbitrary content changes. A footer
appended beyond an `l=` body-length limit can leave the signature valid while
the footer itself remains unauthenticated.

## Key rotation

Different selectors let you publish old and new public keys together. For routine
rotation, publish the new selector and allow for DNS caching before switching
signing to the matching private key. Keep the old public key available long
enough for receivers to verify messages already sent, including delayed
verification, then retire it. Removing it too early can make those signatures
unverifiable.
