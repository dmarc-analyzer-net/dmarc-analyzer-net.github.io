---
term: DKIM selector
seoTitle: "DKIM selector: how receivers find the key"
description: A DKIM selector identifies a public key under the signing domain in DNS. Learn how s= and d= locate the key, support rotation, and differ from alignment.
aliases: ["DKIM selectors", "selector"]
related: ["dkim", "dmarc", "spf"]
---

A **DKIM selector** is the name that identifies which [DKIM](/glossary/dkim/)
public key a receiver should use to verify a signature. Defined in
[RFC 6376](/rfc/6376/), it lets one signing domain publish separate keys for
different services or for rotation.

## How the receiver finds the key

Each `DKIM-Signature` header supplies the selector in `s=` and the signing domain
in `d=`. The receiver queries for a TXT record at:

```text
<selector>._domainkey.<signing-domain>
```

For example, these tags from a signature:

```text
d=yourdomain.com; s=mail2026;
```

give the lookup name `mail2026._domainkey.yourdomain.com`. These are only two
tags, not a complete signature. The signing domain determines the lookup
location even when it differs from the visible `From:` domain.

## Separate keys and rotation

Separate selectors let your mailbox service and marketing service sign for the
same domain with different private keys. They do not need to share one private
key.

For routine rotation, publish a new key under a new selector before switching
signing to it. Allow for DNS caching, then keep the old public key available
while messages carrying its signatures may still need verification. Removing
it too soon can break verification of mail already in transit.

## A selector does not establish alignment

The selector locates a key; `d=` identifies the domain taking responsibility
for the signature. For a DKIM pass to satisfy [DMARC](/glossary/dmarc/)
([RFC 9989](/rfc/9989/)), that signing domain must
[align](/glossary/dmarc-alignment/) with the visible `From:` domain. Relaxed
alignment accepts the same organizational domain; strict alignment requires an
exact match.

A message can have several signatures. One passing, aligned signature is enough
for DMARC to pass, even if another signature fails or uses an unaligned domain.
Aligned SPF can also produce a DMARC pass.

When you monitor many sending services, [DMARC Analyzer](/) puts raw DKIM
results and the DMARC verdict beside each source, so you can distinguish a
key-verification problem from an alignment problem.

## Selector names and discovery

Selectors can contain several DNS labels separated by dots: `mail2026` and
`mail2026.eu` are both valid. A selector does not have to identify a provider
or encode a date.

DKIM defines no query that lists every selector for a domain. A checker that
tries common names can miss a custom selector; an unsuccessful guess does not
prove DKIM is absent. A signed message or the sending service's settings gives
you the selector to query.

For the practical steps, use [how to find your DKIM
selector](/guides/find-your-dkim-selector/).
