---
term: DKIM selector
description: A DKIM selector is the label that points to a specific DKIM public key in DNS, letting a domain publish and rotate multiple signing keys at once.
aliases: ["DKIM selectors", "selector"]
related: ["dkim", "dmarc", "spf"]
---

A **DKIM selector** is the label that identifies *which* [DKIM](/glossary/dkim/)
public key a receiver should use to verify a message. It lets one domain publish
several keys — for different providers or for rotation — without them colliding.

The selector appears in two places. In DNS, the key lives at:

```
<selector>._domainkey.yourdomain.com
```

and in every signed message's `DKIM-Signature` header as the `s=` tag:

```
DKIM-Signature: v=1; a=rsa-sha256; d=yourdomain.com; s=google; ...
```

Here the selector is `google`, so the receiver fetches the key from
`google._domainkey.yourdomain.com`.

## Why selectors exist

Without them a domain could publish only one DKIM key, and every service sending
on its behalf would have to share the private half — which no provider will do.
The selector turns a single domain into a namespace: your mailbox provider, your
marketing platform and your helpdesk each publish a key under their own label,
and each names its own label in `s=` when it signs.

The same mechanism makes rotation possible without downtime. A new key goes up
under a new selector, signing switches to it, and the old one stays published
until the last message signed with it has been delivered.

## The two halves of a signature

A selector only says which key to fetch. It says nothing about *whose* domain
took responsibility — that is the `d=` tag beside it. Both matter, and for
different reasons: `s=` has to resolve for the signature to verify at all, and
`d=` has to [align](/glossary/dmarc-alignment/) with the `From:` domain for a
verified signature to satisfy [DMARC](/glossary/dmarc/). A `dkim=pass` under your
provider's `d=` rather than your own is the classic near-miss.

## Not enumerable

A selector is an ordinary DNS label with no reserved format — `google`, `s1`,
`selector2` and `20240115` are all valid — and `_domainkey` is not a listable
zone. You can only look up a selector you already know, which is why tools that
check whether DKIM is configured have to guess from a list of common names.

**See:** [how to find your DKIM selector](/guides/find-your-dkim-selector/) for
the practical steps, the selectors each provider uses, and what to do when one
does not resolve.
